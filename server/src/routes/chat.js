import { Router } from "express";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

/** 后台的 AI 身份设定 */
const SYSTEM_PROMPT = {
  role: "system",
  content:
    "你是 my-project 聊天应用里的 AI 助手，请用简洁、友好的中文回答问题。",
};

/**
 * AI 聊天（SSE 流式）：POST /api/chat { messages, conversationId }（需登录）
 *  - messages: OpenAI 兼容格式的历史消息（不含 system，由后台补）
 *  - conversationId: 消息归属的对话
 *  - 后台调用 DeepSeek（stream），把 SSE 流原样透传回前端（打字机效果）
 *  - 流结束后，自动把完整 AI 回复写入该对话的消息库
 */
router.post("/", requireAuth, async (req, res) => {
  const { messages, conversationId } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 不能为空" });
  }
  if (!conversationId) {
    return res.status(400).json({ error: "缺少 conversationId" });
  }
  if (!config.deepseekApiKey) {
    return res.status(500).json({ error: "服务端未配置 DEEPSEEK_API_KEY" });
  }

  const store = req.app.locals.store;

  // 校验该对话属于当前用户
  const conv = await store.conversations.findById(req.user.id, conversationId);
  if (!conv) {
    return res.status(404).json({ error: "对话不存在" });
  }

  // 调用 DeepSeek（流式）
  let upstream;
  try {
    upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [SYSTEM_PROMPT, ...messages],
        temperature: 0.7,
        stream: true,
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: `无法连接 DeepSeek: ${err.message}` });
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return res
      .status(upstream.status)
      .json({ error: `DeepSeek 错误 ${upstream.status}: ${errText}` });
  }

  // SSE 响应头（透传）
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // 逐块读取 DeepSeek 的 SSE 流：原样透传 + 同时解析出完整回复
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk); // 透传给前端
      buffer += chunk;

      // 解析 SSE data 行，拼出完整 content
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content ?? "";
          full += delta;
        } catch {
          // 忽略不完整 chunk
        }
      }
    }
  } catch (err) {
    console.error("[chat] 流式读取中断:", err.message);
  } finally {
    res.end();
  }

  // 完整回复落库（归属当前对话 + 当前用户）
  const text = full.trim();
  if (text) {
    try {
      await store.messages.create({
        conversationId,
        role: "assistant",
        text,
        userId: req.user.id,
      });
      console.log(`[chat] AI 回复已保存 (${text.length} 字)`);
    } catch (err) {
      console.error("[chat] 保存 AI 回复失败:", err.message);
    }
  }
});

export default router;
