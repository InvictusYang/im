# P2PChat 生产部署清单

## ✅ 部署前检查

### 1. 服务器要求

- [ ] CPU: 2 核及以上
- [ ] 内存: 2GB 及以上
- [ ] 硬盘: 20GB SSD 及以上
- [ ] 带宽: 10Mbps 及以上
- [ ] 操作系统: Ubuntu 20.04/22.04 LTS（推荐）

### 2. 软件要求

- [ ] Docker 已安装（版本 20.10+）
- [ ] Docker Compose 已安装（版本 2.0+）
- [ ] Git 已安装（用于拉取代码）
- [ ] 域名已解析（如 im.yourmall.com）

### 3. 网络要求

- [ ] 防火墙开放 80 端口（HTTP）
- [ ] 防火墙开放 443 端口（HTTPS）
- [ ] 防火墙开放 22 端口（SSH）
- [ ] 服务器可以访问外网（获取 Docker 镜像）

---

##  部署步骤

### 步骤 1：上传代码到服务器

#### 方式一：使用 Git（推荐）

```bash
# 在服务器上执行
cd /opt
git clone https://github.com/your-repo/p2pchat.git
cd p2pchat
```

#### 方式二：使用 SCP/SFTP

```bash
# 在本地执行
# 打包项目（排除 node_modules）
tar -czf p2pchat.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=data \
  --exclude=uploads \
  --exclude=logs \
  p2pchat/

# 上传到服务器
scp p2pchat.tar.gz root@your-server:/opt/

# 在服务器上解压
ssh root@your-server
cd /opt
tar -xzf p2pchat.tar.gz
cd p2pchat
```

#### 方式三：使用 rsync

```bash
# 在本地执行
rsync -avz --exclude='node_modules' \
  --exclude='.git' \
  --exclude='data' \
  --exclude='uploads' \
  --exclude='logs' \
  ./ root@your-server:/opt/p2pchat/
```

---

### 步骤 2：配置环境变量

```bash
cd /opt/p2pchat

# 复制生产环境配置
cp .env.production .env

# 编辑配置
nano .env
```

**必须修改的配置：**

```env
# 1. JWT 密钥（必须修改！）
JWT_SECRET=your-very-secure-secret-key-here

# 2. 客户端 URL（改为你的域名）
CLIENT_URL=https://im.yourmall.com
```

**生成安全的 JWT Secret：**

```bash
# Linux/Mac
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 如果没有 Node.js
head -c 64 /dev/urandom | sha256sum | head -c 64
```

---

### 步骤 3：获取 SSL 证书

#### 方式一：使用 Let's Encrypt（免费，推荐）

```bash
# 1. 确保域名已解析到服务器 IP
ping im.yourmall.com

# 2. 创建 SSL 目录
mkdir -p nginx/ssl

# 3. 使用 Certbot 获取证书
docker run --rm -it \
  -v $(pwd)/nginx/ssl:/etc/nginx/ssl \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --email your@email.com \
  -d im.yourmall.com

# 4. 复制证书文件
cp nginx/ssl/live/im.yourmall.com/fullchain.pem nginx/ssl/
cp nginx/ssl/live/im.yourmall.com/privkey.pem nginx/ssl/

# 5. 设置权限
chmod 600 nginx/ssl/*.pem
```

#### 方式二：使用自签名证书（测试用）

```bash
mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=im.yourmall.com"

chmod 600 nginx/ssl/*.pem
```

---

### 步骤 4：创建必要目录

```bash
mkdir -p data/backups data/archives uploads logs
chmod -R 755 data uploads
```

---

### 步骤 5：启动服务

```bash
# 方式一：使用部署脚本（推荐）
chmod +x deploy.sh
./deploy.sh

# 方式二：手动启动
docker-compose up -d
```

---

### 步骤 6：验证部署

