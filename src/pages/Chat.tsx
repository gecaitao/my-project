import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Chat.scss";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
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

  // 新消息时自动滚到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息：写入 Firestore
  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await addDoc(collection(db, "messages"), {
      role: "user",
      text,
      createdAt: serverTimestamp(),
    });
    // 模拟回复：写入一条 assistant 消息（接入真实 AI 接口后替换）
    setTimeout(() => {
      addDoc(collection(db, "messages"), {
        role: "assistant",
        text: `收到：${text}（这是一条模拟回复，接入真实接口后替换即可）`,
        createdAt: serverTimestamp(),
      });
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
