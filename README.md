# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## 多环境配置

本项目支持 **develop（开发）** 与 **product（生产）** 两个环境，不同环境使用不同的常量与请求连接。

### 环境文件

| 文件 | 用途 |
| --- | --- |
| `.env` | 公共配置（所有环境共享） |
| `.env.develop` | 开发环境配置（API 地址、Firebase 开发项目等） |
| `.env.product` | 生产环境配置（API 地址、Firebase 生产项目等） |
| `.env.example` | 配置模板，新增变量时同步维护 |
| `.env.local` / `.env.*.local` | 本地覆盖文件（已被 gitignore，不会提交） |

> 说明：`.env.develop` / `.env.product` 中的 Firebase 配置为公开值，可提交；若后续引入真实密钥，请改用 GitHub Actions Secrets 注入或本地 `.env.product.local` 覆盖。

### 常用命令

```bash
# 开发环境运行（本地开发）
npm run dev

# 以生产环境配置运行开发服务器（用于本地预览生产配置）
npm run dev:product

# 生产环境构建（部署用）
npm run build

# 开发环境构建（产物 base 为根路径）
npm run build:develop

# 预览构建产物
npm run preview        # 生产产物
npm run preview:develop
```

### 在代码中读取环境常量

全项目统一从 `src/config/env.ts` 读取环境常量：

```ts
import { env } from "./config/env";

env.mode          // "develop" | "product"
env.isDevelop     // 是否为开发环境
env.apiBaseUrl    // 当前环境的 API 地址
env.firebase      // 当前环境的 Firebase 配置
```

如需新增环境差异化常量：先在 `.env.example` / `.env.develop` / `.env.product` 中添加 `VITE_*` 变量，再到 `src/env.d.ts` 补充类型、在 `src/config/env.ts` 中导出。

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
