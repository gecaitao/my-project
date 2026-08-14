/**
 * 后端冒烟测试：注册 → 登录 → 当前用户 → 对话增删改查 → 消息 → AI 聊天(SSE)
 * 运行前提：后端已启动（npm run dev，默认 http://localhost:3000）
 * 用法：node scripts/server-smoke-test.mjs
 */
const BASE = process.env.API_BASE || "http://localhost:3000/api";

let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
}

async function req(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// ---- 1. 健康检查 ----
const health = await req("/health");
check("健康检查 /api/health", health.status === 200 && health.data.ok === true);

// ---- 2. 注册 ----
const email = `user${Date.now()}@test.com`;
const reg = await req("/auth/register", {
  method: "POST",
  body: { email, password: "123456", name: "测试用户" },
});
check("注册 /auth/register → 201 + token", reg.status === 201 && !!reg.data?.token);
const token = reg.data?.token;

// ---- 3. 重复注册被拒 ----
const dup = await req("/auth/register", {
  method: "POST",
  body: { email, password: "123456" },
});
check("重复注册 → 409", dup.status === 409);

// ---- 4. 登录 ----
const login = await req("/auth/login", {
  method: "POST",
  body: { email, password: "123456" },
});
check("登录 /auth/login → 200 + token", login.status === 200 && !!login.data?.token);

// ---- 5. 密码错误被拒 ----
const badLogin = await req("/auth/login", {
  method: "POST",
  body: { email, password: "wrong-password" },
});
check("错误密码登录 → 401", badLogin.status === 401);

// ---- 6. 当前用户 ----
const me = await req("/auth/me", { token });
check("当前用户 /auth/me → 200", me.status === 200 && me.data?.user?.email === email);

// ---- 7. 未登录访问对话列表 → 401 ----
const convNoAuth = await req("/conversations");
check("未登录访问对话 → 401", convNoAuth.status === 401);

// ---- 8. 新建对话 ----
const conv = await req("/conversations", { method: "POST", body: {}, token });
check("新建对话 → 201 + id", conv.status === 201 && !!conv.data?.conversation?.id);
const convId = conv.data?.conversation?.id;

// ---- 9. 对话列表包含新建 ----
const convList = await req("/conversations", { token });
check(
  "对话列表包含新建对话",
  convList.status === 200 &&
    convList.data?.conversations?.some((c) => c.id === convId),
);

// ---- 10. 重命名对话 ----
const rename = await req(`/conversations/${convId}`, {
  method: "PATCH",
  body: { title: "改名后的对话" },
  token,
});
check(
  "重命名对话 → 200",
  rename.status === 200 && rename.data?.conversation?.title === "改名后的对话",
);

// ---- 11. 未登录存消息被拒 ----
const msgNoAuth = await req("/messages", {
  method: "POST",
  body: { role: "user", text: "hi", conversationId: convId },
});
check("未登录存消息 → 401", msgNoAuth.status === 401);

// ---- 12. 向对话存一条用户消息 ----
const msg = await req("/messages", {
  method: "POST",
  body: { role: "user", text: "你好，帮我介绍一下你自己", conversationId: convId },
  token,
});
check("存用户消息 → 201", msg.status === 201 && !!msg.data?.message?.id);

// ---- 13. 拉取该对话消息 ----
const history = await req(`/messages?conversationId=${convId}`, { token });
check(
  "拉对话消息 → 200 且含刚存消息",
  history.status === 200 &&
    Array.isArray(history.data?.messages) &&
    history.data.messages.some((m) => m.text === "你好，帮我介绍一下你自己"),
);

// ---- 14. 缺少 conversationId 拉消息 → 400 ----
const noConv = await req("/messages", { token });
check("缺少 conversationId 拉消息 → 400", noConv.status === 400);

// ---- 15. AI 聊天（SSE 流式，归属对话） ----
const chatRes = await fetch(`${BASE}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    conversationId: convId,
    messages: [{ role: "user", content: "用一句话回复：后台链路通了" }],
  }),
});
check("聊天接口 → 200", chatRes.status === 200);
const contentType = chatRes.headers.get("content-type") || "";
check("聊天接口 → SSE 类型", contentType.includes("text/event-stream"));

let sseText = "";
const reader = chatRes.body.getReader();
const decoder = new TextDecoder();
let hasContent = false;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  sseText += chunk;
  if (/content":"[^"]+/.test(chunk)) hasContent = true;
}
check("聊天接口 → 收到流式内容增量", hasContent);
console.log(`   → SSE 原始字节: ${sseText.length}`);

// ---- 16. AI 回复已自动写入该对话 ----
const after = await req(`/messages?conversationId=${convId}`, { token });
const hasAssistant = after.data?.messages?.some((m) => m.role === "assistant");
check("AI 回复已自动写入该对话", after.status === 200 && hasAssistant);

// ---- 17. 删除对话 ----
const del = await req(`/conversations/${convId}`, { method: "DELETE", token });
check("删除对话 → 200", del.status === 200);
const afterDel = await req("/conversations", { token });
check(
  "删除后列表不再包含",
  !afterDel.data?.conversations?.some((c) => c.id === convId),
);

console.log(failed ? `\n共 ${failed} 项失败` : "\n全部通过 🎉");
process.exit(failed ? 1 : 0);
