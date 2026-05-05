# P2PChat 生产部署快速参考

## 🚀 3 步部署

```bash
# 1. 上传代码
git clone https://github.com/your-repo/p2pchat.git /opt/p2pchat
cd /opt/p2pchat

# 2. 配置环境
cp .env.production .env
nano .env  # 修改 JWT_SECRET 和 CLIENT_URL

# 3. 获取证书并启动
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=im.yourmall.com"
chmod 600 nginx/ssl/*.pem

./deploy.sh
```

---

## 🔑 必须修改的配置

| 配置 | 位置 | 说明 |
|------|------|------|
| `JWT_SECRET` | `.env` | 生成：`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLIENT_URL` | `.env` | 改为你的域名，如 `https://im.yourmall.com` |
| 域名 | `nginx/conf.d/p2pchat.conf` | 可选，默认 `_` 接受所有域名 |
| SSL 证书 | `nginx/ssl/` | 使用 Let's Encrypt 或自签名 |

---

## 📦 上传文件清单

### ✅ 必须上传
```
Dockerfile
docker-compose.yml
deploy.sh / deploy.ps1
.env.production
nginx/ (整个目录)
src/ (整个目录)
scripts/backup.js
sdk/p2pchat-sdk.js
package.json
package-lock.json
server.js
```

### ❌ 不需要上传
```
node_modules/
data/
uploads/
logs/
.env
client/
admin/
examples/
docs/
```

---

## 🔍 验证命令

```bash
# 检查服务状态
docker-compose ps

# 健康检查
docker inspect --format='{{.State.Health.Status}}' p2pchat-app

# 测试 API
curl -k https://localhost/api/health

# 查看日志
docker-compose logs -f p2pchat
```

---

## 🔧 常用操作

```bash
# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f p2pchat

# 进入容器
docker-compose exec p2pchat sh

# 备份数据
docker-compose exec p2pchat npm run backup

# 更新服务
git pull && docker-compose up -d --build

# 停止服务
docker-compose down
```

---

## 🐛 故障排查

```bash
# 服务无法启动
docker-compose logs p2pchat

# 证书问题
openssl x509 -in nginx/ssl/fullchain.pem -text -noout

# 端口冲突
netstat -tunlp | grep :80

# 权限问题
chmod 600 nginx/ssl/*.pem
chmod -R 755 data uploads
```

---

## 📞 快速帮助

- 完整文档：[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
- Docker 指南：[DOCKER_QUICK_START.md](DOCKER_QUICK_START.md)
- 生产部署：[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)

---

**就这么简单！** 🚀
