// Firebase 初始化配置
// 官方文档：https://firebase.google.com/docs/web/setup
// Firebase 配置按环境从统一配置模块读取（develop / product 使用各自的项目）
// 配置来源：.env.develop / .env.product 文件
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { env } from "@/config/env";

const app = initializeApp(env.firebase);

// 导出 Firestore 数据库实例，供组件使用
export const db = getFirestore(app);
