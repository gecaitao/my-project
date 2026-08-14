import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

/** 注册：POST /api/auth/register { email, password, name? } */
router.post("/register", async (req, res) => {
  const { email, password, name = "" } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "邮箱和密码必填" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "密码至少 6 位" });
  }

  const store = req.app.locals.store;
  const existing = await store.users.findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "该邮箱已注册" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await store.users.create({ email, passwordHash, name });
  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

/** 登录：POST /api/auth/login { email, password } */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const store = req.app.locals.store;

  const user = await store.users.findByEmail(email || "");
  if (!user) {
    return res.status(401).json({ error: "邮箱或密码错误" });
  }
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "邮箱或密码错误" });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

/** 当前用户：GET /api/auth/me（需 Bearer token） */
router.get("/me", requireAuth, async (req, res) => {
  const store = req.app.locals.store;
  const user = await store.users.findByEmail(req.user.email);
  if (!user) {
    return res.status(404).json({ error: "用户不存在" });
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

export default router;
