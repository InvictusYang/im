require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const database = require('./src/database');
const authRoutes = require('./src/routes/auth');
const messageRoutes = require('./src/routes/messages');
const uploadRoutes = require('./src/routes/upload');
const adminRoutes = require('./src/routes/admin');
const merchantRoutes = require('./src/routes/merchant');
const socketHandler = require('./src/socket');

const app = express();
const server = http.createServer(app);

// 进程异常处理（防止崩溃）
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 优雅关闭
  server.close(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// Socket.IO 配置
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.CLIENT_URL || 'http://localhost:3001')
      : '*',  // 开发环境允许所有来源
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_URL || 'http://localhost:3001')
    : '*',  // 开发环境允许所有来源
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sdk', express.static(path.join(__dirname, 'sdk')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));

// 确保必要目录存在
const dirs = ['data', 'uploads/avatars', 'uploads/chat_images', 'uploads/files'];
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// 初始化数据库
database.initialize();

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);  // 商家 API

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log(`✅ 用户连接: ${socket.id}`);
  socketHandler(io, socket);
});

// 注入 io 到 merchant 路由（房间创建通知）
const merchantModule = require('./src/routes/merchant');
if (merchantModule.setIO) {
  merchantModule.setIO(io);
}

// 错误处理
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 P2PChat 服务器已启动              ║
║   📡 端口: ${PORT}                      ║
║   🌍 环境: ${process.env.NODE_ENV || 'development'}             ║
║   💾 数据库: ${process.env.DB_PATH}       ║
╚════════════════════════════════════════╝
  `);
});

module.exports = { app, io, server };
