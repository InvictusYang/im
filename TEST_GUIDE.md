# 🧪 P2PChat 快速测试指南

## ✅ 服务状态

- **后端服务**: ✅ 运行中
- **访问地址**: http://localhost:3000
- **数据库**: ./data/chat.db

---

## 🎯 测试步骤

### 方式一：测试完整商场集成示例（推荐）

1. **打开商场示例页面**
   ```
   在浏览器中打开：d:/p2pchat/examples/mall-demo.html
   ```

2. **注册第一个用户（模拟普通用户）**
   - 点击"没有账号？注册"
   - 用户名：`customer01`
   - 密码：`123456`
   - 显示名称：`测试用户`
   - 点击"注册"

3. **注册第二个用户（模拟客服）**
   - 退出登录
   - 用户名：`cs_001`
   - 密码：`123456`
   - 显示名称：`客服小王`
   - 点击"注册"

4. **测试聊天功能**
   - 用 `customer01` 登录
   - 点击任意订单的"联系客服"按钮
   - 发送消息："你好，我想咨询订单问题"
   - 点击 📷 上传图片测试

5. **切换客服账号查看**
   - 退出登录
   - 用 `cs_001` 登录
   - 应该能看到用户发来的消息

---

### 方式二：使用测试 UI（简单测试）

1. **打开测试页面**
   ```
   在浏览器中打开：d:/p2pchat/client/index.html
   ```

2. **测试流程**
   - 注册用户
   - 创建聊天房间
   - 发送文本/图片消息

---

### 方式三：使用 API 测试（开发者）

#### 1. 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "123456",
    "displayName": "测试用户"
  }'
```

**预期响应：**
```json
{
  "message": "注册成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "testuser",
    "displayName": "测试用户"
  }
}
```

#### 2. 用户登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "123456"
  }'
```

**预期响应：**
```json
{
  "message": "登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "testuser",
    "displayName": "测试用户",
    "status": "online"
  }
}
```

#### 3. 获取房间列表

```bash
curl http://localhost:3000/api/messages/rooms \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. 获取消息历史

```bash
curl http://localhost:3000/api/messages/rooms/ROOM_ID/messages?limit=50 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 测试管理员后台

1. **生成管理员 Token**

创建一个临时脚本 `generate-admin-token.js`：

```javascript
const jwt = require('jsonwebtoken');

const adminToken = jwt.sign(
  { 
    userId: 'admin_001',
    username: 'admin',
    role: 'admin'
  },
  process.env.JWT_SECRET || 'p2pchat-secret-key',
  { expiresIn: '30d' }
);

console.log('\n管理员 Token:');
console.log(adminToken);
console.log('\n请复制上面的 Token');
```

运行：
```bash
cd d:/p2pchat
node generate-admin-token.js
```

2. **访问管理员后台**
   ```
   在浏览器中打开：d:/p2pchat/admin/index.html
   ```

3. **输入 Token**
   - 粘贴生成的 Token
   - 点击确定

4. **查看功能**
   - ✅ 今日统计数据
   - ✅ 消息时段分布图
   - ✅ 今日聊天室列表
   - ✅ 搜索聊天记录

---

## 🔍 测试数据备份

```bash
cd d:/p2pchat

# 手动执行备份
npm run backup

# 查看备份文件
ls data/backups/

# 查看备份报告
cat data/backups/backup_report_$(date +%Y-%m-%d).json
```

---

## 🎯 完整测试场景

### 场景 1：用户咨询订单

```
1. customer01 登录
2. 点击订单 "ORD-2024-001" 的"联系客服"
3. 发送："我的订单什么时候到？"
4. 上传截图
5. cs_001 登录后看到消息
6. 回复："您好，订单已发货，预计2天到达"
```

### 场景 2：管理员查看记录

```
1. 管理员访问 /admin/
2. 查看今日聊天室
3. 点击聊天室查看详情
4. 搜索关键词"订单"
5. 查看所有相关聊天
```

### 场景 3：数据备份

```
1. 执行 npm run backup
2. 查看 data/backups/ 目录
3. 确认备份文件已创建
4. 查看备份报告
```

---

## 🐛 常见问题

### Q1: 连接失败
**检查：**
- 后端服务是否运行：`netstat -ano | findstr :3000`
- 防火墙是否阻止

### Q2: 注册失败
**检查：**
- 数据库是否正常初始化
- 查看终端日志

### Q3: 图片上传失败
**检查：**
- uploads 目录是否有写权限
- 文件大小是否超过 5MB

### Q4: 管理员后台看不到数据
**检查：**
- Token 是否正确（role 必须是 'admin'）
- 是否有聊天数据

---

## 📝 测试检查清单

- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 创建聊天房间成功
- [ ] 发送文本消息成功
- [ ] 发送图片消息成功
- [ ] 消息实时到达
- [ ] 订单号正确关联
- [ ] 管理员后台可访问
- [ ] 统计数据正确显示
- [ ] 搜索功能正常
- [ ] 备份功能正常

---

## 🚀 下一步

测试通过后，可以：

1. **部署到生产环境**
   - 参考 `DEPLOYMENT_SUMMARY.md`
   - 配置 Nginx 反向代理
   - 配置 SSL 证书

2. **集成到商场项目**
   - 安装 SDK：`npm install p2pchat-sdk`
   - 参考 `sdk/README.md`
   - 参考 `examples/mall-demo.html`

3. **配置定时备份**
   ```bash
   npm run backup:daily
   ```

---

**祝你测试顺利！** 🎉
