# my-project 后端镜像（供 Zeabur 以 Dockerfile 方式构建部署）
# 若 Zeabur 报 "Dockerfile is required for arbitrary Git sources"，即用此方式构建
FROM node:20-alpine

WORKDIR /app

# 先复制依赖清单，利用层缓存加速构建
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 复制源码
COPY . .

# 运行端口（Zeabur 会自动注入 PORT；本地默认 3000）
ENV PORT=3000
EXPOSE 3000

# 生产启动（node src/index.js）
CMD ["npm", "start"]
