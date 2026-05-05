# P2PChat - 轻量级即时通讯系统

一个基于 Node.js + React + Socket.IO 的现代化即时通讯应用，支持一对一聊天、群组聊天、图片发送等功能。

## ✨ 特性

- 🚀 **开箱即用** - 5 分钟启动，零配置数据库
- 💬 **实时通信** - 基于 Socket.IO 的双向通信
- 📸 **图片发送** - 自动压缩，节省存储空间
- 🔒 **安全认证** - JWT + bcrypt 密码加密
- 💾 **消息持久化** - SQLite + WAL 模式，高性能
- 🔍 **全文搜索** - FTS5 索引，快速搜索历史消息
- 📱 **响应式设计** - 支持桌面和移动端
- 🔄 **断线重连** - 自动重连 + 离线消息同步

## 🛠 技术栈

### 后端
- **Node.js** + Express - Web 框架
- **Socket.IO** - 实时双向通信
- **Better-SQLite3** - 高性能 SQLite 客户端
- **JWT** - 用户认证
- **Sharp** - 图片压缩

### 前端
- **React 18** - UI 框架
- **Socket.IO Client** - 实时通信
- **Axios** - HTTP 请求
- **Vite** - 构建工具

## 📦 快速开始

### 方式一：一键启动（推荐）

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

1. **安装依赖**
```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件（可选）
```

3. **启动服务**
```bash
# 同时启动前后端
npm run dev:full

# 或分别启动
npm run dev        # 后端 (端口 3000)
npm run client     # 前端 (端口 3001)
```

4. **访问应用**
- 前端：http://localhost:3001
- 后端 API：http://localhost:3000

## 📁 项目结构

```
p2pchat/
├── src/                    # 后端源代码
│   ├── database.js        # 数据库配置（含 WAL 优化）
│   ├── socket.js          # Socket.IO 处理器
│   └── routes/            # API 路由
│       ├── auth.js        # 认证路由
│       ├── messages.js    # 消息路由
│       └── upload.js      # 上传路由
├── client/                # 前端源代码
│   └── src/
│       ├── components/    # React 组件
│       │   ├── Login.jsx
│       │   ├── Chat.jsx
│       │   ├── RoomList.jsx
│       │   └── MessageArea.jsx
│       └── utils/
│           └── api.js     # Axios 配置
├── data/                  # SQLite 数据库（自动创建）
├── uploads/              # 上传文件（自动创建）
│   ├── avatars/          # 用户头像
│   ├── chat_images/      # 聊天图片
│   └── files/            # 其他文件
├── .env                  # 环境变量
├── server.js            # 后端入口
└── package.json         # 项目配置
```

## 🔧 配置说明

### 环境变量（.env）

```env
# 服务器配置
PORT=3000                  # 后端端口
NODE_ENV=development       # 运行环境

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your-secret-key

# 数据库路径
DB_PATH=./data/chat.db

# 文件上传
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880      # 5MB

# 前端地址
CLIENT_URL=http://localhost:3001
```

## 📊 数据库优化

项目已启用以下 SQLite 优化：

1. **WAL 模式** - 写并发提升 5-10 倍
2. **64MB 缓存** - 加速查询
3. **索引优化** - 消息查询 < 50ms
4. **FTS5 全文搜索** - 搜索 10 万条消息 < 100ms

## 🎯 功能清单

### 已实现
- ✅ 用户注册/登录
- ✅ JWT 认证
- ✅ 一对一聊天
- ✅ 群组聊天
- ✅ 消息持久化
- ✅ 图片发送（自动压缩）
- ✅ 历史消息分页加载
- ✅ 离线消息同步
- ✅ 断线重连
- ✅ 输入状态提示
- ✅ 在线状态
- ✅ 消息已读回执
- ✅ 全文搜索

### 待实现
- ⏳ 消息撤回
- ⏳ 表情支持
- ⏳ 语音/视频通话
- ⏳ 消息通知（浏览器推送）

## 🚀 性能指标

| 指标 | 数值 |
|------|------|
| 支持并发用户 | < 5,000 |
| 日消息量 | < 10 万条 |
| 消息查询延迟 | < 50ms |
| 图片压缩率 | 60-80% |
| 数据库大小 | 建议 < 10GB |

## 📝 API 文档

### 认证接口

**注册**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456",
  "displayName": "Test User"
}
```

**登录**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456"
}
```

### 消息接口

**获取房间列表**
```http
GET /api/messages/rooms
Authorization: Bearer <token>
```

**获取房间消息**
```http
GET /api/messages/rooms/:roomId/messages?limit=50&offset=0
Authorization: Bearer <token>
```

**搜索消息**
```http
GET /api/messages/search?q=关键词&roomId=房间ID
Authorization: Bearer <token>
```

**获取离线消息**
```http
GET /api/messages/offline?since=2024-01-01T00:00:00Z
Authorization: Bearer <token>
```

### 上传接口

**上传图片**
```http
POST /api/upload/image
Content-Type: multipart/form-data

image: <file>
```

**上传头像**
```http
POST /api/upload/avatar
Content-Type: multipart/form-data

avatar: <file>
```

## 🔐 安全建议

1. **生产环境必须修改 JWT_SECRET**
2. **启用 HTTPS**（使用 Nginx 反向代理）
3. **定期备份数据库**（data/chat.db）
4. **限制上传文件大小**（默认 5MB）
5. **定期清理过期图片**

## 🐛 常见问题

**Q: 启动时提示找不到模块？**
A: 运行 `npm install` 安装依赖。

**Q: 数据库文件在哪里？**
A: `./data/chat.db`（首次启动自动创建）

**Q: 如何重置数据库？**
A: 删除 `./data/chat.db` 文件，重启服务自动重建。

**Q: 图片上传失败？**
A: 检查 `uploads/` 目录权限，确保有写入权限。

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**Enjoy P2PChat! 🚀**
