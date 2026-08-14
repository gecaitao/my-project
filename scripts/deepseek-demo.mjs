#!/usr/bin/env node
/**
 * DeepSeek Chat Completions API 演示脚本
 * ---------------------------------------------------------------
 * 用法（Windows PowerShell）：
 *   $env:DEEPSEEK_API_KEY = "sk-xxxx"
 *   node scripts/deepseek-demo.mjs                        # 非流式
 *   node scripts/deepseek-demo.mjs --stream               # 流式（打字机效果）
 *   node scripts/deepseek-demo.mjs --model deepseek-v4-pro --temperature 0.2
 *   node scripts/deepseek-demo.mjs --key sk-xxxx          # 也可直接用 --key 传入
 *
 * 依赖：Node.js 18+（使用原生 fetch，无需安装任何包）
 * 官方文档：https://api-docs.deepseek.com/zh-cn/
 */

const BASE_URL = "https://api.deepseek.com/chat/completions";

// ---------- 解析命令行参数 ----------
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
}

const stream = args.includes("--stream");
const key = getArg("key", process.env.DEEPSEEK_API_KEY);
const model = getArg("model", "deepseek-v4-flash");
const temperature = Number(getArg("temperature", "0.7"));
const prompt = getArg("prompt", "用一句话介绍你自己，并用中文回答。");

// ---------- 鉴权检查 ----------
if (!key) {
  console.error(
    [
      "❌ 未找到 API Key。请先设置环境变量 DEEPSEEK_API_KEY，",
      "   或使用 --key sk-xxxx 参数传入。",
      "   获取方式：https://platform.deepseek.com → 创建 API Key",
    ].join("\n"),
  );
  process.exit(1);
}

// 构造多轮对话示例（演示 messages 结构：system / user / assistant）
const messages = [
  { role: "system", content: "你是 my-project 项目里的一位简洁中文助手。" },
  { role: "user", content: "你好，请自我介绍一下。" },
  { role: "assistant", content: "你好！我是由 DeepSeek 驱动的 AI 助手，很高兴为你服务。" },
  { role: "user", content: prompt },
];

console.log("=".repeat(60));
console.log(`模型        : ${model}`);
console.log(`temperature : ${temperature}`);
console.log(`stream      : ${stream ? "是（SSE 流式）" : "否"}`);
console.log(`prompt      : ${prompt}`);
console.log("=".repeat(60));

/** 打印并返回完整回复文本 */
function logUsage(usage) {
  if (!usage) return;
  console.log("\n" + "-".repeat(60));
  console.log(
    `[用量] 输入 ${usage.prompt_tokens} / 输出 ${usage.completion_tokens} / 合计 ${usage.total_tokens} tokens`,
  );
}

// ---------- 发起请求 ----------
const res = await fetch(BASE_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({ model, messages, temperature, stream }),
});

// ---------- 错误处理 ----------
if (!res.ok) {
  const body = await res.text();
  console.error(`\n❌ HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
}

// ---------- 流式模式：解析 SSE ----------
if (stream) {
  console.log("\n🤖 助手（流式输出）:\n");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // 保留可能不完整的一行，留到下一轮

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") break;

      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue; // 不完整的 JSON 行，忽略
      }

      const delta = json.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        process.stdout.write(delta); // 打字机效果
      }
      if (json.usage) logUsage(json.usage);
    }
  }

  console.log("\n\n✅ 流式结束（完整回复长度: " + full.length + " 字符）");
  process.exit(0);
}

// ---------- 非流式模式 ----------
const data = await res.json();
console.log("\n🤖 助手:\n");
console.log(data.choices?.[0]?.message?.content ?? "(空回复)");
logUsage(data.usage);

console.log("\n✅ 调用成功，完整响应字段见下方（id / model / usage）:");
console.log(
  JSON.stringify(
    {
      id: data.id,
      model: data.model,
      object: data.object,
      finish_reason: data.choices?.[0]?.finish_reason,
      usage: data.usage,
    },
    null,
    2,
  ),
);
