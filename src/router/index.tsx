import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";

// 集中式路由配置
export const router = createBrowserRouter([
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
