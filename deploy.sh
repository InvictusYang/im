#!/bin/bash

# P2PChat Docker 一键部署脚本
# 使用方法：chmod +x deploy.sh && ./deploy.sh

set -e

echo "======================================"
echo "  P2PChat Docker 一键部署"
echo "======================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 检查配置文件
if [ ! -f .env ]; then
    echo "📝 首次部署，创建配置文件..."
    cp .env.production .env
    echo ""
    echo "⚠️  请编辑 .env 文件，修改以下配置："
    echo "   1. JWT_SECRET（必须修改为安全的密钥）"
    echo "   2. CLIENT_URL（你的域名，如 https://im.yourmall.com）"
    echo ""
    read -p "按回车键继续部署..."
fi

# 生成 JWT Secret（如果未配置）
if grep -q "CHANGE-THIS-TO-A-VERY-SECURE-SECRET" .env; then
    echo "🔐 生成 JWT Secret..."
    SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || head -c 64 /dev/urandom | sha256sum | head -c 64)
    sed -i.bak "s/CHANGE-THIS-TO-A-VERY-SECURE-SECRET-KEY-AT-LEAST-32-CHARS/$SECRET/" .env
    rm -f .env.bak
    echo "✅ JWT Secret 已生成"
    echo ""
fi

# 创建必要目录
echo "📁 创建数据目录..."
mkdir -p data/backups data/archives uploads logs nginx/conf.d
echo "✅ 目录创建完成"
echo ""

# 停止旧服务
echo "🛑 停止旧服务（如果有）..."
docker-compose down 2>/dev/null || docker compose down 2>/dev/null || true
echo ""

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build || docker compose build
echo "✅ 镜像构建完成"
echo ""

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d || docker compose up -d
echo "✅ 服务启动完成"
echo ""

# 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose ps || docker compose ps
echo ""

# 健康检查
echo "🏥 健康检查..."
for i in {1..10}; do
    if curl -sf http://localhost/api/health > /dev/null 2>&1; then
        echo "✅ 服务健康检查通过"
        break
    fi
    if [ $i -eq 10 ]; then
        echo " 服务启动失败，请查看日志："
        docker-compose logs p2pchat || docker compose logs p2pchat
        exit 1
    fi
    echo "   等待中... ($i/10)"
    sleep 2
done

echo ""
echo "======================================"
echo "  ✅ 部署成功！"
echo "======================================"
echo ""
echo " 服务信息："
echo "   - 访问地址: http://localhost"
echo "   - API 地址: http://localhost/api"
echo "   - 健康检查: http://localhost/api/health"
echo ""
echo "📋 常用命令："
echo "   - 查看日志: docker-compose logs -f p2pchat"
echo "   - 重启服务: docker-compose restart"
echo "   - 停止服务: docker-compose down"
echo "   - 备份数据: docker-compose exec p2pchat npm run backup"
echo ""
echo " 配置 HTTPS（可选）："
echo "   1. 修改 .env 中的 CLIENT_URL 为你的域名"
echo "   2. 修改 nginx/conf.d/p2pchat.conf 启用 HTTPS 配置"
echo "   3. 使用 Certbot 获取 SSL 证书"
echo "   4. 重启服务: docker-compose restart nginx"
echo ""
echo "🎉 享受使用 P2PChat！"
