# FVV Stack — 美客多全流程运营系统

## 系统架构

```
┌── Chrome扩展 (MV3) ──────────────────────────┐
│  ML选品采集  ·  1688货源匹配  ·  核价        │
│  上架助手  ·  主图扒取下载                   │
└──────────────────┬──────────────────────────┘
                   │ chrome.runtime.sendMessage
┌── FastAPI 后端 (8649) ─────────────────────┐
│  ML OAuth多账号  ·  选品引擎               │
│  核价(6国+运费)  ·  上架API                │
│  采购/对价  ·  售后多账号统一管理           │
└──────────────────┬──────────────────────────┘
                   │
┌── Streamlit Dashboard (8650) ──────────────┐
│  总览  ·  选品池  ·  核价                  │
│  上架管理  ·  采购/物流  ·  售后中心       │
└────────────────────────────────────────────┘
```

## 核心工作流

```
ML前端选品(发现爆款) → 1688找货源 → 核价
→ 上架ML → 优化listing → 发货(采购记录+物流追踪) → 售后
```

## 成本公式

```
成本 = 1688实际下单价(¥) + 国内运费(¥) + 货代费用(¥)
净收益 = ML到账(USD) - 成本(USD)
对价差异 = 实际净收益(¥) - 核价预估利润(¥)
```

## 启动

```bash
# 一键启动所有服务
bash ~/fvv-stack/fvv.sh start

# 单独启动后端
systemctl --user start fvv-backend

# 单独启动Dashboard
systemctl --user start fvv-dashboard
```

## 访问地址

| 服务 | 地址 |
|------|------|
| FastAPI 后端 | http://localhost:8649 |
| Streamlit Dashboard | http://localhost:8650 |
| API 文档 (Swagger) | http://localhost:8649/docs |

## Chrome 扩展安装

1. 打开 `chrome://extensions`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展"
4. 选择 `~/fvv-stack/extension`

## 数据库

SQLite: `~/fvv-stack/data/fvv_stack.db`

## ML账号配置

1. 在 Dashboard 的"ML账号"Tab 添加账号
2. 需要: Client ID, Client Secret, Access/Refresh Token
3. 注册应用: https://developers.mercadolibre.com

## 文件结构

```
~/fvv-stack/
├── backend/
│   ├── main.py          # FastAPI入口
│   ├── api/             # API路由
│   │   ├── ml_auth.py   # ML OAuth + 多账号
│   │   ├── ml_api.py    # ML API代理
│   │   ├── products.py  # 选品池
│   │   ├── listings.py  # 上架管理
│   │   ├── orders.py    # 订单/采购
│   │   ├── after_sales.py # 售后
│   │   └── pricing.py   # 核价引擎
│   ├── models/          # 数据库模型
│   └── services/        # ML API服务
├── frontend/
│   └── fvv_dashboard.py # Streamlit Dashboard
├── extension/           # Chrome扩展
│   ├── manifest.json
│   ├── background.js
│   ├── scripts/         # 内容脚本
│   │   ├── ml_scraper.js
│   │   └── ali_scraper.js
│   └── sidepanel/       # 侧面板
│       ├── sidepanel.html
│       └── sidepanel.js
├── data/                # SQLite数据库
├── fvv.sh               # 启动脚本
└── ARCHITECTURE.md      # 架构文档
```
