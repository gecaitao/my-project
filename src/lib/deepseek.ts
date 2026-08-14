/**
 * DeepSeek 聊天前端封装（经 Node 后台 /api/chat 转发）
 * ---------------------------------------------------------------
 * ⚠️ 安全：前端不再持有 API Key。Key 存放在 server/ 后台的环境变量里，
 *      前端只需把历史消息 POST 给后台，后台调用 DeepSeek 并流式返回。
 *  - 后台代码：server/src/routes/chat.js
 *  - 前端地址：VITE_API_BASE_URL（.env.develop / .env.product）
 */

import { env } from "@/config/env";
import { getToken } from "@/lib/api";

// ---------- 类型定义（OpenAI 兼容格式） ----------

export type ChatRole = "user" | "assistant" | "system";

/** messages 数组中的单条消息结构 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * 流式对话补全：把历史消息发给后台 /api/chat，
 * 后台调用 DeepSeek（stream）并把 SSE 流透传回来，onDelta 逐段接收（打字机效果）。
 * 返回完整拼接后的回复（后台也会自动把该回复存入消息库）。
 *
 * @param messages 历史消息（不含 system，后台会自动补 AI 身份设定）
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
): Promise<string> {
  const token = getToken();
  const res = await fetch(`${env.apiBaseUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      msg = j.error ?? msg;
    } catch {
      // 保留默认错误
    }
    throw new Error(msg);
  }

  // 解析后台透传的 DeepSeek SSE 流
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行分隔，按行解析
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return full;

      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // 忽略不完整的 chunk
      }
    }
  }
  return full;
}
