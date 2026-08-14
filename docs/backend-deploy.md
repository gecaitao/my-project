# Node 后台部署指南（Zeabur）

> 你的完整后端：Express + MongoDB + JWT 注册登录 + DeepSeek 聊天代理。
> 前端（GitHub Pages）通过 `VITE_API_BASE_URL` 调用本后台，DeepSeek Key 只存在后台环境变量里。

## 架构

```text
React 前端 (GitHub Pages)
   │  VITE_API_BASE_URL 指向后台
   ▼
Node 后台 (Zeabur)  ──▶  MongoDB (Zeabur 自带服务)
   │  DEEPSEEK_API_KEY 在此
   ▼
DeepSeek API
```

## 一、本地开发

```powershell
cd d:\my-project\server
copy .env.example .env      # 填写 DEEPSEEK_API_KEY 等（.env 已被 gitignore）
npm install
npm run dev                 # 启动于 http://localhost:3000
```

- 本地未配置 `MONGODB_URI` 时使用**内存存储**（重启丢数据，仅调试）。
- 前端开发环境 `.env.develop` 的 `VITE_API_BASE_URL=http://localhost:3000/api` 已指向它。

## 二、部署到 Zeabur（免费额度，国内可访问）

### 1. 准备账号与仓库

1. 注册 [zeabur.com](https://zeabur.com)。
2. 把本仓库推送到 GitHub（包含 `server/` 和根目录 `zeabur.toml`）。

### 2. 创建项目并部署后端

1. Zeabur 控制台 → **新建项目** → **创建服务**。
2. 选 **GitHub** → 授权 → 选择 `my-project` 仓库。
3. 服务目录填 `server`（或让 `zeabur.toml` 自动识别）。
4. Zeabur 会自动 `npm install` 并按 `package.json` 的 `start` 启动。

> 💡 如果 Zeabur 报错 `Dockerfile is required for arbitrary Git sources`（未能自动识别 Node 项目）：
> 项目已内置 `server/Dockerfile`，Zeabur 会自动改走 **Dockerfile 方式**构建（`node:20-alpine` + `npm start`）。
> 只需重新触发部署（或删除服务重建、重新选择该 Git 源）即可，无需其它改动。

### 3. 创建数据库

1. 在项目里 **新建服务** → 选 **MongoDB**（Zeabur 模板）。
2. 等服务就绪，复制它的连接串（形如 `mongodb://...`）。

### 4. 配置环境变量（关键）

在 **server 服务** 的「Variables」里添加：

| 变量 | 值 | 说明 |
|---|---|---|
| `MONGODB_URI` | 上面复制的连接串 | 必须，否则用内存存储 |
| `DEEPSEEK_API_KEY` | `sk-...` | 你的 DeepSeek Key（放后台，前端不碰） |
| `JWT_SECRET` | 一段随机长字符串 | 登录令牌签名密钥 |
| `ALLOWED_ORIGIN` | `https://gecaitao.github.io` | 只允许你的前端跨域，防盗用 |
| `PORT` | `3000` | 可选，Zeabur 通常自动注入 |

改完变量后 Zeabur 会自动重新部署。

### 5. 拿到公网地址

服务「Domains」页会给出 `https://xxx.zeabur.app`。复制它。

### 6. 让前端指向它

编辑 `.env.product`：

```env
VITE_API_BASE_URL=https://xxx.zeabur.app/api
```

然后 `git push` 触发 GitHub Actions 重新构建部署前端。

## 三、接口一览

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/health` | 健康检查 | 无 |
| POST | `/api/auth/register` | 注册 `{ email, password, name? }` | 无 |
| POST | `/api/auth/login` | 登录 `{ email, password }` → 返回 token | 无 |
| GET | `/api/auth/me` | 当前用户 | Bearer token |
| GET | `/api/conversations` | 当前用户的对话列表 | Bearer token |
| POST | `/api/conversations` | 新建对话 `{ title? }` | Bearer token |
| PATCH | `/api/conversations/:id` | 重命名对话 `{ title }` | Bearer token |
| DELETE | `/api/conversations/:id` | 删除对话（连带其消息） | Bearer token |
| GET | `/api/messages?conversationId=x` | 某对话的消息 | Bearer token |
| POST | `/api/messages` | 存消息 `{ role, text, conversationId }` | Bearer token |
| POST | `/api/chat` | AI 聊天（SSE 流式）`{ messages, conversationId }` | Bearer token |

## 四、验证部署成功

```powershell
curl.exe https://xxx.zeabur.app/api/health
# → {"ok":true}
```

也可在本地跑冒烟测试（需后端已启动）：

```powershell
node scripts/server-smoke-test.mjs
```

## 五、常见问题

| 现象 | 处理 |
|---|---|
| 前端跨域报错 | 检查 server 服务 `ALLOWED_ORIGIN` 是否包含你的前端域名 |
| `/api/chat` 返回 500「未配置 DEEPSEEK_API_KEY」 | 没在后台设置该环境变量 |
| 数据重启丢失 | `MONGODB_URI` 未配置，还在用内存存储 |
| 登录 401 | `JWT_SECRET` 改变导致旧 token 失效，重新登录即可 |
