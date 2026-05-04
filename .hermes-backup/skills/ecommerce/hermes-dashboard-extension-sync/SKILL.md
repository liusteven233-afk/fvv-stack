---
name: hermes-dashboard-extension-sync
description: "Hermes 跨境核价面板 + 两个Chrome扩展的同步维护知识"
version: 1.1.0
author: 靓仔
tags: [cross-border, ecommerce, dashboard, chrome-extension, sync, maintenance, health-check, recovery]
---

# 面板 + 扩展同步维护

用户靓仔的跨境核价工具有 3 个组件，**必须同步更新**。

## 组件清单

### 当前系统：FVV Stack (`~/fvv-stack/`) ✅ 主力

| # | 组件 | 路径 | 端口/说明 |
|---|------|------|-----------|
| 1 | FastAPI 后端 | `~/fvv-stack/backend/main.py` | `:8649`, 统一数据/API层 |
| 2 | Streamlit Dashboard | `~/fvv-stack/frontend/fvv_dashboard.py` | `:8650`, 管理面板 |
| 3 | Chrome 扩展 (MV3) | `~/fvv-stack/extension/` | 侧边栏，ML选品/核价/上架/采购/主图 |
| 4 | 启动脚本 | `~/fvv-stack/fvv.sh` | `bash fvv.sh {start\|stop\|restart\|status}` |

**三件套对应关系：**
```
FastAPI 后端 (:8649)
  ├── /api/ml/auth/        — 账号管理
  ├── /api/products/sourcing — 选品池
  ├── /api/pricing/calculate — 核价引擎
  ├── /api/listings/        — 上架管理
  ├── /api/orders/purchases  — 采购记录
  ├── /api/after-sales/     — 售后
  └── /api/ml-api/          — ML API代理
        │
  ┌─────┴─────┐
  │ Chrome扩展 │     Streamlit Dashboard (:8650)
  │ 前端采集   │     总览 · 选品池 · 核价
  │ 核价快捷   │     上架管理 · 采购/物流 · 售后
  │ 上架草稿   │     （共用同一后端API）
  │ 采购录入   │
  └───────────┘
```

**FVV Stack 服务管理：**
```bash
# 状态检查
bash ~/fvv-stack/fvv.sh status

# 启动所有
bash ~/fvv-stack/fvv.sh start

# 停止
bash ~/fvv-stack/fvv.sh stop

# 重启
bash ~/fvv-stack/fvv.sh restart
```

扩展加载路径：`chrome://extensions` → 开启开发者模式 → 加载已解压的扩展 → `~/fvv-stack/extension/`

### 旧版（已弃用，逐步淘汰）

| # | 组件 | 路径 | 说明 |
|---|------|------|------|
| 1 | Streamlit 面板 | `~/hermes_dashboard.py` | localhost:8501, 密码 fvv1123 |
| 2 | 普通版扩展 | `~/hermes_extension/` → Windows桌面 | 侧边栏 |
| 3 | 独立版扩展 | `~/hermes_extension_standalone/` → Windows桌面 | 全自制 |

## 同步规则

### FVV Stack 同步
- 后端 (`backend/`) 定义所有 API 路由
- Dashboard (`frontend/`) 和扩展 (`extension/`) 都调同一个后端 API（:8649）
- 三方通过同一后端数据互通，无需手动同步
- 扩展侧增加功能时，检查后端是否已有对应 API 路由

### 旧版同步规则（已弃用）
- 运费表在面板和独立版扩展中都有硬编码（DEFAULT_SHIP）

## 系统健康检查与恢复

当用户隔段时间回来问"好了吗/前面做好了没"时，按以下步骤逐一检查并恢复组件。

### 检查流程 — FVV Stack（当前系统）

```
用户问"好了吗/对应程序呢/之前写的一整套还在吗？"
  │
  ├─① 搜索历史会话 → 找出之前构建了哪些组件
  │  session_search(query="fvv-stack OR dashboard OR 扩展 OR 核价")
  │
  ├─② 检查 FVV Stack 文件完整性
  │  ls ~/fvv-stack/backend/main.py
  │  ls ~/fvv-stack/frontend/fvv_dashboard.py
  │  ls ~/fvv-stack/extension/manifest.json
  │  ls ~/fvv-stack/fvv.sh
  │
  ├─③ 检查 FVV Stack 服务状态
  │  bash ~/fvv-stack/fvv.sh status
  │  curl -s -o /dev/null -w "%{http_code}" http://localhost:8649/health
  │  curl -s -o /dev/null -w "%{http_code}" http://localhost:8650
  │
  └─④ 根据结果行动
       ├─ 文件缺失 → 需要重建（询问用户）
       ├─ 服务未运行 → bash ~/fvv-stack/fvv.sh start
       └─ 全部正常 → 汇报"全部就位"

注意：如果用户提到"本地程序"但你没找到对应文件，先问程序名或功能，不要猜。
```

### 检查流程 — 旧版系统（已弃用）

### 注意事项

- **进程可能因服务器重启、OOM、或手动关闭而消失** — 即使文件完好，dashboard 也经常意外停止
- 检查时先试 HTTP（curl），HTTP 不通再查进程（pgrep），进程也没有才重启
- Session 历史中可能有被删除的旧会话（如因 HTTP 400 修复被删除），优先用 session_search 追踪已存 memory/skills

## 启动命令

### 面板（Streamlit Dashboard）

**⚠️ 在 Hermes Terminal 中不要用 `nohup ... &`** — 会报错。必须用 background 模式：

```python
# 在 Hermes 工具调用中使用 terminal(background=true) 启动
terminal(command="streamlit run ~/hermes_dashboard.py --server.port 8501 --server.headless true", background=true)
# 等待几秒后验证
terminal(command="sleep 3 && curl -s -o /dev/null -w '%{http_code}' http://localhost:8501")
# 返回 200 即成功
```

手动终端启动：
```bash
streamlit run ~/hermes_dashboard.py --server.port 8501 --server.headless true
```

### 网关（systemd 自动管理，已启用+linger）
```bash
hermes gateway start  # 或: systemctl --user start hermes-gateway
```


## HTTP 400 修复

### 错误信息
```
Messages with role 'tool' must be a response to a preceding message with 'tool_calls'
```

### 原因
网关会话（gateway session）消息历史错乱——tool 返回结果丢失了对应的 tool_calls 记录。通常发生在网关意外重启/中断后，Agent 会话的对话历史损坏。

### 修复步骤
```bash
# 1. 找到损坏的 session ID（从 errors.log 中提取）
SESSION_ID=$(grep "tool.*role.*tool_calls" ~/.hermes/logs/errors.log | grep "ERROR \[" | tail -1 | grep -oP '\[\K[^\]]+')

# 2. 删除相关 session 文件
rm -f ~/.hermes/sessions/session_${SESSION_ID}.json
rm -f ~/.hermes/sessions/${SESSION_ID}.jsonl
rm -f ~/.hermes/sessions/request_dump_${SESSION_ID}_*.json

# 3. 重启网关
DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus systemctl --user restart hermes-gateway
```

### 预防
- 网关重启后，先在 bot 里发 `/reset` 或 `/new` 清掉旧会话再正常使用
- 不要在 gateway session 中切换 provider
