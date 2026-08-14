import mongoose from "mongoose";
import { config } from "./config.js";

/**
 * 存储层：支持两种后端
 *  - mongo：生产用 MongoDB（Mongoose），数据持久化
 *  - memory：本地调试用（无 Mongo 时自动启用），重启丢数据
 *
 * 数据模型：
 *   - 用户 User：注册登录
 *   - 对话 Conversation：属于某用户，可增删改查
 *   - 消息 Message：属于某对话 + 某用户
 *
 * 对外暴露统一接口 store：
 *   store.users.create / findByEmail
 *   store.conversations.create / list / rename / remove / findById
 *   store.messages.create({ conversationId, role, text, userId })
 *   store.messages.list(conversationId, userId)
 */

// ============ MongoDB 模型 ============
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, default: "" },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "新对话" },
  },
  { timestamps: true },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    userId: { type: String, default: null }, // 登录后写入；未登录为 null
  },
  { timestamps: true },
);

const UserModel = mongoose.model("User", userSchema);
const ConversationModel = mongoose.model("Conversation", conversationSchema);
const MessageModel = mongoose.model("Message", messageSchema);

// ============ 内存模式（本地调试降级） ============
let memUsers = [];
let memConversations = [];
let memMessages = [];
let memUserId = 0;
let memConvId = 0;
let memMsgId = 0;

/** 内存实现：对话 */
function memConvStore() {
  return {
    async create({ userId, title = "新对话" }) {
      const conv = {
        id: String(++memConvId),
        userId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      memConversations.push(conv);
      return { id: conv.id, title: conv.title };
    },
    async list(userId) {
      return memConversations
        .filter((c) => c.userId === userId)
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((c) => ({ id: c.id, title: c.title }));
    },
    async findById(userId, conversationId) {
      const c = memConversations.find(
        (x) => x.id === conversationId && x.userId === userId,
      );
      return c ? { id: c.id, title: c.title } : null;
    },
    async rename(userId, conversationId, title) {
      const c = memConversations.find(
        (x) => x.id === conversationId && x.userId === userId,
      );
      if (!c) return null;
      c.title = title;
      c.updatedAt = Date.now();
      return { id: c.id, title: c.title };
    },
    async remove(userId, conversationId) {
      const before = memConversations.length;
      memConversations = memConversations.filter(
        (x) => !(x.id === conversationId && x.userId === userId),
      );
      memMessages = memMessages.filter((m) => m.conversationId !== conversationId);
      return memConversations.length < before;
    },
  };
}

/** 内存实现：消息 */
function memMsgStore() {
  return {
    async create({ conversationId, role, text, userId = null }) {
      const msg = {
        id: String(++memMsgId),
        conversationId,
        role,
        text,
        userId,
        createdAt: Date.now(),
      };
      memMessages.push(msg);
      return { id: msg.id, role: msg.role, text: msg.text };
    },
    async list(conversationId, userId) {
      return memMessages
        .filter((m) => m.conversationId === conversationId && m.userId === userId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({ id: m.id, role: m.role, text: m.text }));
    },
  };
}

// ============ MongoDB 实现 ============
function createMongoStore() {
  return {
    mode: "mongo",
    users: {
      async create({ email, passwordHash, name = "" }) {
        const doc = await UserModel.create({ email, passwordHash, name });
        return { id: String(doc._id), email: doc.email, name: doc.name };
      },
      async findByEmail(email) {
        const doc = await UserModel.findOne({ email: email.toLowerCase() });
        if (!doc) return null;
        return {
          id: String(doc._id),
          email: doc.email,
          name: doc.name,
          passwordHash: doc.passwordHash,
        };
      },
    },
    conversations: {
      async create({ userId, title = "新对话" }) {
        const doc = await ConversationModel.create({ userId, title });
        return { id: String(doc._id), title: doc.title };
      },
      async list(userId) {
        const docs = await ConversationModel.find({ userId })
          .sort({ updatedAt: -1 });
        return docs.map((d) => ({ id: String(d._id), title: d.title }));
      },
      async findById(userId, conversationId) {
        const doc = await ConversationModel.findOne({
          _id: conversationId,
          userId,
        });
        return doc ? { id: String(doc._id), title: doc.title } : null;
      },
      async rename(userId, conversationId, title) {
        const doc = await ConversationModel.findOneAndUpdate(
          { _id: conversationId, userId },
          { title },
          { new: true },
        );
        return doc ? { id: String(doc._id), title: doc.title } : null;
      },
      async remove(userId, conversationId) {
        const r = await ConversationModel.deleteOne({
          _id: conversationId,
          userId,
        });
        if (r.deletedCount) {
          // 连带删除该对话下的消息
          await MessageModel.deleteMany({ conversationId });
        }
        return r.deletedCount > 0;
      },
    },
    messages: {
      async create({ conversationId, role, text, userId = null }) {
        const doc = await MessageModel.create({
          conversationId,
          role,
          text,
          userId,
        });
        // 更新对话的 updatedAt，让最近对话排前面
        await ConversationModel.updateOne(
          { _id: conversationId },
          { $set: { updatedAt: new Date() } },
        );
        return { id: String(doc._id), role: doc.role, text: doc.text };
      },
      async list(conversationId, userId) {
        const docs = await MessageModel.find({
          conversationId,
          userId,
        }).sort({ createdAt: 1 });
        return docs.map((d) => ({
          id: String(d._id),
          role: d.role,
          text: d.text,
        }));
      },
    },
  };
}

// ============ 内存实现（本地调试 / 降级） ============
function createMemoryStore() {
  return {
    mode: "memory",
    users: {
      async create({ email, passwordHash, name = "" }) {
        const user = { id: String(++memUserId), email: email.toLowerCase(), name, passwordHash };
        memUsers.push(user);
        return { id: user.id, email: user.email, name: user.name };
      },
      async findByEmail(email) {
        const user = memUsers.find((u) => u.email === email.toLowerCase());
        return user ? { ...user } : null;
      },
    },
    conversations: memConvStore(),
    messages: memMsgStore(),
  };
}

// ============ 工厂：根据配置返回 store ============
export async function initDb() {
  // 配置了 MONGODB_URI → 尝试连 MongoDB；连接失败降级内存，绝不让进程崩溃
  if (config.mongoUri) {
    try {
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
      console.log("[db] MongoDB 已连接，使用持久化存储");
      return createMongoStore();
    } catch (err) {
      console.error(`[db] MongoDB 连接失败（${err.message}），降级为内存存储`);
    }
  } else {
    console.warn("[db] 未配置 MONGODB_URI");
  }

  console.warn("[db] 当前使用内存存储（重启数据丢失，仅适合本地调试）");
  return createMemoryStore();
}
