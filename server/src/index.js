import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import messageRoutes from "./routes/messages.js";
import chatRoutes from "./routes/chat.js";

const app = express();

// CORS：配置了白名单则只放行指定来源，否则允许所有（开发）
app.use(
  cors({
    origin: config.allowedOrigins.length ? config.allowedOrigins : true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// 请求日志
if (config.logRequests) {
  app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

// 健康检查
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 业务路由
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat", chatRoutes);

// 统一 404
app.use((_req, res) => res.status(404).json({ error: "接口不存在" }));

// 统一错误处理
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "服务器内部错误" });
});

// 初始化存储并启动
const store = await initDb();
app.locals.store = store;

app.listen(config.port, () => {
  console.log(`my-project 后台已启动: http://localhost:${config.port}  (存储: ${store.mode})`);
  if (!config.deepseekApiKey) {
    console.warn("⚠️  未配置 DEEPSEEK_API_KEY，/api/chat 将不可用");
  }
  if (!config.mongoUri) {
    console.warn("⚠️  未配置 MONGODB_URI，使用内存存储（重启丢数据，仅本地调试）");
  }
});
