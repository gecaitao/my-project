import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, setToken, isLoggedIn, clearToken } from "@/lib/api";
import "./Login.scss";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // 已登录时拉取用户信息展示账户面板
  useEffect(() => {
    if (!isLoggedIn()) return;
    (async () => {
      try {
        const { status, data } = await apiFetch<{ user: AuthUser }>("/auth/me");
        if (status === 200) setUser(data.user);
      } catch {
        // 忽略
      }
    })();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("邮箱和密码必填");
      return;
    }
    setLoading(true);
    try {
      const { status, data } = await apiFetch<{
        token: string;
        user: AuthUser;
      }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          auth: false,
          body:
            mode === "login"
              ? { email, password }
              : { email, password, name },
        },
      );
      if (status === 200 || status === 201) {
        setToken(data.token);
        navigate("/chat", { replace: true });
      } else {
        setError((data as unknown as { error?: string })?.error ?? "操作失败，请重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误，请确认后台已启动");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setMode("login");
  };

  return (
    <div className="login">
      <Link to="/" className="login-back" aria-label="返回导航">
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

      <div className="login-card">
        <div className="login-brand">
          <span className="login-dot" />
          <span>my-project</span>
        </div>

        {isLoggedIn() && user ? (
          // ===== 已登录：账户面板 =====
          <div className="login-account">
            <h1>已登录</h1>
            <p className="login-sub">当前账号</p>
            <div className="account-avatar">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="account-email">{user.email}</div>
            <div className="account-name">{user.name || "未设置昵称"}</div>
            <div className="account-actions">
              <button onClick={() => navigate("/chat")}>进入聊天</button>
              <button className="ghost" onClick={logout}>
                退出登录
              </button>
            </div>
          </div>
        ) : (
          // ===== 未登录：登录 / 注册表单 =====
          <>
            <h1>{mode === "login" ? "登录" : "注册"}</h1>
            <p className="login-sub">
              {mode === "login" ? "欢迎回来" : "创建一个新账号"}
            </p>

            <div className="login-tabs">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                登录
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                注册
              </button>
            </div>

            <form onSubmit={submit} className="login-form">
              {mode === "register" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称（可选）"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                autoComplete="email"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码（至少 6 位）"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
              {error && <div className="login-error">{error}</div>}
              <button type="submit" disabled={loading} className="login-submit">
                {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