```bash
# 1. 检查服务状态
docker-compose ps

# 应该看到：
# p2pchat-app      Up (healthy)
# p2pchat-nginx    Up

# 2. 检查健康状态
docker inspect --format='{{.State.Health.Status}}' p2pchat-app
# 应该返回：healthy

# 3. 测试 API
curl -k https://localhost/api/health
# 应该返回：{"status":"ok","timestamp":"..."}

# 4. 测试 WebSocket
curl -k -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  https://localhost/socket.io/?EIO=4&transport=websocket

# 5. 查看日志
docker-compose logs -f p2pchat
```

---

## 🔧 需要修改的配置

### 必须修改

| 配置项 | 位置 | 说明 | 示例 |
|--------|------|------|------|
| **JWT_SECRET** | `.env` | JWT 密钥（必须安全） | 128 位随机字符串 |
| **CLIENT_URL** | `.env` | 前端域名 | `https://im.yourmall.com` |
| **域名** | `nginx/conf.d/p2pchat.conf` | Nginx server_name | `im.yourmall.com` |
| **SSL 证书** | `nginx/ssl/` | 证书文件 | Let's Encrypt 证书 |

### 可选修改

| 配置项 | 位置 | 说明 | 默认值 |
|--------|------|------|--------|
| **PORT** | `.env` | 服务端口 | `3000` |
| **MAX_FILE_SIZE** | `.env` | 最大文件大小 | `5242880` (5MB) |
| **BACKUP_RETENTION_DAYS** | `.env` | 备份保留天数 | `30` |
| **ARCHIVE_DAYS** | `.env` | 消息归档天数 | `90` |

---

## 📦 需要上传的文件

### 必须上传

```
p2pchat/
├── Dockerfile                    ✅
├── docker-compose.yml            ✅
├── deploy.sh                     ✅
├── deploy.ps1                    ✅
├── .dockerignore                 ✅
├── .env.production               ✅
├── .gitignore                    ✅
├── package.json                  ✅
├── package-lock.json             ✅
├── server.js                     ✅
├── nginx/
│   ├── nginx.conf                ✅
│   └── conf.d/
│       ├── p2pchat.conf          ✅
│       └── p2pchat-location.conf ✅
├── src/                          ✅
│   ├── database.js
│   ├── socket.js
│   └── routes/
│       ├── auth.js
│       ├── messages.js
│       ├── upload.js
│       └── admin.js
├── scripts/
│   └── backup.js                 ✅
└── sdk/
    ├── p2pchat-sdk.js            ✅
    └── README.md                 ✅
```

### 不需要上传

```
❌ node_modules/          # Docker 会自动安装
❌ data/                  # 运行时生成
❌ uploads/               # 运行时生成
❌ logs/                  # 运行时生成
❌ .env                   # 使用 .env.production 模板
❌ .git/                  # 使用 Git 部署
❌ client/                # 仅用于测试
❌ admin/                 # 仅用于测试
❌ examples/              # 仅用于测试
❌ docs/                  # 文档不需要
```

---

## 🔄 更新服务

### 更新代码

```bash
cd /opt/p2pchat

# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f p2pchat
```

### 更新配置

```bash
# 修改 .env
nano .env

# 重启服务
docker-compose restart
```

### 更新 Nginx 配置

```bash
# 修改配置
nano nginx/conf.d/p2pchat.conf

# 重载 Nginx（无需重启容器）
docker-compose exec nginx nginx -s reload

# 或重启 Nginx
docker-compose restart nginx
```

---

## 🗄 数据备份

### 自动备份

```bash
# 启用备份服务
docker-compose --profile backup up -d

# 备份会在每天凌晨 2 点自动执行
```

### 手动备份

```bash
# 备份数据库
docker-compose exec p2pchat npm run backup

# 查看备份
docker-compose exec p2pchat ls -lh /app/data/backups/

# 下载备份到本地
docker cp p2pchat-app:/app/data/backups/ ./local-backups/
```

### 恢复数据

