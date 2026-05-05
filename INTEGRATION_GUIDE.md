# P2PChat 集成指南 - 商场客服 IM 服务

## 📋 概述

P2PChat 是一个轻量级即时通讯服务，专为商场客服场景设计，支持：
- ✅ 客服与用户一对一聊天
- ✅ 文本消息
- ✅ 图片消息
- ✅ 订单号关联
- ✅ 浏览器通知
- ✅ 消息持久化

---

## 🚀 部署方案

### 方案一：独立服务部署（推荐）

**架构：**
```
商场前端 (React/Vue)          P2PChat IM 服务
     │                              │
     │─── HTTP API ────────────────→│  (注册/登录/消息查询)
     │─── WebSocket ───────────────→│  (实时通信)
     │                              │
     │                              │─── SQLite ───→ 数据存储
     │                              │─── 文件系统 ──→ 图片存储
```

**部署步骤：**

1. **服务器要求**
   - CPU: 1 核
   - 内存: 512MB
   - 磁盘: 10GB（根据消息量调整）
   - Node.js: 16+

2. **部署 P2PChat**
```bash
# 克隆或上传代码到服务器
cd /opt/p2pchat

# 安装依赖
npm install --production
cd client && npm install --production && cd ..

# 配置环境变量
cp .env.example .env
nano .env  # 修改配置

# 使用 PM2 启动
npm install -g pm2
pm2 start server.js --name p2pchat
pm2 save
pm2 startup
```

3. **配置 Nginx 反向代理**
```nginx
server {
    listen 80;
    server_name im.yourmall.com;

    # 前端静态文件
    location / {
        root /opt/p2pchat/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

### 方案二：嵌入现有项目

**如果你的商场是 React 项目：**

```bash
# 1. 将 P2PChat 作为子模块
cd your-mall-project
git submodule add <p2pchat-repo-url> src/im

# 2. 安装依赖
cd src/im && npm install

# 3. 在商场项目中导入聊天组件
```

---

## 💻 前端集成示例

### React 项目集成

#### 方式 1：使用独立服务（推荐）

```jsx
// src/components/CustomerServiceChat.jsx
import { useEffect, useState } from 'react'
import io from 'socket.io-client'
import axios from 'axios'

const IM_SERVICE_URL = 'https://im.yourmall.com'

function CustomerServiceChat({ user, orderId }) {
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [token, setToken] = useState(null)

  // 1. 登录 IM 服务
  useEffect(() => {
    const loginIM = async () => {
      try {
        // 使用商场后端生成的 JWT（或者直接注册）
        const res = await axios.post(`${IM_SERVICE_URL}/api/auth/login`, {
          username: user.id, // 使用商场用户ID
          password: user.im_password // 预设的 IM 密码
        })
        
        setToken(res.data.token)
        
        // 2. 连接 Socket
        const newSocket = io(IM_SERVICE_URL, {
          auth: { token: res.data.token }
        })
        
        newSocket.on('connect', () => {
          newSocket.emit('authenticate', res.data.token)
        })
        
        newSocket.on('message:new', (msg) => {
          setMessages(prev => [...prev, msg])
        })
        
        setSocket(newSocket)
        
        // 3. 查找或创建与客服的聊天房间
        const roomRes = await axios.get(`${IM_SERVICE_URL}/api/messages/rooms`, {
          headers: { Authorization: `Bearer ${res.data.token}` }
        })
        
        // 如果没有房间，创建一个新的
        if (roomRes.data.rooms.length === 0) {
          newSocket.emit('room:create:direct', {
            targetUserId: 'customer_service_001' // 客服ID
          })
        }
      } catch (error) {
        console.error('IM 登录失败:', error)
      }
    }
    
    if (user) loginIM()
    
    return () => {
      if (socket) socket.close()
    }
  }, [user])

  // 4. 发送消息
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return
    
    socket.emit('message:send', {
      roomId: currentRoomId,
      type: 'text',
      content: newMessage,
      orderId: orderId // 关联订单号
    })
    
    setNewMessage('')
  }

  // 5. 发送图片
  const sendImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)
    
    const res = await axios.post(`${IM_SERVICE_URL}/api/upload/image`, formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    })
    
    socket.emit('message:send', {
      roomId: currentRoomId,
      type: 'image',
      content: '图片',
      fileUrl: res.data.url,
      orderId: orderId
    })
  }

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender_id === user.id ? 'own' : 'other'}`}>
            {msg.type === 'image' ? (
              <img src={`${IM_SERVICE_URL}${msg.file_url}`} alt="图片" />
            ) : (
              <div>{msg.content}</div>
            )}
            {msg.order_id && <div className="order-tag">订单: {msg.order_id}</div>}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="输入消息..."
        />
        <button onClick={sendMessage}>发送</button>
        <input type="file" accept="image/*" onChange={e => sendImage(e.target.files[0])} />
      </div>
    </div>
  )
}

export default CustomerServiceChat
```

