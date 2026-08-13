/// <reference types="vite/client" />

// 扩展 Vite 注入的环境变量类型，获得完整的类型提示与校验
// 这些变量来自 .env / .env.develop / .env.product 文件
interface ImportMetaEnv {
  /** 环境标识：develop | product */
  readonly VITE_APP_MODE: "develop" | "product";
  /** 应用名称 */
  readonly VITE_APP_NAME: string;
  /** 应用标题 */
  readonly VITE_APP_TITLE: string;
  /** 后端 API 请求地址 */
  readonly VITE_API_BASE_URL: string;

  /** DeepSeek API Key（本地演示用，生产环境请走后端代理） */
  readonly VITE_DEEPSEEK_API_KEY: string;

  /** Firebase API 密钥 */
  readonly VITE_FIREBASE_API_KEY: string;
  /** Firebase 认证域名 */
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  /** Firebase 项目 ID */
  readonly VITE_FIREBASE_PROJECT_ID: string;
  /** Firebase 存储桶 */
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  /** Firebase 消息发送者 ID */
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  /** Firebase 应用 ID */
  readonly VITE_FIREBASE_APP_ID: string;
  /** Firebase 统计 ID */
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
