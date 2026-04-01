# 掼蛋游戏 Docker 部署指南

## 一键部署

在服务器上执行：

```bash
cd /path/to/guandan-game
git pull origin main
./deploy.sh
```

## 详细步骤

### 1. 首次部署

```bash
# SSH 连接到服务器
ssh user@guandangame.click

# 进入项目目录
cd /path/to/guandan-game

# 拉取最新代码
git pull origin main

# 创建生产环境配置
cp .env.production.example .env.production
# 编辑 .env.production 填写实际配置
nano .env.production

# 构建并启动
docker-compose build
docker-compose up -d

# 查看日志确认启动成功
docker-compose logs -f
```

### 2. 后续更新部署

```bash
# 拉取最新代码
git pull origin main

# 使用部署脚本（自动备份、重启）
./deploy.sh

# 或手动执行
docker-compose down
docker-compose build
docker-compose up -d
```

### 3. 常用管理命令

```bash
# 查看运行状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 查看最近50行日志
docker-compose logs --tail=50

# 重启应用
docker-compose restart

# 停止应用
docker-compose down

# 停止并删除所有数据
docker-compose down -v

# 进入容器查看
docker exec -it guandan-game sh

# 查看资源使用
docker stats guandan-game
```

### 4. 故障排查

```bash
# 查看完整日志
docker-compose logs

# 查看容器状态
docker-compose ps

# 检查健康状态
curl http://localhost:3000/api/health

# 重新构建（不使用缓存）
./deploy.sh --force

# 查看 Docker 资源占用
docker system df

# 清理未使用的镜像
docker system prune -a
```

### 5. 环境变量配置

编辑 `.env.production` 文件：

```bash
# 生产环境
NODE_ENV=production

# 服务端口
PORT=3000

# JWT 密钥（必须修改！）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 数据库（可选）
DATABASE_URL=mysql://user:password@localhost:3306/guandan
```

### 6. Nginx 反向代理配置

如果使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name guandangame.click;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name guandangame.click;

    # SSL 证书配置
    ssl_certificate /path/to/ssl/fullchain.pem;
    ssl_certificate_key /path/to/ssl/privkey.pem;

    # 代理到 Docker 容器
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 自动化部署（可选）

### 使用 GitHub Actions

在 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/guandan-game
            git pull origin main
            ./deploy.sh --no-backup
```

### 配置 GitHub Secrets

在 GitHub 仓库设置中添加：
- `SERVER_HOST`: guandangame.click
- `SERVER_USER`: 你的服务器用户名
- `SSH_PRIVATE_KEY`: SSH 私钥内容

## 监控和维护

### 日志轮转

配置 Docker 日志大小限制（在 `docker-compose.yml`）：

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 备份策略

```bash
# 自动备份脚本
#!/bin/bash
BACKUP_DIR=/backups/guandan-game
DATE=$(date +%Y%m%d_%H%M%S)

# 备份镜像
docker save guandan-game:latest | gzip > $BACKUP_DIR/image_$DATE.tar.gz

# 备份数据（如果有数据库）
docker exec guandan-db mysqldump -u root -p'password' guandan > $BACKUP_DIR/db_$DATE.sql

# 清理30天前的备份
find $BACKUP_DIR -type f -mtime +30 -delete
```
