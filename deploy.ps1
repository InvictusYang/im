# P2PChat Docker 一键部署脚本 (PowerShell)
# 使用方法：.\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  P2PChat Docker 一键部署" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host " Docker 未安装，请先安装 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 检查 Docker Compose
$composeCmd = $null
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $composeCmd = "docker-compose"
} elseif (docker compose version -ErrorAction SilentlyContinue) {
    $composeCmd = "docker compose"
} else {
    Write-Host " Docker Compose 未安装" -ForegroundColor Red
    exit 1
}

Write-Host " Docker 环境检查通过" -ForegroundColor Green
Write-Host ""

# 检查配置文件
if (-not (Test-Path .env)) {
    Write-Host " 首次部署，创建配置文件..." -ForegroundColor Yellow
    Copy-Item .env.production .env
    
    Write-Host ""
    Write-Host "⚠️  请编辑 .env 文件，修改以下配置：" -ForegroundColor Yellow
    Write-Host "   1. JWT_SECRET（必须修改为安全的密钥）" -ForegroundColor Yellow
    Write-Host "   2. CLIENT_URL（你的域名，如 https://im.yourmall.com）" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键继续部署"
}

# 生成 JWT Secret
if (Select-String -Path .env -Pattern "CHANGE-THIS-TO-A-VERY-SECURE-SECRET" -Quiet) {
    Write-Host " 生成 JWT Secret..." -ForegroundColor Yellow
    
    # 生成随机密钥
    $bytes = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $secret = [System.BitConverter]::ToString($bytes).Replace("-","").ToLower()
    
    # 替换密钥
    $envContent = Get-Content .env -Raw
    $envContent = $envContent -replace "CHANGE-THIS-TO-A-VERY-SECURE-SECRET-KEY-AT-LEAST-32-CHARS", $secret
    Set-Content .env $envContent -NoNewline
    
    Write-Host " JWT Secret 已生成" -ForegroundColor Green
    Write-Host ""
}

# 创建必要目录
Write-Host " 创建数据目录..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path data\backups, data\archives, uploads, logs, nginx\conf.d | Out-Null
Write-Host " 目录创建完成" -ForegroundColor Green
Write-Host ""

# 停止旧服务
Write-Host " 停止旧服务（如果有）..." -ForegroundColor Yellow
& $composeCmd down 2>$null
Write-Host ""

# 构建镜像
Write-Host " 构建 Docker 镜像..." -ForegroundColor Yellow
& $composeCmd build
Write-Host " 镜像构建完成" -ForegroundColor Green
Write-Host ""

# 启动服务
Write-Host " 启动服务..." -ForegroundColor Yellow
& $composeCmd up -d
Write-Host " 服务启动完成" -ForegroundColor Green
Write-Host ""

# 等待服务就绪
Write-Host " 等待服务就绪..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查服务状态
Write-Host ""
Write-Host " 服务状态：" -ForegroundColor Cyan
& $composeCmd ps
Write-Host ""

# 健康检查
Write-Host " 健康检查..." -ForegroundColor Yellow
for ($i=1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host " 服务健康检查通过" -ForegroundColor Green
            break
        }
    } catch {
        # 忽略错误，继续重试
    }
    
    if ($i -eq 10) {
        Write-Host " 服务启动失败，请查看日志：" -ForegroundColor Red
        & $composeCmd logs p2pchat
        exit 1
    }
    
    Write-Host "   等待中... ($i/10)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  部署成功！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host " 服务信息：" -ForegroundColor Cyan
Write-Host "   - 访问地址: http://localhost" -ForegroundColor White
Write-Host "   - API 地址: http://localhost/api" -ForegroundColor White
Write-Host "   - 健康检查: http://localhost/api/health" -ForegroundColor White
Write-Host ""
Write-Host " 常用命令：" -ForegroundColor Cyan
Write-Host "   - 查看日志: $composeCmd logs -f p2pchat" -ForegroundColor White
Write-Host "   - 重启服务: $composeCmd restart" -ForegroundColor White
Write-Host "   - 停止服务: $composeCmd down" -ForegroundColor White
Write-Host "   - 备份数据: $composeCmd exec p2pchat npm run backup" -ForegroundColor White
Write-Host ""
Write-Host " 配置 HTTPS（可选）：" -ForegroundColor Cyan
Write-Host "   1. 修改 .env 中的 CLIENT_URL 为你的域名" -ForegroundColor White
Write-Host "   2. 修改 nginx/conf.d/p2pchat.conf 启用 HTTPS 配置" -ForegroundColor White
Write-Host "   3. 使用 Certbot 获取 SSL 证书" -ForegroundColor White
Write-Host "   4. 重启服务: $composeCmd restart nginx" -ForegroundColor White
Write-Host ""
Write-Host " 享受使用 P2PChat！" -ForegroundColor Green
