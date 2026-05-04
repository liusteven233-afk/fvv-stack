#!/bin/bash
# =====================================================
# FVV Stack + Hermes Config — Restore Script
# 在新设备上运行，恢复全部环境
# =====================================================
set -e

echo "=== 1. 安装 Hermes Agent ==="
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

echo "=== 2. 恢复 Hermes 配置 ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.hermes-backup"

mkdir -p ~/.hermes/skills ~/.hermes/logs
cp "$BACKUP_DIR/config.yaml" ~/.hermes/config.yaml
cp -r "$BACKUP_DIR/skills/"* ~/.hermes/skills/
[ -f "$BACKUP_DIR/credentials.yaml" ] && cp "$BACKUP_DIR/credentials.yaml" ~/.hermes/
[ -f "$BACKUP_DIR/auth.json" ] && cp "$BACKUP_DIR/auth.json" ~/.hermes/

echo "=== 3. API 密钥 ==="
echo "请手动把 .env.example 里的密钥填到 ~/.hermes/.env"
echo "或直接复制: cp .env.example ~/.hermes/.env 然后编辑"

echo "=== 4. FVV Stack 项目 ==="
echo "项目就在本目录: $SCRIPT_DIR"
echo "创建 venv: python3 -m venv venv && source venv/bin/activate && pip install -r backend/requirements.txt"
echo "启动 Dashboard: streamlit run frontend/fvv_dashboard.py"
echo "启动 API: uvicorn backend.main:app --port 8649"
echo "加载 Chrome 扩展: extension/ 目录"

echo ""
echo "=== 完成 ==="
echo "运行 'hermes' 开始使用"