#### 使用示例：

```jsx
// 在订单详情页使用
function OrderDetailPage({ order }) {
  return (
    <div>
      <h1>订单详情</h1>
      {/* 订单信息 */}
      
      {/* 客服聊天窗口 */}
      <CustomerServiceChat 
        user={currentUser}
        orderId={order.id}
      />
    </div>
  )
}
```

---

### Vue 项目集成

```vue
<template>
  <div class="chat-window">
    <div class="messages">
      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.sender_id === user.id ? 'own' : 'other']">
        <img v-if="msg.type === 'image'" :src="`${IM_URL}${msg.file_url}`" />
        <div v-else>{{ msg.content }}</div>
        <div v-if="msg.order_id" class="order-tag">订单: {{ msg.order_id }}</div>
      </div>
    </div>
    
    <div class="input-area">
      <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="输入消息..." />
      <button @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client'
import axios from 'axios'

export default {
  props: ['user', 'orderId'],
  data() {
    return {
      socket: null,
      messages: [],
      newMessage: '',
      token: null,
      IM_URL: 'https://im.yourmall.com'
    }
  },
  mounted() {
    this.initIM()
  },
  methods: {
    async initIM() {
      // 登录 IM
      const res = await axios.post(`${this.IM_URL}/api/auth/login`, {
        username: this.user.id,
        password: this.user.im_password
      })
      
      this.token = res.data.token
      
      // 连接 Socket
      this.socket = io(this.IM_URL, {
        auth: { token: this.token }
      })
      
      this.socket.on('connect', () => {
        this.socket.emit('authenticate', this.token)
      })
      
      this.socket.on('message:new', (msg) => {
        this.messages.push(msg)
      })
    },
    
    sendMessage() {
      if (!this.newMessage.trim()) return
      
      this.socket.emit('message:send', {
        roomId: this.currentRoomId,
        type: 'text',
        content: this.newMessage,
        orderId: this.orderId
      })
      
      this.newMessage = ''
    }
  }
}
</script>
```

---

## 🔧 API 接口文档

### 认证接口

**用户登录**
```http
POST https://im.yourmall.com/api/auth/login
Content-Type: application/json

{
  "username": "user_12345",
  "password": "im_password"
}

# 响应
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "user_12345",
    "displayName": "用户名称"
  }
}
```

### 消息接口

**获取聊天房间列表**
```http
GET https://im.yourmall.com/api/messages/rooms
Authorization: Bearer <token>

# 响应
{
  "rooms": [
    {
      "id": "room_uuid",
      "type": "direct",
      "unread_count": 3
    }
  ]
}
```

**获取房间消息**
```http
GET https://im.yourmall.com/api/messages/rooms/:roomId/messages?limit=50&offset=0
Authorization: Bearer <token>

# 响应
{
  "messages": [
    {
      "id": "msg_uuid",
      "type": "text",
      "content": "你好",
      "order_id": "ORDER_12345",
      "sender_id": "user_uuid",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 上传接口

**上传图片**
```http
POST https://im.yourmall.com/api/upload/image
Content-Type: multipart/form-data
Authorization: Bearer <token>

image: <file>

# 响应
{
  "url": "/uploads/chat_images/xxx_compressed.jpg"
}
```

---

## 📦 商场后端集成

### Node.js 示例

```javascript
// 商场后端为用户创建 IM 账号
const axios = require('axios')

