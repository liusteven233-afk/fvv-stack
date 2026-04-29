# FVV Stack

跨境业务工具集 — Mercado Libre 拉美电商辅助工具

## 目录结构

```
fvv-stack/
├── setup.sh                     # 一键安装脚本
├── README.md                    # 本文件
├── dashboard/
│   ├── hermes_dashboard.py      # Streamlit 8501核价面板
│   └── requirements.txt         # Python依赖
├── extensions/
│   ├── hermes_extension/        # 核价侧边栏 + popup
│   ├── hermes_chat_extension/   # 双模型聊天扩展
│   ├── hermes_hajimi_extension/ # FVV计算器 (完整哈基米复刻)
│   └── hermes_extension_standalone/ # 核价独立版
├── scripts/
│   ├── fvv-genkey.py            # FVV计算器秘钥生成
│   ├── ollama-proxy.py          # Ollama CORS代理 (localhost:11555)
│   └── hermes-chat              # Hermes CLI tmux持久会话
└── config/
    └── crontab.txt              # 开机自启任务
```

## 秘钥

当前 FVV计算器 秘钥: `FVV-F1D3D04D-A2C1B500-EFA1985A`
到期: 2026-05-06 13:03

## 新机器安装

```bash
git clone <repo-url>
cd fvv-stack
bash setup.sh
```

然后去 Chrome → chrome://extensions → 加载每个扩展
