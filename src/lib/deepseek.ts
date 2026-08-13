/**
 * DeepSeek Chat Completions API 前端封装（学习/演示用）
 * ---------------------------------------------------------------
 * ⚠️ 安全提醒：API Key 绝不能写死在浏览器代码里！
 *  - 本封装要求调用方显式传入 apiKey（或经后端代理转发）。
 *  - 生产环境请把 key 放在你的后端 / Firebase Cloud Functions 中，
 *    前端改为请求自己的代理接口，见 docs/deepseek-api.md「方案 B」。
 *
 * 官方文档：https://api-docs.deepseek.com/zh-cn/api/create-chat-completion
 */

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions";

// ---------- 类型定义（对应 OpenAI 兼容格式） ----------

export type ChatRole = "system" | "user" | "assistant";

/** messages 数组中的单条消息结构 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** 请求可选参数 */
export interface ChatOptions {
  /** 模型：deepseek-v4-flash | deepseek-v4-pro */
  model?: string;
  /** 采样温度 0~2，默认 1。低=稳定，高=有创意 */
  temperature?: number;
  /** 核采样 0~1，默认 1 */
  topP?: number;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 结构化输出：text | json_object */
  responseFormat?: "text" | "json_object";
  /** 是否流式输出 */
  stream?: boolean;
}

/** 非流式完整响应 */
export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: ChatRole; content: string };
    finish_reason: "stop" | "length" | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------- 工具函数 ----------

/**
 * 获取 DeepSeek API Key。
 * 优先级：显式传入的 apiKey > import.meta.env.VITE_DEEPSEEK_API_KEY（.env.local 提供）
 * ⚠️ 生产环境请勿在前端携带 Key，改用后端代理。
 */
export function getDeepSeekApiKey(explicitKey?: string): string {
  return (explicitKey ?? import.meta.env.VITE_DEEPSEEK_API_KEY ?? "").trim();
}

/** 组装请求体（把可选项映射为 DeepSeek 期望的字段名） */
function buildBody(messages: ChatMessage[], options: ChatOptions) {
  return JSON.stringify({
    model: options.model ?? "deepseek-v4-flash",
    messages,
    temperature: options.temperature ?? 1,
    top_p: options.topP,
    max_tokens: options.maxTokens,
    response_format: options.responseFormat
      ? { type: options.responseFormat }
      : undefined,
    stream: options.stream ?? false,
  });
}

/** 统一的 fetch 封装（含错误处理） */
async function request(
  messages: ChatMessage[],
  options: ChatOptions,
  apiKey?: string,
): Promise<Response> {
  const key = getDeepSeekApiKey(apiKey);
  if (!key) {
    throw new Error(
      "未配置 DeepSeek API Key。请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY，或显式传入 apiKey。",
    );
  }
  const res = await fetch(DEEPSEEK_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: buildBody(messages, options),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DeepSeek API 错误 ${res.status}: ${err.error?.message ?? res.statusText}`);
  }
  return res;
}

// ---------- 对外接口 ----------

/**
 * 非流式对话补全：一次请求拿到完整回复。
 * 返回完整响应对象，正文在 `data.choices[0].message.content`。
 * @param apiKey 可省略，缺省时读取 import.meta.env.VITE_DEEPSEEK_API_KEY
 */
export async function chatCompletion(
  messages: ChatMessage[],
  apiKey?: string,
  options: ChatOptions = {},
): Promise<ChatCompletion> {
  const res = await request(messages, { ...options, stream: false }, apiKey);
  return (await res.json()) as ChatCompletion;
}

/**
 * 流式对话补全：通过 onDelta 回调逐段接收增量文本（打字机效果）。
 * 返回完整拼接后的回复。
 * @param apiKey 可省略，缺省时读取 import.meta.env.VITE_DEEPSEEK_API_KEY
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  apiKey?: string,
  options: ChatOptions = {},
): Promise<string> {
  const res = await request(messages, { ...options, stream: true }, apiKey);

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
