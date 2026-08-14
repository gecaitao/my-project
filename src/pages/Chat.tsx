import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  streamChatCompletion,
  type ChatMessage as AIMessage,
} from "@/lib/deepseek";
import { apiFetch, isLoggedIn, clearToken } from "@/lib/api";
import "./Chat.scss";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // 正在流式生成的 AI 回复（未落库，用于打字机效果）
  const [pending, setPending] = useState("");
  // 是否正在请求 AI
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 未登录则跳转登录页
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // 拉取当前用户信息
  useEffect(() => {
    if (!isLoggedIn()) return;
    (async () => {
      try {
        const { status, data } = await apiFetch<{ user: AuthUser }>("/auth/me");
        if (status === 200) setUser(data.user);
      } catch {
        // 网络错误忽略，聊天仍可用
      }
    })();
  }, []);

  // 拉取历史消息（后端 /api/messages）
  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { status, data } = await apiFetch<{ messages: Message[] }>(
          "/messages",
        );
        if (!cancelled && status === 200) setMessages(data.messages);
      } catch {
        // 网络错误忽略
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 新消息或流式内容更新时自动滚到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  // 退出登录
  const logout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  // 发送：①存用户消息到后台 → ②后台 /api/chat 流式生成 AI 回复（后台自动落库）
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);

    // ① 乐观显示用户消息，并写入后台
    const userMsg: Message = { id: `local-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    try {
      await apiFetch("/messages", { method: "POST", body: { role: "user", text } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "消息保存失败");
    }

    // ② 从历史消息构造上下文（含刚发送的这条；system 由后台补）
    const history: AIMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.text,
    }));

    // ③ 流式调用后台，边生成边展示
    setSending(true);
    setPending("");
    try {
      const reply = await streamChatCompletion(history, (delta) =>
        setPending((prev) => prev + delta),
      );
      setPending("");
      if (reply.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: "assistant", text: reply },
        ]);
      }
    } catch (err) {
      setPending("");
      setError(err instanceof Error ? err.message : "AI 回复失败，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <Link to="/" className="chat-back" aria-label="返回导航">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5m0 0 6-6m-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="chat-title">
          <h1>AI 聊天</h1>
          <p>与 DeepSeek 实时对话</p>
        </div>
        <div className="chat-user">
          {user && (
            <span className="chat-user-name">
              {user.name || user.email}
            </span>
          )}
          <button className="chat-logout" onClick={logout}>
            退出
          </button>
        </div>
      </header>

      <div className="chat-messages">
        {messages.length === 0 && !sending && (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 10.5h8M8 14h4.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.34-3.85-.94L3 20.5l1.55-4.35A8.5 8.5 0 1 1 21 11.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>开始对话吧</h2>
            <p>在下方向 AI 助手输入你的问题，按 Enter 发送</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <span className={`avatar ${m.role}`} aria-hidden="true">
              {m.role === "assistant" ? (
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 10.5h8M8 14h4.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.34-3.85-.94L3 20.5l1.55-4.35A8.5 8.5 0 1 1 21 11.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="8"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            <div className="bubble">{m.text}</div>
          </div>
        ))}

        {/* 正在生成中的 AI 回复（流式打字机效果） */}
        {sending && (
          <div className="chat-msg assistant">
            <span className="avatar assistant" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 10.5h8M8 14h4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.34-3.85-.94L3 20.5l1.55-4.35A8.5 8.5 0 1 1 21 11.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="bubble">
              {pending || "正在思考…"}
              <span className="cursor" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="chat-error">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M12 8v4m0 4h.01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <footer className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={sending ? "AI 正在回复…" : "输入消息，按 Enter 发送…"}
        />
        <button onClick={send} disabled={!input.trim() || sending}>
          {sending ? (
            <span className="btn-loading" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h13m0 0-5-5m5 5-5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{sending ? "生成中" : "发送"}</span>
        </button>
      </footer>
    </div>
  );
}

export default Chat;
