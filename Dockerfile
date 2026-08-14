# my-project 后端镜像（仓库根目录版）
# Zeabur 以 "arbitrary Git source" 连接时只认根目录 Dockerfile，此文件构建 server/ 子目录为后端服务
FROM node:20-alpine

WORKDIR /app

# 复制 server 的依赖清单（利用层缓存）
COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev

# 复制 server 源码
COPY server/ ./

# 运行端口（Zeabur 自动注入 PORT；默认 3000）
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
