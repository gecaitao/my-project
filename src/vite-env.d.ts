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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
