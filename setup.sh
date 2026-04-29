#!/bin/bash
# FVV Stack — 一键安装脚本
# 在新机器(WSL)上运行: bash setup.sh

set -e

echo "🛠 FVV Stack 安装中..."
DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Dashboard 依赖 ──
echo "📦 安装 Dashboard 依赖..."
python3 -m venv ~/dashboard_env 2>/dev/null || true
~/dashboard_env/bin/pip install -r "$DIR/dashboard/requirements.txt" -q

# ── 扩展同步到桌面 ──
echo "📋 同步扩展到桌面..."
DESKTOP="/mnt/c/Users/Administrator/Desktop"
if [ -d "$DESKTOP" ]; then
  cp -r "$DIR/extensions/hermes_extension" "$DESKTOP/"
  cp -r "$DIR/extensions/hermes_chat_extension" "$DESKTOP/"
  cp -r "$DIR/extensions/hermes_hajimi_extension" "$DESKTOP/"
  cp -r "$DIR/extensions/hermes_extension_standalone" "$DESKTOP/"
  echo "   ✅ 已同步到 $DESKTOP"
fi

# ── 脚本 ──
echo "🔧 安装脚本..."
cp "$DIR/scripts/fvv-genkey.py" ~/.local/bin/ 2>/dev/null || true
cp "$DIR/scripts/hermes-chat" ~/.local/bin/ 2>/dev/null || true
chmod +x ~/.local/bin/*.py ~/.local/bin/hermes-chat 2>/dev/null || true

# ── Crontab ──
echo "⏰ 配置开机自启..."
if [ -f "$DIR/config/crontab.txt" ]; then
  crontab "$DIR/config/crontab.txt" 2>/dev/null && echo "   ✅ crontab 已导入"
fi

echo ""
echo "✅ FVV Stack 安装完成!"
echo ""
echo "下一步:"
echo "  1. Chrome → chrome://extensions → 加载扩展"
echo "  2. Dashboard: streamlit run ~/hermes_dashboard.py --server.port 8501"
echo "  3. 秘钥在 sidepanel.js 的 FVV_SECRET 里"
