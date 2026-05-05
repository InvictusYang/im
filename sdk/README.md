# P2PChat SDK 使用文档

## 📦 安装

### 方式一：CDN（推荐用于 H5）

```html
<script src="https://im.yourmall.com/sdk/p2pchat-sdk.js"></script>
<script>
  const p2pchat = new P2PChatSDK({ ... });
</script>
```

### 方式二：NPM（推荐用于 React/Vue 项目）

```bash
npm install p2pchat-sdk
```

```javascript
import P2PChatSDK from 'p2pchat-sdk';
```

---

## 🚀 快速开始

### 1. 初始化

```javascript
const p2pchat = new P2PChatSDK({
  serverUrl: 'https://im.yourmall.com',
  userId: 'user_12345',
  token: 'your_jwt_token'
});
```

### 2. 连接服务

```javascript
await p2pchat.connect();
console.log('连接成功！');
```

### 3. 发送消息

```javascript
// 发送文本
p2pchat.sendMessage('room_id', '您好，有什么可以帮助您的吗？');

// 发送带订单号的消息
p2pchat.sendMessage('room_id', '关于您的订单...', {
  orderId: 'ORDER_20240101001'
});
```

### 4. 发送图片

```javascript
// 选择图片后发送
const fileInput = document.getElementById('imageInput');
fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  await p2pchat.sendImage('room_id', file, {
    orderId: 'ORDER_123'
  });
};
```

### 5. 监听消息

```javascript
// 接收新消息
p2pchat.on('message', (msg) => {
  console.log('收到消息:', msg);
  
  // 显示消息
  displayMessage(msg);
});

// 监听用户上线
p2pchat.on('userOnline', (data) => {
  console.log('用户上线:', data.userId);
});

// 监听房间创建
p2pchat.on('roomCreated', (data) => {
  console.log('房间创建成功:', data.roomId);
  p2pchat.joinRoom(data.roomId);
});
```

---

## 📚 完整 API 文档

### 构造函数

```javascript
new P2PChatSDK(options)
```

**参数：**
- `options.serverUrl` (string) - IM 服务器地址
- `options.userId` (string) - 用户 ID
- `options.token` (string) - JWT Token

---

### connect()

连接到 IM 服务。

```javascript
await p2pchat.connect();
```

**返回：** Promise

---

### sendMessage(roomId, content, options?)

发送消息。

**参数：**
- `roomId` (string) - 房间 ID
- `content` (string) - 消息内容
- `options` (object) - 可选参数
  - `type` (string) - 消息类型：'text' | 'image'
  - `orderId` (string) - 订单号
  - `fileUrl` (string) - 图片 URL（type 为 image 时需要）

**示例：**
```javascript
p2pchat.sendMessage('room_123', '您好！', {
  orderId: 'ORDER_456'
});
```

---

### sendImage(roomId, file, options?)

发送图片消息。

**参数：**
- `roomId` (string) - 房间 ID
- `file` (File) - 图片文件
- `options` (object) - 可选参数
  - `orderId` (string) - 订单号

**示例：**
```javascript
const file = document.querySelector('input[type=file]').files[0];
await p2pchat.sendImage('room_123', file, {
  orderId: 'ORDER_456'
});
```

---

### getMessages(roomId, options?)

获取房间消息历史。

**参数：**
- `roomId` (string) - 房间 ID
- `options` (object) - 可选参数
  - `limit` (number) - 消息数量，默认 50
  - `offset` (number) - 偏移量，默认 0

**返回：** Promise<Array>

**示例：**
```javascript
const messages = await p2pchat.getMessages('room_123', {
  limit: 50,
  offset: 0
});

console.log(messages);
// [
//   { id, room_id, sender_id, type, content, order_id, created_at },
//   ...
// ]
```

---

### getRooms()

获取用户的房间列表。

**返回：** Promise<Array>

**示例：**
```javascript
const rooms = await p2pchat.getRooms();
console.log(rooms);
// [
//   { id, type, unread_count, message_count },
//   ...
// ]
```

---

### createDirectRoom(targetUserId)

创建一对一聊天房间。

**参数：**
- `targetUserId` (string) - 目标用户 ID

**示例：**
```javascript
p2pchat.createDirectRoom('customer_service_001');

p2pchat.on('roomCreated', (data) => {
  console.log('房间创建成功:', data.roomId);
  p2pchat.joinRoom(data.roomId);
});
```

---

### joinRoom(roomId)

加入房间。

**参数：**
- `roomId` (string) - 房间 ID

**示例：**
```javascript
p2pchat.joinRoom('room_123');
```

---

### searchMessages(keyword, options?)

