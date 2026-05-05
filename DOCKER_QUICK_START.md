# P2PChat Docker 快速部署指南

## 🚀 一键部署

### Windows

```powershell
# 进入项目目录
cd d:\p2pchat

# 运行部署脚本
.\deploy.ps1
```

### Linux/Mac

```bash
# 进入项目目录
cd /opt/p2pchat

# 添加执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

---

## 📋 手动部署（可选）

如果不想使用脚本，可以手动执行：

```bash
# 1. 复制配置文件
cp .env.production .env

# 2. 编辑配置（修改 JWT_SECRET 和 CLIENT_URL）
nano .env

# 3. 创建目录
mkdir -p data/backups data/archives uploads logs nginx/conf.d

# 4. 构建并启动
docker-compose up -d

# 或者使用新版 Docker Compose
docker compose up -d
```

---

## 🔧 配置说明

### 必须配置的项目

编辑 `.env` 文件：

```env
# JWT 密钥（必须修改！）
JWT_SECRET=your-very-secure-secret-key-here

# 客户端 URL（生产环境必须配置）
CLIENT_URL=https://im.yourmall.com
```

**生成安全密钥：**
```bash
# Linux/Mac
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Windows PowerShell
powershell -Command "[System.BitConverter]::ToString((New-Object byte[] 64 | ForEach-Object { [byte](Get-Random -Min 0 -Max 256) })).Replace('-','').ToLower()"
```

---

## 📊 服务管理

### 查看服务状态

```bash
docker-compose ps
# 或
docker compose ps
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

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart p2pchat
```

### 停止服务

```bash
docker-compose down
```

### 更新服务

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

---

## 🗄 数据管理

### 查看数据卷

```bash
docker volume ls | grep p2pchat
```

### 备份数据

```bash
# 方法一：使用内置备份
docker-compose exec p2pchat npm run backup

# 方法二：手动备份数据库
docker-compose exec p2pchat cp /app/data/chat.db /app/data/backups/chat_$(date +%Y%m%d).db

# 方法三：复制数据卷
docker run --rm -v p2pchat_p2pchat-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /data .
```

### 恢复数据

```bash
# 停止服务
docker-compose down

# 恢复数据库
docker run --rm -v p2pchat_p2pchat-data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup.tar.gz -C /data

# 启动服务
docker-compose up -d
```

### 清理旧数据

```bash
# 删除所有数据卷（⚠️ 危险操作！）
docker-compose down -v

# 删除未使用的数据卷
docker volume prune
```

---

## 🔒 配置 HTTPS

### 方式一：使用 Let's Encrypt（推荐）

```bash
# 1. 修改 .env
CLIENT_URL=https://im.yourmall.com

# 2. 修改 nginx/conf.d/p2pchat.conf
# 取消注释 HTTPS 配置部分

# 3. 启动 Certbot 服务
docker-compose --profile ssl up -d

# 4. 获取证书
docker-compose run --rm certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d im.yourmall.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# 5. 重启 Nginx
docker-compose restart nginx
```

### 方式二：使用自签名证书（测试用）

```bash
# 生成证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=im.yourmall.com"

# 重启服务
docker-compose restart nginx
```

---

## 🐛 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs p2pchat

# 检查配置文件
docker-compose config

# 查看容器状态
docker-compose ps -a
```

### 数据库错误

```bash
# 进入容器
docker-compose exec p2pchat sh

# 检查数据库
sqlite3 /app/data/chat.db "SELECT * FROM users LIMIT 5;"

# 重置数据库（⚠️ 会删除所有数据）
rm /app/data/chat.db
docker-compose restart p2pchat
```

### 端口冲突

```bash
# 查看端口占用
netstat -tunlp | grep :80
netstat -tunlp | grep :443

# 修改 docker-compose.yml 中的端口映射
# 例如改为 8080:80
```

### Nginx 配置错误

```bash
# 测试配置
docker-compose exec nginx nginx -t

# 重载配置
docker-compose exec nginx nginx -s reload

# 查看 Nginx 日志
docker-compose logs nginx
```

---

## 📈 性能优化

### 资源限制

在 `docker-compose.yml` 中已配置：

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 日志轮转

创建 `docker-compose.override.yml`：

```yaml
services:
  p2pchat:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 健康检查

服务已内置健康检查，Docker 会自动重启不健康的容器。

---

## 🔍 监控

### 使用 Docker Stats

```bash
# 实时监控
docker stats

# 查看特定容器
docker stats p2pchat-app
```

### 健康检查

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' p2pchat-app

# 检查 API 健康
curl http://localhost/api/health
```

---

##  生产部署检查清单

- [ ] Docker 和 Docker Compose 已安装
- [ ] `.env` 文件已配置（JWT_SECRET 已修改）
- [ ] CLIENT_URL 已设置为实际域名
- [ ] 数据目录已创建
- [ ] 防火墙已配置（开放 80/443 端口）
- [ ] SSL 证书已配置（生产环境必须）
- [ ] 定时备份已启用
- [ ] 监控已配置
- [ ] 服务健康检查通过

---

## 📞 获取帮助

- 查看日志：`docker-compose logs -f`
- 进入容器：`docker-compose exec p2pchat sh`
- 查看文档：[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- 提交 Issue：https://github.com/your-repo/p2pchat/issues

---

## 🎉 总结

**Docker 部署优势：**
- ✅ 一键安装所有依赖
- ✅ 自动配置 Nginx 反向代理
- ✅ 支持 WebSocket
- ✅ 数据持久化
- ✅ 自动备份
- ✅ 易于扩展和迁移

**只需 3 步：**
1. 复制配置文件
2. 修改 JWT_SECRET
3. 运行部署脚本

**就这么简单！** 🚀
