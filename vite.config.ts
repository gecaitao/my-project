import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// mode 由启动命令决定（--mode develop / --mode product）
export default defineConfig(({ mode }) => {
  // 生产环境（product）部署到 GitHub Pages 项目页，需要子路径 base
  // 开发环境（develop）本地运行使用根路径
  const isProduct = mode !== "develop";

  return {
    plugins: [react()],
    // 路径别名：@/xxx → src/xxx（与 tsconfig.app.json 的 paths 保持一致）
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // GitHub Pages 项目页部署路径（https://gecaitao.github.io/my-project/）
    base: isProduct ? "/my-project/" : "/",
  };
});
