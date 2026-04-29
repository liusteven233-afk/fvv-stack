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
    ├── crontab.txt              # WSL开机自启任务
    ├── streamlit.toml           # Streamlit配置（主题等）
    ├── chrome-debugger.vbs      # Windows Chrome CDP开机自启脚本
    ├── bash_aliases.txt         # bash别名（hc/dash等）
    └── hermes/
        ├── config.yaml          # Hermes全局配置
        └── profile-local.yaml   # Hermes本地profile配置
```

## 秘钥

当前 FVV计算器 秘钥: `FVV-F1D3D04D-A2C1B500-EFA1985A`
到期: 2026-05-06 13:03

## 新机器完整恢复步骤

### 1. 拉取代码
```bash
git clone git@github.com:liusteven233-afk/fvv-stack.git
cd fvv-stack
```

### 2. 运行安装脚本
```bash
bash setup.sh
```
自动完成: 装依赖、同步扩展、配置crontab

### 3. 手动配置
以下需要手动操作:
- **Chrome**: chrome://extensions → 加载扩展 (4个)
- **Hermes CLI**: 如果使用, 配置 hermes 的 provider/model
- **Ollama**: 确保 Windows Ollama 环境变量 OLLAMA_ORIGINS=*
- **bash别名**: 复制 `config/bash_aliases.txt` 到 `~/.bashrc`
- **Chrome CDP**: 复制 `config/chrome-debugger.vbs` 到 Windows 启动文件夹
- **Streamlit**: 复制 `config/streamlit.toml` 到 `~/.streamlit/config.toml`
- **Hermes配置**: 参考 `config/hermes/` 下的配置文件

### 4. 启动服务
```bash
# Dashboard
streamlit run ~/hermes_dashboard.py --server.port 8501

# Ollama代理
python3 ~/.local/bin/ollama-proxy.py

# Hermes CLI (tmux)
hermes-chat
```
