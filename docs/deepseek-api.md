# DeepSeek API 接入说明

> 基于 [DeepSeek 官方文档](https://api-docs.deepseek.com/zh-cn/)（2026-08 整理）。
> DeepSeek 提供 **OpenAI 兼容格式** 的 RESTful API，本文以 `ChatCompletion`（对话补全）接口为主线，讲解核心概念与接入方式。

---

## 目录

1. [快速上手](#一快速上手)
2. [Chat Completions 接口总览](#二chat-completions-接口总览)
3. [messages 结构（核心）](#三messages-结构核心)
4. [关键参数详解](#四关键参数详解)
5. [流式输出（stream / SSE）](#五流式输出stream--sse)
6. [响应结构（非流式）](#六响应结构非流式)
7. [错误码](#七错误码)
8. [安全注意事项](#八安全注意事项)
9. [本项目集成方案](#九本项目集成方案)
10. [常用代码模板](#十常用代码模板)

---

## 一、快速上手

### 1.1 获取 API Key

前往 [DeepSeek 开放平台](https://platform.deepseek.com/) → 注册账号 → 创建 API Key。

> ⚠️ API Key 是敏感凭据，**切勿**提交到 Git 仓库或写进前端代码。

### 1.2 接口基本信息

| 项目 | 值 |
| --- | --- |
| Base URL（OpenAI 格式） | `https://api.deepseek.com` |
| 兼容格式 | OpenAI / Anthropic |
| 认证方式 | `Authorization: Bearer <API_KEY>` |
| 请求/响应格式 | `application/json` |
| 模型 | `deepseek-v4-flash`（快、便宜）、`deepseek-v4-pro`（强、贵） |

### 1.3 最简单的一次调用（curl）

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "你好！"}
    ],
    "stream": false
  }'
```

---

## 二、Chat Completions 接口总览

### 2.1 端点

```
POST https://api.deepseek.com/chat/completions
```

作用：根据输入的对话上下文（`messages`），让模型补全后续内容。

### 2.2 请求头

| Header | 值 |
| --- | --- |
| `Authorization` | `Bearer <API_KEY>` |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

### 2.3 完整请求体示例

```jsonc
{
  // ===== 必填 =====
  "model": "deepseek-v4-flash",          // 模型 ID
  "messages": [                          // 对话消息数组
    { "role": "system", "content": "你是一个乐于助人的助手。" },
    { "role": "user", "content": "介绍一下你自己" }
  ],

  // ===== 常用可选 =====
  "temperature": 0.7,                    // 采样温度（0~2，默认 1）
  "top_p": 1,                            // 核采样（0~1，默认 1）
  "max_tokens": 2048,                    // 最大输出 token 数
  "stream": false,                       // 是否流式输出（SSE）
  "stop": null,                          // 结束符，如 ["\n\n", "###"]

  // ===== 思考模式（deepseek-v4 特性）=====
  "thinking": { "type": "enabled" },     // 思考模式开关
  "reasoning_effort": "high",            // 推理强度 low | high | max

  // ===== 进阶 =====
  "response_format": { "type": "text" }, // text | json_object
  "tools": null,                         // 函数调用工具
  "tool_choice": "none",
  "user_id": null                        // 业务侧用户标识（限速/缓存隔离）
}
```

> 注：`frequency_penalty`、`presence_penalty` 已在当前版本中**废弃**，传入无效果。

---

## 三、messages 结构（核心）

`messages` 是数组，按**时间顺序**存放对话历史，每项包含两个核心字段：

```ts
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

### 3.1 三种角色

| role | 含义 | 说明 |
| --- | --- | --- |
| `system` | 系统设定 | 定义模型的身份、行为准则、输出格式等，通常放在第一条（可选但推荐） |
| `user` | 用户消息 | 用户的输入 |
| `assistant` | 助手回复 | 模型的回复；**多轮对话时**需要把历史回复拼回来，模型才有上下文 |

### 3.2 多轮对话示例

```jsonc
"messages": [
  // ① 系统设定（可选）：规定身份与规则
  { "role": "system", "content": "你是 my-project 的智能客服，回答要简洁、使用中文。" },

  // ② 第一轮：用户提问
  { "role": "user", "content": "你好" },

  // ③ 第一轮：助手回答（来自上一次 API 返回）
  { "role": "assistant", "content": "你好！有什么可以帮你？" },

  // ④ 第二轮：用户追问
  { "role": "user", "content": "帮我介绍下这个项目" }
]
```

### 3.3 使用要点

- **上下文即 messages 长度**：历史消息越多越"懂你"，但也越耗 token（计费）。
- **超出上下文怎么办**：保留最近的 N 条、或对历史做摘要压缩（1M 上下文一般够用）。
- **V4 思考模式**：开启 `thinking` 后，`assistant` 消息还可能包含 `reasoning_content`（思考过程）字段，展示时注意与最终 `content` 区分。

---

## 四、关键参数详解

### 4.1 model —— 模型选择

| 模型 | 特点 | 参考价（每百万 tokens） |
| --- | --- | --- |
| `deepseek-v4-flash` | 速度快、性价比高 | 输入 1 元 / 输出 2 元 |
| `deepseek-v4-pro` | 能力强、适合复杂推理 | 输入 3 元 / 输出 6 元 |

> 均支持思考/非思考模式，上下文 1M、输出最大 384K。
> 价格后续会改为**峰谷定价**（高峰时段为空闲时段 2 倍），详见官方定价页。

### 4.2 temperature —— 采样温度（重点）

控制输出**随机性 / 创造性**，取值 `0 ~ 2`，默认 `1`。

| 取值 | 效果 | 适用场景 |
| --- | --- | --- |
| `0.2` | 更确定、稳定、忠实于上下文 | 代码生成、数学、事实问答、客服 |
| `0.7` | 平衡 | 通用对话 |
| `0.8 ~ 1.5` | 更随机、有创意 | 文案、故事、头脑风暴、营销 |

```json
{ "temperature": 0.2 }   // 低：更"冷静"
{ "temperature": 1.2 }   // 高：更"放飞"
```

> ⚠️ **建议**：`temperature` 与 `top_p` 二选一调整即可，官方不建议同时修改两者。

### 4.3 top_p —— 核采样

替代 `temperature` 的另一种采样方式。模型只从累积概率前 `top_p` 的 token 中采样。`0.1` = 只考虑最高 10% 概率的 token。

### 4.4 max_tokens —— 输出长度上限

限制单次回复的最大 token 数（不含输入）。超出上下文长度限制会报错。

### 4.5 response_format —— 结构化输出

```json
{ "response_format": { "type": "json_object" } }
```

强制模型输出合法 JSON。使用时建议在 `system` 消息里同时说明 JSON 结构，例如：
`"请只返回 JSON，格式为 {\"answer\": string, \"score\": number}"`。

### 4.6 thinking —— 思考模式（V4）

```json
{
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```

- `reasoning_effort`：`low` | `high`（默认）| `max`；`medium`、`xhigh` 会映射为 `high`。
- 思考模式会先产出思考过程再给出答案，推理能力更强但更慢更贵；简单任务可关闭。

---

## 五、流式输出（stream / SSE）

### 5.1 原理

设置 `"stream": true` 后，服务端以 **SSE（Server-Sent Events）** 逐段推送内容增量，收到后可以**边生成边展示**（打字机效果），显著改善体验。流以 `data: [DONE]` 结尾。

### 5.2 流式响应结构

每个数据块形如：

```text
data: {"id":"chatcmpl-xxxx","object":"chat.completion.chunk","created":1720000000,"model":"deepseek-v4-flash","choices":[{"index":0,"delta":{"role":"assistant","content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxxx","object":"chat.completion.chunk","created":1720000000,"model":"deepseek-v4-flash","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxxx","object":"chat.completion.chunk","created":1720000000,"model":"deepseek-v4-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

- 每一行以 `data: ` 开头，后面是 JSON（`chat.completion.chunk` 对象）。
- 增量文本在 `choices[0].delta.content`（思考模式时可能在 `delta.reasoning_content`）。
- 最后一条 `data: [DONE]` 表示流结束。
- 空行分隔各事件。

### 5.3 如何拼接完整回复

把每个 chunk 的 `choices[0].delta.content` 依次 `+=` 即可：

```js
let full = "";
for (const chunk of chunks) {
  const delta = chunk.choices?.[0]?.delta?.content ?? "";
  full += delta;
  process.stdout.write(delta); // 边收边打印
}
```

---

## 六、响应结构（非流式）

`stream: false` 时，返回完整的 JSON：

```json
{
  "id": "chatcmpl-xxxx",
  "object": "chat.completion",
  "created": 1720000000,
  "model": "deepseek-v4-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是 DeepSeek，很高兴认识你。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 12,
    "total_tokens": 30
  }
}
```

| 字段 | 含义 |
| --- | --- |
| `id` | 本次会话唯一标识 |
| `choices[].message.content` | 模型回复正文（**取这里的文本**） |
| `choices[].finish_reason` | `stop` 正常结束 / `length` 达上限被截断 |
| `usage` | token 用量（计费依据）：`prompt_tokens` 输入、`completion_tokens` 输出、`total_tokens` 合计 |

---

## 七、错误码

| 状态码 | 含义 | 处理建议 |
| --- | --- | --- |
| `400` | 请求体格式错误 | 按返回的 message 修正请求体 |
| `401` | 认证失败 | 检查 API Key 是否正确 |
| `402` | 余额不足 | 前往平台充值 |
| `422` | 参数错误 | 按提示修正参数（如非法枚举值） |
| `429` | 请求速率达到上限（TPM/RPM） | 限速重试（如指数退避） |
| `500` | 服务器故障 | 稍后重试 |
| `503` | 服务器繁忙 | 稍后重试 |

错误响应示例：

```json
{
  "error": {
    "message": "Invalid request",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_request_error"
  }
}
```

---

## 八、安全注意事项

> 🔴 **最重要的原则：API Key 绝不能放在前端代码里。**

浏览器端的 JS 代码对用户完全可见，把 `DEEPSEEK_API_KEY` 写进前端 = 密钥公开。

| 方案 | 安全性 | 适用 |
| --- | --- | --- |
| Node 脚本 / 后端服务直接调用 | ✅ 安全（Key 在服务端） | 学习、生产 |
| Firebase Cloud Functions / 自建代理 | ✅ 安全（Key 在云端函数） | 前端生产集成 |
| 前端直接 `fetch` DeepSeek | ❌ Key 会暴露，且易被 CORS 拦截 | 仅本地学习演示，切勿上线 |

---

## 九、本项目集成方案

本项目是 **React + Vite + Firebase** 纯前端应用，目前 `src/pages/Chat.tsx` 用 Firestore 存储 + 模拟回复。接入 DeepSeek 有三种路径：

### 方案 A：学习 / 测试 —— Node 脚本（推荐先跑这个）

项目内已提供可运行脚本 `scripts/deepseek-demo.mjs`：

```bash
# 设置 key（Windows PowerShell）
$env:DEEPSEEK_API_KEY = "sk-xxxx"
node scripts/deepseek-demo.mjs                 # 非流式
node scripts/deepseek-demo.mjs --stream        # 流式打字机效果
node scripts/deepseek-demo.mjs --model deepseek-v4-pro --temperature 0.2
```

### 方案 B：生产 —— 后端代理（推荐）

前端不直接碰 Key，改为请求自己的后端/云函数：

```text
React 前端  --fetch-->  你的后端/Cloud Function  --fetch--> DeepSeek API
（无 Key）               （Key 在这里）                       （返回结果）
```

### 方案 C：演示 —— 前端直连（本项目当前实现，仅学习，勿上线）

**✅ 已完成接入**：`src/pages/Chat.tsx` 已通过 `src/lib/deepseek.ts` 接入 DeepSeek 流式回复，替换了原来的模拟回复。

- 配置：Key 放在本地 `.env.local` 的 `VITE_DEEPSEEK_API_KEY`（已被 gitignore，不会提交）。
- 流程：用户消息 → 写入 Firestore → 构造上下文调用 `streamChatCompletion` → 打字机效果展示 → 完整回复落库。
- ⚠️ 上线前务必改为**方案 B（后端代理）**，不要把 Key 留在前端。

---

## 十、常用代码模板

### 10.1 Node.js（原生 fetch，无需第三方依赖）

```js
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function chat(messages, { stream = false, temperature = 0.7 } = {}) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages,
      temperature,
      stream,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`[${res.status}] ${err.error?.message ?? res.statusText}`);
  }
  return res.json();
}

// 非流式
const data = await chat([
  { role: "system", content: "你是一个简洁的中文助手。" },
  { role: "user", content: "用一句话介绍 DeepSeek" },
]);
console.log(data.choices[0].message.content);
```

### 10.2 前端 fetch 流式读取（React 可用）

```js
async function streamChat(messages, onDelta) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${YOUR_KEY}`, // 生产环境请走后端代理！
    },
    body: JSON.stringify({ model: "deepseek-v4-flash", messages, stream: true }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件之间用空行分隔，逐行解析
    const lines = buffer.split("\n");
    buffer = lines.pop(); // 保留可能不完整的一行

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) onDelta(delta);
      } catch { /* 忽略不完整 chunk */ }
    }
  }
}
```

### 10.3 结合本项目 `Chat.tsx` 的对接思路

1. 用户发送消息 → 仍写入 Firestore（保留聊天记录）。
2. 调用 DeepSeek（经方案 B 的后端代理）。
3. 用 `streamChat` 逐段拿到回复，`setMessages` 更新气泡（打字机效果）。
4. 完整回复落库写入 Firestore，供刷新后回放。

---

## 参考链接

- 官方文档：[https://api-docs.deepseek.com/zh-cn/](https://api-docs.deepseek.com/zh-cn/)
- Chat Completions API：[https://api-docs.deepseek.com/zh-cn/api/create-chat-completion](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)
- 模型与价格：[https://api-docs.deepseek.com/zh-cn/quick_start/pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
- 错误码：[https://api-docs.deepseek.com/zh-cn/quick_start/error_codes](https://api-docs.deepseek.com/zh-cn/quick_start/error_codes)
