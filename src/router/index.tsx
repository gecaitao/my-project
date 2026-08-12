import { createHashRouter, Navigate } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";

// 集中式路由配置（Hash 模式：URL 形如 /my-react/#/，天然规避 GitHub Pages 深链接 404，无需 basename）
export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // 首页
      { index: true, element: <Home /> },
      // 未知路径重定向到首页
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
