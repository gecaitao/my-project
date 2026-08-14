import { env } from "@/config/env";

/**
 * 后端 API 客户端（统一走 VITE_API_BASE_URL）
 * 负责：JWT token 的存取、鉴权请求头、JSON 序列化
 */

const TOKEN_KEY = "my-react-token";

/** 读取本地 token */
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

/** 保存 token（登录/注册成功后调用） */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** 清除 token（退出登录时调用） */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** 是否已登录 */
export function isLoggedIn(): boolean {
  return getToken().length > 0;
}

export interface ApiResult<T> {
  status: number;
  data: T;
}

/** 通用请求封装 */
export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data: data as T };
}
