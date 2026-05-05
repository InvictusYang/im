# P2PChat IM 服务 API 文档 v2.0

## 📋 概述

P2PChat 是一个企业级即时通信服务，支持：
- ✅ 商家撮合任意两个用户创建聊天室
- ✅ HMAC-SHA256 签名验证，防止伪造请求
- ✅ 防重放攻击（Nonce + 时间戳）
- ✅ WebSocket 实时通信
- ✅ 订单关联聊天

---

## 🔐 认证机制

### 1. 用户认证（JWT）

所有 API 请求需要在 Header 中携带 JWT Token：

```
Authorization: Bearer <jwt_token>
```

### 2. 商家房间创建签名验证

商家后端创建房间时，需要使用 HMAC-SHA256 签名：

```javascript
const crypto = require('crypto');

function generateSignature(userId1, userId2, secretKey) {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const data = `${userId1}:${userId2}:${timestamp}:${nonce}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('hex');
  
  return { timestamp, nonce, signature };
}
```

**签名验证规则：**
- ⏰ 时间戳有效期：5 分钟
- 🔒 Nonce 一次性使用（防止重放攻击）
- 🔑 使用商家密钥签名

---

## 📡 API 接口

### 1. 商家管理房间

#### 1.1 创建聊天房间

**端点：** `POST /api/merchant/rooms/create`

**权限：** 商家或管理员

**请求体：**
```json
{
  "userId1": "user_buyer_123",
  "userId2": "user_seller_456",
  "orderId": "ORDER_20240101_001",
  "metadata": {
    "productName": "iPhone 15 Pro",
    "orderAmount": 7999
  },
  "timestamp": 1704067200000,
  "nonce": "abc123def456",
  "signature": "hmac_sha256_signature_here",
  "merchantId": "merchant_001"
}
```

**响应：**
```json
{
  "roomId": "room_uuid",
  "room": {
    "id": "room_uuid",
    "type": "direct",
    "created_by": "merchant_001",
    "order_id": "ORDER_20240101_001",
    "metadata": "{\"productName\":\"iPhone 15 Pro\"}",
    "is_active": 1,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "isNew": true,
  "message": "房间创建成功"
}
```

**错误响应：**
```json
{
  "error": "请求已过期，时间戳必须在 5 分钟内"
}
```

---

#### 1.2 生成商家密钥

**端点：** `POST /api/merchant/keys/generate`

**权限：** 商家或管理员

**响应：**
```json
{
  "keyId": "key_uuid",
  "secretKey": "a1b2c3d4e5f6...",
  "message": "密钥生成成功，请妥善保存"
}
```

---

#### 1.3 获取商家房间列表

**端点：** `GET /api/merchant/rooms?limit=50&offset=0`

**权限：** 商家或管理员

**响应：**
```json
{
  "rooms": [
    {
      "id": "room_uuid",
      "type": "direct",
      "order_id": "ORDER_001",
      "metadata": "{}",
      "is_active": 1,
      "member_count": 2,
      "message_count": 15,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

#### 1.4 生成签名示例（开发测试用）

**端点：** `POST /api/merchant/signature/example`

**权限：** 商家或管理员

**请求体：**
```json
{
  "userId1": "user_123",
  "userId2": "user_456"
}
```

**响应：**
```json
{
  "userId1": "user_123",
  "userId2": "user_456",
  "timestamp": 1704067200000,
  "nonce": "abc123",
  "signature": "xyz789",
  "merchantId": "merchant_001",
  "message": "使用此签名创建房间"
}
```

---

### 2. 用户房间管理

#### 2.1 获取我的房间列表

**端点：** `GET /api/messages/rooms`

**权限：** 已认证用户

**响应：**
```json
{
  "rooms": [
    {
      "id": "room_uuid",
      "type": "direct",
      "order_id": "ORDER_001",
      "lastMessage": {
        "content": "你好",
        "created_at": "2024-01-01T00:00:00Z"
      },
      "unreadCount": 3,
      "members": [
        { "userId": "user_123", "role": "member" },
        { "userId": "user_456", "role": "member" }
      ]
    }
  ]
}
```

---

#### 2.2 获取房间消息

**端点：** `GET /api/messages/rooms/{roomId}/messages?limit=50&before={timestamp}`

**权限：** 房间成员

**响应：**
```json
{
  "messages": [
    {
      "id": "msg_uuid",
      "room_id": "room_uuid",
      "sender_id": "user_123",
      "type": "text",
      "content": "你好",
      "file_url": null,
      "order_id": "ORDER_001",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 3. WebSocket 事件

#### 3.1 连接认证

```javascript
socket.emit('authenticate', { token: 'jwt_token' });
```

**响应：**
```javascript
socket.on('authenticated', (data) => {
  console.log('认证成功:', data.userId);
});
```

---

#### 3.2 加入房间

```javascript
socket.emit('room:join', 'room_uuid');
```

**响应：**
```javascript
socket.on('room:joined', (data) => {
  console.log('已加入房间:', data.roomId);
});

socket.on('room:error', (data) => {
  console.log('加入失败:', data.error);
});
```

---

#### 3.3 发送消息

```javascript
socket.emit('message:send', {
  roomId: 'room_uuid',
  type: 'text',  // text | image | file
  content: '你好',
  orderId: 'ORDER_001',  // 可选
  fileUrl: 'https://...'  // 图片/文件 URL（type 为 image/file 时）
});
```

**接收消息：**
```javascript
socket.on('message:received', (message) => {
  console.log('收到消息:', message);
});
```

---

#### 3.4 房间创建通知

```javascript
// 监听新房间创建（商家撮合后）
socket.on('room:created', (data) => {
  console.log('新房间创建:', data.roomId);
  // 自动加入房间
  socket.emit('room:join', data.roomId);
});
```

---

## 🔧 集成指南

### 商家后端集成（Node.js 示例）

```javascript
const MerchantIMService = require('./examples/merchant-integration');

const imService = new MerchantIMService(
  'https://im.yourmall.com',
  'your_merchant_jwt_token',
  'your_secret_key'
);

// 创建聊天房间
const room = await imService.createChatRoom(
  'buyer_123',
  'seller_456',
  {
    orderId: 'ORDER_001',
    metadata: { productName: 'iPhone 15' }
  }
);

console.log('房间 ID:', room.roomId);
```

### 前端集成（浏览器）

```html
<script src="https://im.yourmall.com/socket.io/socket.io.js"></script>
<script src="p2pchat-sdk.js"></script>

<script>
const p2pchat = new P2PChatSDK({
  serverUrl: 'https://im.yourmall.com',
  userId: 'user_123',
  token: 'jwt_token'
});

// 连接
await p2pchat.connect();

// 监听新房间
p2pchat.onRoomCreated((data) => {
  console.log('收到新房间通知:', data.roomId);
});

// 监听消息
p2pchat.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});
</script>
```

---

## 🛡 安全最佳实践

### 1. 密钥管理

- ✅ 商家密钥只在服务端使用，**绝不暴露给前端**
- ✅ 使用环境变量存储密钥
- ✅ 定期轮换密钥
- ✅ 禁用不再使用的密钥

```bash
# .env 文件
MERCHANT_SECRET_KEY=a1b2c3d4e5f6...
```

---

### 2. 防止重放攻击

签名验证已内置防重放机制：

- ⏰ 时间戳验证（5 分钟有效期）
- 🔒 Nonce 一次性使用
- 🗑 24 小时自动清理旧 Nonce

---

### 3. 权限控制

- ✅ 用户只能加入自己有权限的房间
- ✅ 商家才能创建房间
- ✅ 房间成员才能发送消息

---

### 4. 速率限制

- 房间创建：每分钟最多 10 个
- 消息发送：每房间每分钟最多 60 条
- 文件上传：最大 5MB

---

## 📊 数据库结构

### rooms 表
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('direct', 'group')),
  created_by TEXT,              -- 创建者（商家或用户）
  order_id TEXT,                -- 关联订单号
  metadata TEXT,                -- JSON 元数据
  is_active INTEGER DEFAULT 1,  -- 是否活跃
  created_at DATETIME,
  updated_at DATETIME
);
```

### room_members 表
```sql
CREATE TABLE room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK(role IN ('creator', 'admin', 'member')),
  joined_at DATETIME,
  last_read_at DATETIME,        -- 最后阅读时间
  PRIMARY KEY (room_id, user_id)
);
```

### merchant_secrets 表
```sql
CREATE TABLE merchant_secrets (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME,
  expires_at DATETIME
);
```

### used_nonces 表
```sql
CREATE TABLE used_nonces (
  nonce TEXT PRIMARY KEY,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 快速开始

### 1. 商家首次使用

```bash
# 1. 生成密钥
curl -X POST https://im.yourmall.com/api/merchant/keys/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 保存返回的 secretKey
```

### 2. 创建聊天房间

```bash
# 1. 获取签名示例
curl -X POST https://im.yourmall.com/api/merchant/signature/example \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId1":"buyer_123","userId2":"seller_456"}'

# 2. 使用签名创建房间
curl -X POST https://im.yourmall.com/api/merchant/rooms/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId1": "buyer_123",
    "userId2": "seller_456",
    "orderId": "ORDER_001",
    "timestamp": 1704067200000,
    "nonce": "abc123",
    "signature": "xyz789",
    "merchantId": "merchant_001"
  }'
```

---

## 📞 技术支持

- 📧 邮箱：support@p2pchat.com
- 📖 文档：[DOCKER_QUICK_START.md](DOCKER_QUICK_START.md)
- 💬 示例代码：[examples/merchant-integration.js](examples/merchant-integration.js)

---

**版本：** v2.0  
**更新日期：** 2024-01-01  
**作者：** P2PChat Team