const IM_SERVICE = 'http://localhost:3000'

async function createIMAccount(user) {
  try {
    // 注册 IM 账号
    await axios.post(`${IM_SERVICE}/api/auth/register`, {
      username: `user_${user.id}`,
      password: generateIMPassword(user), // 生成 IM 密码
      displayName: user.nickname
    })
    
    // 保存 IM 密码到用户表
    await db.users.update({
      where: { id: user.id },
      data: { im_password: generateIMPassword(user) }
    })
  } catch (error) {
    console.error('创建 IM 账号失败:', error)
  }
}
```

### PHP 示例

```php
// 商场后端为用户创建 IM 账号
function createIMAccount($user) {
    $imService = 'http://localhost:3000';
    $imPassword = generateIMPassword($user);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$imService/api/auth/register");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'username' => 'user_' . $user['id'],
        'password' => $imPassword,
        'displayName' => $user['nickname']
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    // 保存 IM 密码
    $db->users->update($user['id'], ['im_password' => $imPassword]);
}
```

---

## 🎯 客服场景最佳实践

### 1. 客服账号管理

```javascript
// 预设客服账号
const CUSTOMER_SERVICE_ACCOUNTS = [
  { id: 'cs_001', username: '客服小王', status: 'online' },
  { id: 'cs_002', username: '客服小李', status: 'online' }
]

// 用户下单后自动创建聊天
async function createChatForOrder(order) {
  // 分配客服（轮询或负载均衡）
  const cs = getNextAvailableCS()
  
  // 创建聊天房间
  socket.emit('room:create:direct', {
    targetUserId: cs.id,
    orderId: order.id
  })
}
```

### 2. 订单号关联

```javascript
// 发送消息时关联订单
socket.emit('message:send', {
  roomId: roomId,
  type: 'text',
  content: '您好，关于您的订单...',
  orderId: 'ORDER_20240101001' // 关联订单号
})

// 前端显示订单标签
{message.order_id && (
  <div className="order-badge">
    📦 订单: {message.order_id}
    <a href={`/orders/${message.order_id}`}>查看</a>
  </div>
)}
```

### 3. 快捷回复模板

```javascript
const QUICK_REPLIES = [
  { label: '欢迎语', text: '您好！有什么可以帮助您的吗？' },
  { label: '发货时间', text: '您的订单将在24小时内发货，请耐心等待。' },
  { label: '退款说明', text: '退款将在3-5个工作日内原路返回。' },
  { label: '感谢语', text: '感谢您的支持，祝您购物愉快！' }
]

// 使用快捷回复
function QuickReplyButton({ text }) {
  return (
    <button onClick={() => sendMessage(text)}>
      {text}
    </button>
  )
}
```

---

## 🔒 安全建议

1. **JWT 密钥**：生产环境必须修改 `.env` 中的 `JWT_SECRET`
2. **HTTPS**：使用 Nginx 配置 SSL 证书
3. **跨域配置**：限制 `CLIENT_URL` 为你的商场域名
4. **文件大小**：限制图片上传大小（默认 5MB）
5. **频率限制**：添加消息发送频率限制（防刷）

---

## 📊 性能优化

1. **消息分页**：每次加载 50 条，滚动加载更多
2. **图片压缩**：自动压缩到 75% 质量
3. **数据库优化**：已启用 WAL 模式，支持高并发
4. **静态资源**：使用 CDN 加速图片访问

---

## 🆘 常见问题

**Q: 如何在商场用户注册时自动创建 IM 账号？**
A: 在用户注册成功后，调用 P2PChat 的 `/api/auth/register` 接口。

**Q: 如何实现客服分配？**
A: 可以使用轮询、负载均衡或基于技能组的分配策略。

**Q: 消息能保存多久？**
A: 默认永久保存，可以定期清理旧消息。

**Q: 支持多少并发用户？**
A: 单机支持 5000+ 日活用户，更多需要集群部署。

---

**需要帮助？** 查看 `README.md` 或提交 Issue。
