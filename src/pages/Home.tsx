import { Link } from "react-router-dom";
import "./Home.scss";

// 导航应用列表：后续新增页面时，在此追加卡片即可
const APPS = [
  {
    key: "chat",
    title: "AI 聊天",
    desc: "与 DeepSeek 实时对话，支持流式回复与历史记录",
    to: "/chat",
    tag: "DeepSeek",
    icon: "chat",
  },
  {
    key: "account",
    title: "账号中心",
    desc: "注册、登录与管理你的账户",
    to: "/login",
    tag: "Auth",
    icon: "user",
  },
] as const;

/** 按应用类型渲染对应图标 */
function AppIcon({ type }: { type: "chat" | "user" }) {
  if (type === "chat") {
    return (
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
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Home() {
  return (
    <div className="nav">
      <header className="nav-hero">
        <div className="brand">
          <span className="brand-dot" />
          <span>my-project</span>
        </div>
        <h1>应用导航</h1>
        <p>选择一个应用开始你的旅程</p>
      </header>

      <section className="app-grid">
        {APPS.map((app) => (
          <Link key={app.key} to={app.to} className="app-card">
            <span className="app-icon" aria-hidden="true">
              <AppIcon type={app.icon} />
            </span>
            <div className="app-info">
              <div className="app-title">
                <h2>{app.title}</h2>
                {app.tag && <span className="app-tag">{app.tag}</span>}
              </div>
              <p>{app.desc}</p>
            </div>
            <span className="app-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14m0 0-6-6m6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
        ))}
      </section>

      <footer className="nav-footer">
        <p>Powered by React + Vite · 更多应用敬请期待</p>
      </footer>
    </div>
  );
}

export default Home;
