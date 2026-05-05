# P2PChat 企业级功能完整指南

## 📋 新增功能概览

✅ **1. 定时数据备份和归档**  
✅ **2. 管理员监控后台**  
✅ **3. SDK 封装**

---

## 1️⃣ 定时数据备份和归档

### 功能说明

- ✅ 每日自动备份 SQLite 数据库
- ✅ 归档 90 天前的聊天记录
- ✅ 自动清理 30 天前的旧备份
- ✅ 生成备份报告

### 使用方式

**手动备份：**
```bash
cd /opt/p2pchat
npm run backup
```

**定时备份（每天凌晨 2 点）：**
```bash
npm run backup:daily
```

**手动设置 crontab：**
```bash
crontab -e
# 添加以下行
0 2 * * * cd /opt/p2pchat && node scripts/backup.js >> logs/backup.log 2>&1
```

### 备份文件位置

```
data/
├── chat.db                          # 当前数据库
├── backups/                         # 备份目录
│   ├── chat_2024-01-01T02-00-00.db  # 数据库备份
│   ├── chat_2024-01-01T02-00-00_metadata.json
│   └── backup_report_2024-01-01.json
└── archives/                        # 归档目录
    └── messages_before_2023-10-01.json
```

### 备份报告示例

```json
{
  "backupDate": "2024-01-01T02:00:00.000Z",
  "database": {
    "path": "./data/chat.db",
    "size": "12.5 MB"
  },
  "backups": [
    {
      "file": "chat_2024-01-01T02-00-00.db",
      "size": "12.50 MB",
      "date": "2024-01-01T02:00:00.000Z"
    }
  ],
  "stats": {
    "totalBackups": 30,
    "totalArchives": 3,
    "retentionDays": 30,
    "archiveDays": 90
  }
}
```

---

## 2️⃣ 管理员监控后台

### 访问方式

```
https://im.yourmall.com/admin/
```

### 功能特性

#### 📊 实时统计面板
- 今日消息总数
- 文本/图片消息分布
- 活跃聊天室数量
- 活跃用户数
- 新增用户数

#### 📈 消息时段分布图
- 24 小时消息量可视化
- 帮助分析客服高峰时段

#### 💬 今日聊天室列表
- 显示所有今日活跃的聊天室
- 显示消息数量、成员数
- 点击可查看完整聊天记录

#### 🔍 高级搜索
- 按关键词搜索消息
- 按用户名搜索
- 按日期范围筛选
- 显示关联订单号

### API 接口

**获取今日统计：**
```http
GET /api/admin/stats/today
Authorization: Bearer <admin_token>
```

**获取今日聊天室：**
```http
GET /api/admin/rooms/today
Authorization: Bearer <admin_token>
```

**查看房间消息：**
```http
GET /api/admin/rooms/:roomId/messages?date=2024-01-01
Authorization: Bearer <admin_token>
```

**搜索聊天记录：**
```http
GET /api/admin/search?keyword=订单&username=user1&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_token>
```

### 管理员 Token 生成

```javascript
const jwt = require('jsonwebtoken');

const adminToken = jwt.sign(
  { 
    userId: 'admin_001',
    username: 'admin',
    role: 'admin'  // 必须是 admin
  },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

console.log(adminToken);
```

---

## 3️⃣ SDK 封装

### 安装方式

**方式一：CDN（H5 项目）**
```html
<script src="https://im.yourmall.com/sdk/p2pchat-sdk.js"></script>
```

**方式二：NPM（React/Vue 项目）**
```bash
npm install p2pchat-sdk
```

### 快速开始

```javascript
// 1. 初始化
const p2pchat = new P2PChatSDK({
  serverUrl: 'https://im.yourmall.com',
  userId: 'user_123',
  token: 'jwt_token'
});

// 2. 连接
await p2pchat.connect();

// 3. 发送消息
p2pchat.sendMessage('room_id', '您好！', {
  orderId: 'ORDER_123'
});

// 4. 监听消息
p2pchat.on('message', (msg) => {
  console.log('收到消息:', msg);
});
```

### 核心 API

| 方法 | 说明 | 示例 |
|------|------|------|
| `connect()` | 连接服务 | `await p2pchat.connect()` |
| `sendMessage()` | 发送消息 | `p2pchat.sendMessage(roomId, content, options)` |
| `sendImage()` | 发送图片 | `await p2pchat.sendImage(roomId, file)` |
| `getMessages()` | 获取历史消息 | `await p2pchat.getMessages(roomId)` |
| `getRooms()` | 获取房间列表 | `await p2pchat.getRooms()` |
| `on()` | 监听事件 | `p2pchat.on('message', callback)` |
| `disconnect()` | 断开连接 | `p2pchat.disconnect()` |

### 完整示例

详见：[sdk/README.md](sdk/README.md)

---

## 📁 项目结构（更新后）

