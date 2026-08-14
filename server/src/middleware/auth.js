import jwt from "jsonwebtoken";
import { config } from "../config.js";

/** 签发 JWT（默认 7 天有效） */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: "7d" },
  );
}

/** 鉴权中间件：解析 Authorization: Bearer <token>，挂载 req.user */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "未登录" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}
