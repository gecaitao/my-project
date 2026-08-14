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

interface Conversation {
  id: string;
  title: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function Chat() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  // 防止 React StrictMode 开发模式下 useEffect 双执行导致重复初始化
  const initializedRef = useRef(false);

  // 未登录则跳转登录页
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // 初始化：拉用户 → 拉对话列表（无则自动新建）→ 选中第一个并加载消息
  useEffect(() => {
    if (!isLoggedIn()) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      try {
        const me = await apiFetch<{ user: AuthUser }>("/auth/me");
        if (me.status === 200) setUser(me.data.user);
      } catch {
        // 忽略
      }

      let list: Conversation[] = [];
      try {
        const r = await apiFetch<{ conversations: Conversation[] }>(
          "/conversations",
        );
        list = r.status === 200 ? r.data.conversations : [];
      } catch {
        // 忽略
      }
      if (list.length === 0) {
        try {
          const c = await apiFetch<{ conversation: Conversation }>(
            "/conversations",
            { method: "POST", body: {} },
          );
          if (c.status === 201) list = [c.data.conversation];
        } catch {
          // 忽略
        }
      }
      setConversations(list);
      if (list[0]) {
        setActiveId(list[0].id);
        await loadMessages(list[0].id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载某对话的消息
  const loadMessages = async (id: string) => {
    setMessages([]);
    try {
      const { status, data } = await apiFetch<{ messages: Message[] }>(
        `/messages?conversationId=${id}`,
      );
      if (status === 200) setMessages(data.messages);
    } catch {
      // 忽略
    }
  };

  // 选择对话
  const selectConversation = async (id: string) => {
    setActiveId(id);
    setError(null);
    await loadMessages(id);
  };

  // 新建对话
  const newConversation = async () => {
    setError(null);
    try {
      const { status, data } = await apiFetch<{ conversation: Conversation }>(
        "/conversations",
        { method: "POST", body: {} },
      );
      if (status === 201) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveId(data.conversation.id);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "新建对话失败");
    }
  };

  // 删除对话（连带消息）
  const deleteConversation = async (id: string) => {
    if (!window.confirm("确定删除该对话？消息将一并删除，无法恢复。")) return;
    try {
      const { status } = await apiFetch(`/conversations/${id}`, {
        method: "DELETE",
      });
      if (status !== 200) {
        setError("删除失败");
        return;
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) {
          const fallback = next[0] ?? null;
          setActiveId(fallback ? fallback.id : null);
          if (fallback) {
            loadMessages(fallback.id);
          } else {
            setMessages([]);
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  // 开始重命名
  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  // 保存重命名
  const saveRename = async () => {
    const id = editingId;
    const title = editTitle.trim();
    setEditingId(null);
    if (!id || !title) return;
    try {
      const { status } = await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: { title },
      });
      if (status === 200) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "重命名失败");
    }
  };

  // 退出登录
  const logout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  // 发送：①存用户消息到当前对话 → ②流式生成 AI 回复（后台自动落库）
  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeId) return;
    setInput("");
    setError(null);

    // ① 乐观显示用户消息，并写入后台（归属当前对话）
    const userMsg: Message = { id: `local-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    try {
      await apiFetch("/messages", {
        method: "POST",
        body: { role: "user", text, conversationId: activeId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "消息保存失败");
    }

    // 首条消息时自动用内容给对话命名
    const current = conversations.find((c) => c.id === activeId);
    if (current?.title === "新对话" && messages.length === 0) {
      const title = text.length > 15 ? `${text.slice(0, 15)}…` : text;
      apiFetch(`/conversations/${activeId}`, {
        method: "PATCH",
        body: { title },
      }).then(({ status }) => {
        if (status === 200) {
          setConversations((prev) =>
            prev.map((c) => (c.id === activeId ? { ...c, title } : c)),
          );
        }
      });
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
      const reply = await streamChatCompletion(
        history,
        (delta) => setPending((prev) => prev + delta),
        activeId,
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
      <aside className="chat-sidebar">
        <div className="sidebar-top">
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
          <span className="sidebar-brand">AI 聊天</span>
        </div>

        <button className="sidebar-new" onClick={newConversation}>
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          新建对话
        </button>

        <div className="sidebar-list">
          {loading ? (
            <div className="sidebar-loading">加载中…</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`sidebar-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                {editingId === c.id ? (
                  <input
                    className="rename-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="item-title">{c.title}</span>
                    <span className="item-actions">
                      <button
                        title="重命名"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(c);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        title="删除"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                        }}
                      >
                        🗑
                      </button>
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          {user && (
            <span className="sidebar-user">{user.name || user.email}</span>
          )}
          <button className="sidebar-logout" onClick={logout}>
            退出
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-title">
            <h1>
              {conversations.find((c) => c.id === activeId)?.title || "新对话"}
            </h1>
            <p>{messages.length} 条消息 · 与 DeepSeek 实时对话</p>
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
      </main>
    </div>
  );
}

export default Chat;