```bash
# 停止服务
docker-compose down

# 恢复数据库
docker run --rm -v p2pchat_p2pchat-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/chat-backup.tar.gz -C /data

# 启动服务
docker-compose up -d
```

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. 文件权限

```bash
# 设置安全权限
chown -R 1000:1000 /opt/p2pchat
chmod -R 755 /opt/p2pchat
chmod 600 /opt/p2pchat/.env
chmod 600 /opt/p2pchat/nginx/ssl/*.pem
```

### 3. 定期更新

```bash
# 更新 Docker 镜像
docker-compose pull
docker-compose up -d

# 更新系统包
sudo apt update && sudo apt upgrade -y
```

---

## 📊 监控和维护

### 查看服务状态

```bash
# 所有服务
docker-compose ps

# 资源使用
docker stats

# 健康检查
docker inspect --format='{{.State.Health.Status}}' p2pchat-app
```

### 查看日志

```bash
# 实时日志
docker-compose logs -f p2pchat

# 最近 100 行
docker-compose logs --tail=100 p2pchat

# Nginx 日志
docker-compose logs -f nginx
```

### 进入容器

```bash
# 进入 P2PChat 容器
docker-compose exec p2pchat sh

# 进入 Nginx 容器
docker-compose exec nginx sh
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart p2pchat
docker-compose restart nginx
```

### 停止服务

```bash
# 停止但保留数据
docker-compose down

# 停止并删除数据（⚠️ 危险！）
docker-compose down -v
```

---

## 🎯 部署后验证清单

- [ ] 服务正常启动（`docker-compose ps` 显示 Up）
- [ ] 健康检查通过（`healthy` 状态）
- [ ] HTTPS 正常工作（浏览器访问无证书错误）
- [ ] WebSocket 连接正常（Socket.IO 握手成功）
- [ ] API 接口可访问（`/api/health` 返回正常）
- [ ] 文件上传正常（图片可以上传和访问）
- [ ] 用户注册/登录正常
- [ ] 聊天功能正常（双向消息收发）
- [ ] 管理后台可访问（`/admin/`）
- [ ] 定时备份已启用
- [ ] 防火墙已配置
- [ ] SSL 证书自动续期已配置（Let's Encrypt）

---

##  常见问题

### Q1: 证书获取失败

```bash
# 检查域名解析
ping im.yourmall.com

# 检查 80 端口是否开放
telnet im.yourmall.com 80

# 手动获取证书
docker run --rm -it -p 80:80 certbot/certbot certonly --standalone -d im.yourmall.com
```

### Q2: WebSocket 连接失败

```bash
# 检查 Nginx 配置
docker-compose exec nginx nginx -t

# 查看 Nginx 日志
docker-compose logs nginx | grep websocket

# 测试 WebSocket
wscat -c wss://im.yourmall.com/socket.io/?EIO=4&transport=websocket
```

### Q3: 数据库错误

```bash
# 查看数据库日志
docker-compose logs p2pchat | grep SQLITE

# 重置数据库（⚠️ 会删除数据）
docker-compose down
rm -rf data/chat.db
docker-compose up -d
```

### Q4: 文件上传失败

```bash
# 检查目录权限
docker-compose exec p2pchat ls -la /app/uploads/

# 修复权限
docker-compose exec p2pchat chown -R node:node /app/uploads
```

---

## 📞 获取帮助

- 查看日志：`docker-compose logs -f`
- 查看文档：[DOCKER_QUICK_START.md](DOCKER_QUICK_START.md)
- 提交 Issue：https://github.com/your-repo/p2pchat/issues

---

## 🎉 部署完成！

**恭喜！你的 P2PChat IM 服务已经成功部署到生产环境！**

- ✅ HTTPS 已启用
- ✅ WebSocket 已配置
- ✅ Nginx 反向代理已就绪
- ✅ 数据持久化已配置
- ✅ 定时备份已启用
- ✅ 健康检查已开启

**享受使用吧！** 🚀