```
p2pchat/
├── src/                          # 后端代码
│   ├── database.js              # 数据库
│   ├── socket.js                # Socket.IO
│   └── routes/
│       ├── auth.js              # 认证
│       ├── messages.js          # 消息
│       ├── upload.js            # 上传
│       └── admin.js             # ✨ 管理员接口
├── client/                      # 前端（测试用）
├── admin/                       # ✨ 管理员监控后台
│   └── index.html
├── sdk/                         # ✨ SDK
│   ├── p2pchat-sdk.js
│   └── README.md
├── scripts/                     # ✨ 工具脚本
│   └── backup.js                # 备份脚本
├── data/                        # 数据库
│   ├── chat.db
│   ├── backups/                 # 备份目录
│   └── archives/                # 归档目录
├── server.js
└── package.json
```

---

## 🎯 商场客服场景完整流程

### 1. 用户侧（手机 App/H5）

```javascript
// 用户打开订单详情页
function OrderDetailPage({ order }) {
  const p2pchat = new P2PChatSDK({
    serverUrl: 'https://im.yourmall.com',
    userId: currentUser.id,
    token: currentUser.im_token
  });

  // 联系客服
  async function contactService() {
    await p2pchat.connect();
    p2pchat.createDirectRoom('customer_service_001');
  }

  return (
    <div>
      <h1>订单 {order.id}</h1>
      <button onClick={contactService}>💬 联系客服</button>
    </div>
  );
}
```

### 2. 客服侧（PC 后台）

```javascript
// 客服工作台
function CSWorkspace() {
  const [conversations, setConversations] = useState([]);

  // 监听新对话
  p2pchat.on('roomCreated', (data) => {
    loadConversations();
  });

  return (
    <div>
      <h2>客服工作台</h2>
      {conversations.map(conv => (
        <ChatWindow 
          key={conv.id}
          roomId={conv.id}
          orderId={conv.orderId}
        />
      ))}
    </div>
  );
}
```

### 3. 管理员侧（监控后台）

```
访问 https://im.yourmall.com/admin/

功能：
✅ 查看今日所有聊天记录
✅ 搜索特定用户/订单的聊天
✅ 统计客服工作量
✅ 导出聊天数据
```

---

## 🔒 安全与合规

### 数据保护

1. **定期备份**：每日自动备份，防止数据丢失
2. **归档存储**：90 天后归档，长期保存
3. **访问控制**：管理员需要 Token 才能查看
4. **审计日志**：所有操作都有记录

### 合规要求

- ✅ 聊天记录可追溯
- ✅ 管理员可随时查看
- ✅ 数据可导出
- ✅ 备份可恢复

---

## 📊 运维指南

### 日常维护

```bash
# 查看备份状态
ls -lh data/backups/

# 查看备份报告
cat data/backups/backup_report_$(date +%Y-%m-%d).json

# 手动备份
npm run backup

# 查看服务状态
pm2 status
pm2 logs p2pchat
```

### 数据恢复

```bash
# 停止服务
pm2 stop p2pchat

# 恢复数据库
cp data/backups/chat_2024-01-01T02-00-00.db data/chat.db

# 重启服务
pm2 start p2pchat
```

### 清理旧数据

```bash
# 清理 30 天前的备份（自动）
node scripts/backup.js

# 手动清理归档
rm data/archives/messages_before_2023-01-01.json
```

---

## 🚀 部署清单

### 生产环境部署

- [ ] 配置环境变量 `.env`
- [ ] 设置定时备份 `npm run backup:daily`
- [ ] 配置 Nginx 反向代理
- [ ] 配置 SSL 证书
- [ ] 生成管理员 Token
- [ ] 测试管理员后台
- [ ] 集成 SDK 到前端项目
- [ ] 压力测试

### 环境变量配置

```env
# 基础配置
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-key

# 数据库
DB_PATH=./data/chat.db

# 备份配置
BACKUP_DIR=./data/backups
ARCHIVE_DIR=./data/archives
BACKUP_RETENTION_DAYS=30
ARCHIVE_DAYS=90

# 文件上传
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# 跨域
CLIENT_URL=https://yourmall.com
```

---

## 📈 性能优化建议

1. **数据库**：
   - 已启用 WAL 模式
   - 定期归档旧数据
   - 保持数据库文件 < 10GB

2. **备份**：
   - 每天凌晨 2 点执行
   - 保留 30 天备份
   - 监控磁盘空间

3. **监控**：
   - 使用管理员后台实时查看
   - 定期检查备份报告
   - 监控服务器资源

---

## 🎉 总结

P2PChat 现在具备完整的企业级 IM 服务能力：

✅ **核心功能**：单聊、文本、图片、订单关联  
✅ **数据保护**：定时备份、归档、恢复  
✅ **管理监控**：实时查看、搜索、统计  
✅ **开发友好**：SDK 封装、文档完善、示例丰富  

**完全满足商场客服场景需求！** 🚀
