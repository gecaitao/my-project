import "dotenv/config";

/**
 * 后台环境配置：统一从环境变量读取（server/.env 提供）
 */
export const config = {
  /** 服务端口 */
  port: Number(process.env.PORT) || 3000,

  /** MongoDB 连接串；留空则用内存存储（本地调试） */
  mongoUri: process.env.MONGODB_URI?.trim() || "",

  /** DeepSeek API Key（后台持有，前端不携带） */
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",

  /** JWT 签名密钥 */
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  /** 允许跨域的前端来源（逗号分隔）；留空 = 允许所有（仅开发） */
  allowedOrigins: (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** 是否打印请求日志 */
  logRequests: process.env.LOG_REQUESTS === "true",
};

export default config;
