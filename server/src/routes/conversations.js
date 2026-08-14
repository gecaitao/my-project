import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** 列出当前用户的所有对话：GET /api/conversations */
router.get("/", requireAuth, async (req, res) => {
  const store = req.app.locals.store;
  const list = await store.conversations.list(req.user.id);
  res.json({ conversations: list });
});

/** 新建对话：POST /api/conversations { title? } */
router.post("/", requireAuth, async (req, res) => {
  const { title } = req.body || {};
  const store = req.app.locals.store;
  const conv = await store.conversations.create({
    userId: req.user.id,
    title: title?.trim() || "新对话",
  });
  res.status(201).json({ conversation: conv });
});

/** 重命名对话：PATCH /api/conversations/:id { title } */
router.patch("/:id", requireAuth, async (req, res) => {
  const { title } = req.body || {};
  if (!title?.trim()) {
    return res.status(400).json({ error: "标题不能为空" });
  }
  const store = req.app.locals.store;
  const conv = await store.conversations.rename(
    req.user.id,
    req.params.id,
    title.trim(),
  );
  if (!conv) {
    return res.status(404).json({ error: "对话不存在" });
  }
  res.json({ conversation: conv });
});

/** 删除对话（连带其消息）：DELETE /api/conversations/:id */
router.delete("/:id", requireAuth, async (req, res) => {
  const store = req.app.locals.store;
  const ok = await store.conversations.remove(req.user.id, req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "对话不存在" });
  }
  res.json({ ok: true });
});

export default router;
