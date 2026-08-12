import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 项目页部署路径（https://gecaitao.github.io/my-react/）
  base: "/my-react/",
});
