#!/bin/bash

# 掼蛋游戏生产部署脚本
# 使用方法: ./deploy.sh [选项]
# 选项:
#   --no-backup  跳过备份步骤
#   --force      强制重建镜像（不使用缓存）

set -e  # 遇到错误立即退出

echo "🚀 开始部署掼蛋游戏到生产环境..."

# 解析命令行参数
NO_BACKUP=false
FORCE_BUILD=false
for arg in "$@"; do
  case $arg in
    --no-backup)
      NO_BACKUP=true
      shift
      ;;
    --force)
      FORCE_BUILD=true
      shift
      ;;
  esac
done

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 拉取最新代码
echo -e "${GREEN}📥 拉取最新代码...${NC}"
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull origin $CURRENT_BRANCH

# 2. 备份当前运行的容器（可选）
if [ "$NO_BACKUP" = false ]; then
  echo -e "${GREEN}💾 备份当前容器...${NC}"
  if docker ps -a | grep -q guandan-game; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    docker commit guandan-game guandan-game-backup:$TIMESTAMP
    echo -e "${YELLOW}✅ 备份已保存为 guandan-game-backup:$TIMESTAMP${NC}"
  else
    echo -e "${YELLOW}ℹ️  没有找到运行中的容器，跳过备份${NC}"
  fi
fi

# 3. 停止并删除旧容器
echo -e "${GREEN}🛑 停止旧容器...${NC}"
docker-compose down || true

# 4. 构建新镜像
echo -e "${GREEN}🔨 构建新 Docker 镜像...${NC}"
if [ "$FORCE_BUILD" = true ]; then
  docker-compose build --no-cache
else
  docker-compose build
fi

# 5. 启动新容器
echo -e "${GREEN}▶️  启动新容器...${NC}"
docker-compose up -d

# 6. 等待服务启动
echo -e "${GREEN}⏳ 等待服务启动...${NC}"
sleep 5

# 7. 检查容器状态
echo -e "${GREEN}🔍 检查服务状态...${NC}"
if docker-compose ps | grep -q "Up"; then
  echo -e "${GREEN}✅ 容器启动成功！${NC}"

  # 显示容器日志的最后几行
  echo -e "${GREEN}📋 最近日志：${NC}"
  docker-compose logs --tail=20

  # 健康检查
  echo -e "${GREEN}🏥 执行健康检查...${NC}"
  sleep 10
  if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 健康检查通过！${NC}"
    echo -e "${GREEN}🎉 部署成功！应用已运行在 http://localhost:3000${NC}"
  else
    echo -e "${YELLOW}⚠️  健康检查失败，请查看日志${NC}"
    docker-compose logs --tail=50
  fi
else
  echo -e "${RED}❌ 容器启动失败！${NC}"
  docker-compose logs --tail=50
  exit 1
fi

# 8. 清理旧镜像（保留最近3个版本）
echo -e "${GREEN}🧹 清理旧镜像...${NC}"
docker images | grep guandan-game-backup | awk '{print $1":"$2}' | tail -n +4 | xargs -r docker rmi || true

echo -e "${GREEN}✨ 部署流程完成！${NC}"
echo -e "${GREEN}📊 使用以下命令管理应用：${NC}"
echo -e "  ${YELLOW}查看日志:${NC} docker-compose logs -f"
echo -e "  ${YELLOW}重启应用:${NC} docker-compose restart"
echo -e "  ${YELLOW}停止应用:${NC} docker-compose down"
echo -e "  ${YELLOW}查看状态:${NC} docker-compose ps"
