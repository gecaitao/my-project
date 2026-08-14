/**
 * MongoDB 管理脚本（Zeabur「数据库」标签收费时的免费替代）
 * -------------------------------------------------------------------
 * 复用 server/node_modules 里的 mongodb 驱动，本地连接线上 MongoDB。
 *
 * 用法（在 server/ 目录运行）：
 *   node mongo-manage.mjs "<MONGODB_URI>" list             # 列出所有集合
 *   node mongo-manage.mjs "<MONGODB_URI>" messages         # 查看最近 20 条消息
 *   node mongo-manage.mjs "<MONGODB_URI>" users            # 查看用户列表
 *   node mongo-manage.mjs "<MONGODB_URI>" clear-messages   # 清空 messages（慎用）
 *
 * 示例：
 *   node mongo-manage.mjs "mongodb://mongo:你的密码@43.133.160.98:31747" list
 *
 * ⚠️ 连接串包含密码，只在你自己的终端里使用，别提交到代码或聊天。
 */
import { MongoClient } from "mongodb";

const uri = process.argv[2];
const cmd = process.argv[3] || "list";

if (!uri) {
  console.error(
    '用法: node mongo-manage.mjs "<MONGODB_URI>" [list|messages|users|clear-messages]',
  );
  process.exit(1);
}

// 数据库名：从 uri 路径取，无则默认 my-project
const dbName = (() => {
  try {
    const m = uri.match(/\/\/([^/]+)\/([^?]+)/);
    return m ? m[2] : "my-project";
  } catch {
    return "my-project";
  }
})();

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const db = client.db(dbName);

  if (cmd === "list") {
    const cols = await db.listCollections().toArray();
    console.log(`数据库: ${dbName}`);
    console.log("集合列表:", cols.map((c) => c.name).join(", ") || "(空)");
  } else if (cmd === "messages") {
    const docs = await db
      .collection("messages")
      .find({})
      .sort({ createdAt: 1 })
      .limit(20)
      .toArray();
    console.log(`messages 共显示 ${docs.length} 条（最近 20）:`);
    docs.forEach((d, i) => {
      const role = d.role ?? "?";
      const text = (d.text ?? "").slice(0, 60);
      const uid = d.userId ? String(d.userId).slice(0, 8) : "null";
      console.log(`[${i + 1}] ${role} | user:${uid} | ${text}`);
    });
  } else if (cmd === "users") {
    const docs = await db.collection("users").find({}).limit(20).toArray();
    console.log(`users 共 ${docs.length} 个:`);
    docs.forEach((d) => {
      console.log(`- id:${String(d._id).slice(0, 8)} | email:${d.email} | name:${d.name || ""}`);
    });
  } else if (cmd === "clear-messages") {
    const r = await db.collection("messages").deleteMany({});
    console.log(`已删除 messages ${r.deletedCount} 条`);
  } else {
    console.error(`未知命令: ${cmd}`);
    process.exit(1);
  }
} catch (err) {
  console.error("连接/操作失败:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
