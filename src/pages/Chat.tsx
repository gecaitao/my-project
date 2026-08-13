import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  streamChatCompletion,
  type ChatMessage as AIMessage,
} from "@/lib/deepseek";
import "./Chat.scss";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

// AI 系统提示词：定义助手身份与回答风格
const SYSTEM_PROMPT: AIMessage = {
  role: "system",
  content:
    "你是 my-react 聊天应用里的 AI 助手，请用简洁、友好的中文回答问题。",
};

function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // 正在流式生成的 AI 回复（未落库，用于打字机效果）
  const [pending, setPending] = useState("");
  // 是否正在请求 AI
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 实时监听 Firestore 的 messages 集合（数据一变，所有客户端自动同步）
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          role: d.role as Message["role"],
          text: d.text as string,
        };
      });
      setMessages(list);
    });
    return unsubscribe;
  }, []);

  // 新消息或流式内容更新时自动滚到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  // 发送消息：写入 Firestore + 调用 DeepSeek 流式生成 AI 回复
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);

    // ① 保存用户消息到 Firestore（保留聊天记录，onSnapshot 自动同步）
    await addDoc(collection(db, "messages"), {
      role: "user",
      text,
      createdAt: serverTimestamp(),
    });

    // ② 从历史消息构造 DeepSeek 上下文（含刚发送的这条）
    const history: AIMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));
    history.push({ role: "user", content: text });

    // ③ 流式调用 DeepSeek，边生成边展示
    setSending(true);
    setPending("");
    try {
      const reply = await streamChatCompletion(
        [SYSTEM_PROMPT, ...history],
        (delta) => setPending((prev) => prev + delta),
        undefined,
        { model: "deepseek-v4-flash", temperature: 0.7 },
      );

      // ④ 完整回复落库（onSnapshot 会自动同步到消息列表）
      setPending("");
      if (reply.trim()) {
        await addDoc(collection(db, "messages"), {
          role: "assistant",
          text: reply,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setPending("");
      setError(
        err instanceof Error ? err.message : "AI 回复失败，请稍后重试",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <h1>Chat</h1>
        <p>一个简单的聊天示例页面</p>
      </header>

      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {/* 正在生成中的 AI 回复（流式打字机效果） */}
        {sending && (
          <div className="chat-msg assistant">
            <div className="bubble">
              {pending}
              <span className="cursor" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <footer className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={sending ? "AI 正在回复…" : "输入消息，按 Enter 发送…"}
        />
        <button onClick={send} disabled={!input.trim() || sending}>
          {sending ? "生成中…" : "发送"}
        </button>
      </footer>
    </div>
  );
}

export default Chat;
