/**
 * 统一环境配置模块
 * -------------------------------------------------------------------
 * 通过 Vite 的 import.meta.env 读取构建时注入的环境变量。
 * 不同环境（develop / product）加载对应的 .env 文件：
 *   - 开发环境：.env.develop
 *   - 生产环境：.env.product
 * 全项目统一从本模块读取常量，避免散落使用 import.meta.env。
 *
 * 用法示例：
 *   import { env } from "@/config/env";
 *   console.log(env.mode, env.apiBaseUrl, env.firebase.projectId);
 */
import type { FirebaseOptions } from "firebase/app";

/** 当前支持的环境模式 */
export type AppMode = "develop" | "product";

const mode: AppMode =
  import.meta.env.VITE_APP_MODE === "product" ? "product" : "develop";

/**
 * 环境相关常量集合
 * 这里统一存放不同环境下会变化的常量（API 地址、Firebase 配置等），
 * 后续如需新增环境差异化配置，请在此处扩展。
 */
export const env = {
  /** 当前环境模式：develop | product */
  mode,

  /** 是否为开发环境 */
  isDevelop: mode === "develop",

  /** 是否为生产环境 */
  isProduct: mode === "product",

  /** 应用名称（所有环境通用） */
  appName: import.meta.env.VITE_APP_NAME,

  /** 应用标题（浏览器标签页等） */
  appTitle: import.meta.env.VITE_APP_TITLE,

  /** 后端 API 请求地址（不同环境指向不同服务器） */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,

  /** Firebase 配置（不同环境对应不同的 Firebase 项目） */
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  } satisfies FirebaseOptions,
} as const;

export default env;
