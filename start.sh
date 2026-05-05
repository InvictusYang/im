#!/bin/bash

echo "===================================="
echo "  P2PChat 启动脚本"
echo "===================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 已安装"
echo ""

# 安装后端依赖
echo "📦 安装后端依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"
echo ""

# 安装前端依赖
echo "📦 安装前端依赖..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
cd ..
echo "✅ 前端依赖安装完成"
echo ""

# 创建必要目录
mkdir -p data
mkdir -p uploads/avatars
mkdir -p uploads/chat_images
mkdir -p uploads/files

echo ""
echo "===================================="
echo "  启动 P2PChat"
echo "===================================="
echo ""
echo "🚀 后端服务: http://localhost:3000"
echo "🌐 前端服务: http://localhost:3001"
echo "💾 数据库: ./data/chat.db"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 启动服务
npm run dev:full
