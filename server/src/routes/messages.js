import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** 拉取某对话的消息：GET /api/messages?conversationId=xxx（需登录） */
router.get("/", requireAuth, async (req, res) => {
  const conversationId = String(req.query.conversationId || "");
  if (!conversationId) {
    return res.status(400).json({ error: "缺少 conversationId" });
  }
  const store = req.app.locals.store;
  const conv = await store.conversations.findById(req.user.id, conversationId);
  if (!conv) {
    return res.status(404).json({ error: "对话不存在" });
  }
  const list = await store.messages.list(conversationId, req.user.id);
  res.json({ messages: list });
});

/** 向某对话写入一条消息：POST /api/messages { role, text, conversationId } */
router.post("/", requireAuth, async (req, res) => {
  const { role, text, conversationId } = req.body || {};
  if (!["user", "assistant"].includes(role) || !text) {
    return res.status(400).json({ error: "role 和 text 必填" });
  }
  if (!conversationId) {
    return res.status(400).json({ error: "缺少 conversationId" });
  }
  const store = req.app.locals.store;
  const conv = await store.conversations.findById(req.user.id, conversationId);
  if (!conv) {
    return res.status(404).json({ error: "对话不存在" });
  }
  const msg = await store.messages.create({
    conversationId,
    role,
    text,
    userId: req.user.id,
  });
  res.status(201).json({ message: msg });
});

export default router;
