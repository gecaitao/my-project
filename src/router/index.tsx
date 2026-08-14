import { createHashRouter, Navigate } from "react-router-dom";
import App from "@/App";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";

// 集中式路由配置（Hash 模式：URL 形如 /my-project/#/，天然规避 GitHub Pages 深链接 404，无需 basename）
export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // 默认路由：直接访问根路径时重定向到首页 /home
      { index: true, element: <Navigate to="/home" replace /> },
      // 首页
      { path: "home", element: <Home /> },
      // 聊天页
      { path: "chat", element: <Chat /> },
      // 登录/注册页
      { path: "login", element: <Login /> },
      // 未知路径重定向到首页
      { path: "*", element: <Navigate to="/home" replace /> },
    ],
  },
]);
