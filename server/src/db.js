import mongoose from "mongoose";
import { config } from "./config.js";

/**
 * 存储层：支持两种后端
 *  - mongo：生产用 MongoDB（Mongoose），数据持久化
 *  - memory：本地调试用（无 Mongo 时自动启用），重启丢数据
 *
 * 对外暴露统一接口 store：
 *   store.users.create({ email, passwordHash, name }) -> user
 *   store.users.findByEmail(email) -> user | null
 *   store.messages.create({ role, text, userId }) -> message
 *   store.messages.list() -> message[]
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

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    userId: { type: String, default: null }, // 登录后写入；未登录为 null
  },
  { timestamps: true },
);

const UserModel = mongoose.model("User", userSchema);
const MessageModel = mongoose.model("Message", messageSchema);

// ============ 内存模式（本地调试降级） ============
let memUsers = [];
let memMessages = [];
let memUserId = 0;
let memMsgId = 0;

// ============ 工厂：根据配置返回 store ============
export async function initDb() {
  if (config.mongoUri) {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[db] MongoDB 已连接: ${config.mongoUri}`);
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
      messages: {
        async create({ role, text, userId = null }) {
          const doc = await MessageModel.create({ role, text, userId });
          return { id: String(doc._id), role: doc.role, text: doc.text };
        },
        async list() {
          const docs = await MessageModel.find().sort({ createdAt: 1 });
          return docs.map((d) => ({
            id: String(d._id),
            role: d.role,
            text: d.text,
          }));
        },
      },
    };
  }

  console.warn("[db] 未配置 MONGODB_URI，使用内存存储（仅本地调试，重启丢数据）");
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
    messages: {
      async create({ role, text, userId = null }) {
        const msg = { id: String(++memMsgId), role, text, userId, createdAt: Date.now() };
        memMessages.push(msg);
        return { id: msg.id, role: msg.role, text: msg.text };
      },
      async list() {
        return memMessages
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((m) => ({ id: m.id, role: m.role, text: m.text }));
      },
    },
  };
}
