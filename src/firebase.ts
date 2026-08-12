// Firebase 初始化配置
// 官方文档：https://firebase.google.com/docs/web/setup
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: ⬇️ 替换成你自己的 Firebase 配置
// 获取方式：Firebase 控制台（console.firebase.google.com）
//   → 创建项目 → 添加应用（Web）→ 复制"firebaseConfig"对象

const firebaseConfig = {
  apiKey: "AIzaSyCi4OGiHg3B-Mr86Kezo5DUmlWbdqWYngY",
  authDomain: "my-react-25690.firebaseapp.com",
  projectId: "my-react-25690",
  storageBucket: "my-react-25690.firebasestorage.app",
  messagingSenderId: "265771769126",
  appId: "1:265771769126:web:985e48d457fbfd1b51f5e7",
  measurementId: "G-85F0LVQ01S",
};

const app = initializeApp(firebaseConfig);

// 导出 Firestore 数据库实例，供组件使用
export const db = getFirestore(app);
