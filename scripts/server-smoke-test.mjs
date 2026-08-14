/**
 * 后端冒烟测试：注册 → 登录 → 当前用户 → 存消息 → 拉历史 → AI 聊天(SSE)
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

// ---- 7. 无 token 拉消息被拒（POST 需要登录） ----
const msgNoAuth = await req("/messages", { method: "POST", body: { role: "user", text: "hi" } });
check("未登录存消息 → 401", msgNoAuth.status === 401);

// ---- 8. 存一条用户消息 ----
const msg = await req("/messages", {
  method: "POST",
  body: { role: "user", text: "你好，帮我介绍一下你自己" },
  token,
});
check("存用户消息 → 201", msg.status === 201 && !!msg.data?.message?.id);

// ---- 9. 拉取历史 ----
const history = await req("/messages", { token });
check(
  "拉历史 /messages → 200 且含刚存消息",
  history.status === 200 &&
    Array.isArray(history.data?.messages) &&
    history.data.messages.some((m) => m.text === "你好，帮我介绍一下你自己"),
);

// ---- 10. AI 聊天（SSE 流式） ----
const chatRes = await fetch(`${BASE}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
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

console.log(failed ? `\n共 ${failed} 项失败` : "\n全部通过 🎉");
process.exit(failed ? 1 : 0);
