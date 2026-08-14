import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** 拉取历史消息：GET /api/messages */
router.get("/", async (req, res) => {
  const store = req.app.locals.store;
  const list = await store.messages.list();
  res.json({ messages: list });
});

/** 写入一条消息：POST /api/messages { role, text }（登录后可自动带上 userId） */
router.post("/", requireAuth, async (req, res) => {
  const { role, text } = req.body || {};
  if (!["user", "assistant"].includes(role) || !text) {
    return res.status(400).json({ error: "role 和 text 必填" });
  }
  const store = req.app.locals.store;
  const userId = req.user?.id ?? null;
  const msg = await store.messages.create({ role, text, userId });
  res.status(201).json({ message: msg });
});

export default router;
