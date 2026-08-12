import { useEffect, useRef, useState } from "react";
import "./Chat.scss";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "assistant", text: "你好！我是 Chat 助手，有什么可以帮你？" },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // 新消息时自动滚到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text }]);
    setInput("");
    // 模拟回复（可替换为真实接口）
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `收到：${text}（这是一条模拟回复，接入真实接口后替换即可）`,
        },
      ]);
    }, 600);
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
        <div ref={endRef} />
      </div>

      <footer className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="输入消息，按 Enter 发送…"
        />
        <button onClick={send} disabled={!input.trim()}>
          发送
        </button>
      </footer>
    </div>
  );
}

export default Chat;
