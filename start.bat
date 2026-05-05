@echo off
echo ====================================
echo   P2PChat 启动脚本
echo ====================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
echo.

:: 安装后端依赖
echo 📦 安装后端依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成
echo.

:: 安装前端依赖
echo 📦 安装前端依赖...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
cd ..
echo ✅ 前端依赖安装完成
echo.

:: 创建必要目录
if not exist "data" mkdir data
if not exist "uploads\avatars" mkdir uploads\avatars
if not exist "uploads\chat_images" mkdir uploads\chat_images
if not exist "uploads\files" mkdir uploads\files

echo.
echo ====================================
echo   启动 P2PChat
echo ====================================
echo.
echo 🚀 后端服务: http://localhost:3000
echo 🌐 前端服务: http://localhost:3001
echo 💾 数据库: ./data/chat.db
echo.
echo 按 Ctrl+C 停止服务
echo.

:: 启动服务
call npm run dev:full
