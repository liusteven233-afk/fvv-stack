#!/bin/bash
# FVV Stack - 一键启动/停止
set -e

ACTION="${1:-status}"
FVV_DIR="/home/mzls233/fvv-stack"
VENV="$FVV_DIR/venv-new"
BACKEND_PORT=8649
DASHBOARD_PORT=8650

start_backend() {
    echo "🚀 启动 FastAPI 后端 (端口 $BACKEND_PORT)..."
    cd "$FVV_DIR/backend"
    nohup "$VENV/bin/uvicorn" main:app --host 0.0.0.0 --port $BACKEND_PORT \
        > "$FVV_DIR/logs/backend.log" 2>&1 &
    echo $! > "$FVV_DIR/backend.pid"
    echo "   PID: $(cat $FVV_DIR/backend.pid)"
}

start_dashboard() {
    echo "🚀 启动 Streamlit Dashboard (端口 $DASHBOARD_PORT)..."
    cd "$FVV_DIR/frontend"
    nohup "$VENV/bin/streamlit" run fvv_dashboard.py \
        --server.port $DASHBOARD_PORT --server.headless true \
        > "$FVV_DIR/logs/dashboard.log" 2>&1 &
    echo $! > "$FVV_DIR/dashboard.pid"
    echo "   PID: $(cat $FVV_DIR/dashboard.pid)"
}

stop() {
    echo "🛑 停止所有服务..."
    for pid_file in backend.pid dashboard.pid; do
        if [ -f "$FVV_DIR/$pid_file" ]; then
            PID=$(cat "$FVV_DIR/$pid_file")
            kill $PID 2>/dev/null && echo "   已停止 PID $PID" || echo "   PID $PID 未运行"
            rm -f "$FVV_DIR/$pid_file"
        fi
    done
}

status() {
    echo "📊 状态:"
    for name in backend dashboard; do
        PID_FILE="$FVV_DIR/${name}.pid"
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if kill -0 $PID 2>/dev/null; then
                echo "   ✅ $name 运行中 (PID: $PID)"
            else
                echo "   ❌ $name 已停止 (PID文件存在)"
                rm -f "$PID_FILE"
            fi
        else
            echo "   ⬜ $name 未启动"
        fi
    done
}

case "$ACTION" in
    start)
        mkdir -p "$FVV_DIR/logs"
        start_backend
        sleep 2
        start_dashboard
        echo ""
        status
        echo ""
        echo "🌐 后端: http://localhost:$BACKEND_PORT"
        echo "🌐 Dashboard: http://localhost:$DASHBOARD_PORT"
        echo "📦 浏览器扩展: chrome://extensions → 加载已解压的扩展 → $FVV_DIR/extension"
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 1
        $0 start
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