搜索消息。

**参数：**
- `keyword` (string) - 搜索关键词
- `options` (object) - 可选参数
  - `roomId` (string) - 限定房间
  - `limit` (number) - 结果数量

**返回：** Promise<Array>

**示例：**
```javascript
const results = await p2pchat.searchMessages('订单', {
  limit: 20
});
```

---

### on(event, callback)

监听事件。

**参数：**
- `event` (string) - 事件名称
- `callback` (Function) - 回调函数

**支持的事件：**
- `message` - 收到新消息
- `userOnline` - 用户上线
- `userOffline` - 用户下线
- `roomCreated` - 房间创建成功
- `reconnect` - 重连成功

**示例：**
```javascript
p2pchat.on('message', (msg) => {
  console.log('收到消息:', msg.content);
});
```

---

### off(event, callback)

移除事件监听。

**参数：**
- `event` (string) - 事件名称
- `callback` (Function) - 回调函数

---

### disconnect()

断开连接。

```javascript
p2pchat.disconnect();
```

---

## 💻 完整示例

### React 组件

```jsx
import { useEffect, useState } from 'react';
import P2PChatSDK from 'p2pchat-sdk';

function ChatWindow({ user, orderId }) {
  const [p2pchat, setP2pchat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const sdk = new P2PChatSDK({
      serverUrl: 'https://im.yourmall.com',
      userId: user.id,
      token: user.im_token
    });

    sdk.connect().then(() => {
      sdk.on('message', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
    });

    setP2pchat(sdk);

    return () => sdk.disconnect();
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    sdk.sendMessage('room_id', newMessage, { orderId });
    setNewMessage('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.sender_username}:</strong>
            {msg.type === 'image' ? (
              <img src={msg.file_url} alt="图片" />
            ) : (
              <span>{msg.content}</span>
            )}
            {msg.order_id && <small>📦 {msg.order_id}</small>}
          </div>
        ))}
      </div>
      
      <div className="input">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>发送</button>
      </div>
    </div>
  );
}
```

### Vue 组件

```vue
<template>
  <div class="chat">
    <div class="messages">
      <div v-for="msg in messages" :key="msg.id">
        <strong>{{ msg.sender_username }}:</strong>
        <span v-if="msg.type === 'image'">
          <img :src="msg.file_url" />
        </span>
        <span v-else>{{ msg.content }}</span>
      </div>
    </div>
    
    <div class="input">
      <input v-model="newMessage" @keyup.enter="sendMessage" />
      <button @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script>
import P2PChatSDK from 'p2pchat-sdk';

export default {
  props: ['user', 'orderId'],
  data() {
    return {
      p2pchat: null,
      messages: [],
      newMessage: ''
    };
  },
  mounted() {
    this.p2pchat = new P2PChatSDK({
      serverUrl: 'https://im.yourmall.com',
      userId: this.user.id,
      token: this.user.im_token
    });

    this.p2pchat.connect().then(() => {
      this.p2pchat.on('message', (msg) => {
        this.messages.push(msg);
      });
    });
  },
  beforeDestroy() {
    if (this.p2pchat) {
      this.p2pchat.disconnect();
    }
  },
  methods: {
    sendMessage() {
      if (!this.newMessage.trim()) return;
      
      this.p2pchat.sendMessage('room_id', this.newMessage, {
        orderId: this.orderId
      });
      
      this.newMessage = '';
    }
  }
};
</script>
```

---

## 🔒 安全建议

1. **Token 管理**：不要在客户端硬编码 Token
2. **HTTPS**：生产环境必须使用 HTTPS
3. **Token 刷新**：定期刷新 JWT Token
4. **错误处理**：妥善处理连接失败等异常情况

---

## 📦 TypeScript 支持

```typescript
import P2PChatSDK from 'p2pchat-sdk';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  type: 'text' | 'image';
  content: string;
  order_id?: string;
  file_url?: string;
  created_at: string;
}

const p2pchat = new P2PChatSDK({
  serverUrl: 'https://im.yourmall.com',
  userId: 'user_123',
  token: 'token'
});

p2pchat.on('message', (msg: Message) => {
  console.log(msg.content);
});
```

---

## 🆘 常见问题

**Q: 如何获取 Token？**
A: 通过调用后端 `/api/auth/login` 接口获取。

**Q: 如何知道房间 ID？**
A: 使用 `getRooms()` 获取，或在创建房间时监听 `roomCreated` 事件。

**Q: 支持群聊吗？**
A: 当前版本支持一对一聊天，群聊功能开发中。

---

**需要帮助？** 查看 `INTEGRATION_GUIDE.md` 或提交 Issue。
