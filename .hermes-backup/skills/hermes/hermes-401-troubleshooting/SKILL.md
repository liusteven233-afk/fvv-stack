---
name: hermes-401-troubleshooting
description: 解决 Hermes 网关/agent 报 HTTP 401 "令牌不合法" 错误的排查和修复步骤
category: hermes
---

# Hermes HTTP 401 令牌不合法 — 排查指南

## 触发条件
- Hermes 网关或 agent 日志中出现：`HTTP 401` / `令牌不合法` / `Non-retryable client error: Error code: 401`
- 通常是 API key 填错、过期、或未配置

## 第一步：定位 401 来源 — LLM Provider vs 平台 Token

不是所有 "令牌不合法" 都是 LLM API key 的问题。**先读日志定源头：**

| 特征 | 来源 | 说明 |
|------|------|------|
| 日志中带 `平台.飞书` 或 `platform.feishu` 或 `[Feishu]` | **飞书 app token** | 飞书开放平台 token 过期，与 LLM 无关 |
| 日志中带 `[QQBot:` | **QQ bot token** | QQ bot 的 access_token 过期 |
| 日志中带 `[Discord]` | **Discord bot token** | Discord 机器人 token 失效 |
| 日志中带 `provider.auth\|Primary provider` 字样 | **LLM API key** | 模型提供商认证失败 |
| 日志中带 `Auxiliary.*401\|title_generation\|compression\|session_search\|skills_hub` | **辅助模型 401** | 见下方 auxiliary 陷阱章节 |
| 日志中带 `curl -s --max-time` 测试返回 200 ✅，但 gateway 同时报 "令牌不合法" | **平台 token 问题** ✅ | LLM 接口本身正常，问题在聊天平台 |

### 快速诊断命令

```bash
# 查看最近 20 条 401/error，判断来源
grep -E "401|error|令牌不合法" ~/.hermes/logs/gateway.log | tail -20

# 如果看到大量 [Feishu] / [QQBot] / [Discord] 等平台标记 → 平台 token 问题
# 如果看到 "Primary provider auth failed" → LLM API key 问题
# 如果看到 "Auxiliary.*failed.*401" → 辅助模型配置问题
```

### 验证 LLM API 本身是否正常

注意：**平台 401 和 LLM API 401 可能同时存在**。先确认 LLM API 通不通：

```bash
source ~/.hermes/.env && curl -s --max-time 10 https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}],"max_tokens":5}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'choices' in d else 'FAIL: '+str(d))"
```

- 返回 `OK` → LLM API 正常，401 来自平台 token
- 返回 `FAIL` → LLM API key 有问题，走下方 LLM provider 排查步骤

## 根因推理

401 的本质是 **认证失败**，但不同场景触发的原因不同。理解根因才能快速定位：

| 症状 | 原因 |
|---|---|
| 切模型后立即 401 | `model.api_mode` 残留旧格式或 provider 的 API key 未配置 |
| 自定义 provider（不在 Hermes 内置 PROVIDER_REGISTRY 里）报 401 | 该 provider 不是已知 provider（如 `bltcy`），`_seed_from_env()` 跳过它 → credential pool 为空 → 无 key → 401 |
| 聊天正常但 gateway 日志有 401 | `fallback_providers` 或 auxiliary 模型链到无 key 的 provider |
| 聊天正常但 gateway 日志有 401，`title_generation`/`session_search` 等 auxiliary 配置了 `api_key: ''` | auxiliary 配置段里的 `api_key: ''` 显式空字符串会覆盖 credential pool 查找，导致实际不带 key 请求 → 401。即使 credential pool 有有效条目也不起作用 |
| CLI 弹出 `⚠ Compression summary failed: Error code: 401` | auxiliary.compression 段的 `api_key: ''` + `provider: auto`，压缩任务拿不到 key → 401。与 title_generation/session_search 同理 |
| auxiliary 段同时设了 `provider: xxx` + `api_key` + `base_url` | `_resolve_task_provider_model()` 看到 `cfg_provider != "auto"` 时**丢弃** `cfg_base_url` 和 `cfg_api_key`，只传 provider 名下去 → 命名自定义 provider 路径去 `providers.xxx` 段找 key（通常为空）→ `"no-key-required"` → 401 |
| 某个 provider 单独报 401，其他正常 | 该 provider 的 API key 在 `.env` 中是旧 key 或无效 key |
| OpenRouter 随机 401 | OR 本身不稳定，直连更可靠 |
| 401 但 `gateway_state.json` 显示全部平台 "connected"，curl 测 LLM API 也能通 | **损坏的会话（corrupted session）** | 旧 session 缓存了过期/无效的认证状态，新消息先尝试 resume 该 session → 401，然后才新建 session → 延迟/丢消息 |
| 400 "Messages with role 'tool' must be a response to a preceding message with 'tool_calls'" | **损坏的会话（corrupted session，模型切换后）** | 切模型后，旧 session 对话历史中的 tool call/response 消息结构与新模型不兼容。新模型的 API 验证发现 tool role 消息没有对应前序 assistant 消息的 `tool_calls` 字段 → 400。同样修复：删旧 session + 重启 gateway |
| "The model returned no response after processing tool results" / "Empty response from model — retrying" | **损坏的会话（corrupted session，模型切换后）** | 旧模型产生的工具调用历史包含旧格式的 tool_calls/tool_result，新模型收到后不识别或拒绝响应 → 空回复。同样修复：删旧 session + 重启 gateway |
| 报错 `Your api key: ****ired is invalid`（结尾 "ired" 可见） | **auxiliary config 无 api_key + 有 base_url → 走 "custom" 路径 → 用了 "no-key-required" 作为 key** | `_resolve_task_provider_model()` 先检查 `cfg_base_url`，有值则立即返回 `provider="custom"`，丢弃已配置的 provider 名。然后 `resolve_provider_client("custom")` 中 `explicit_api_key` 为 None → `"" or os.getenv("OPENAI_API_KEY") or "no-key-required"`。请求携带 key="no-key-required" 发送到服务端 → 401。"ired" 正是 "no-key-required" 的最后 4 个字符 |
| 报错 `Your api key: ****<实际 key 结尾>`（如 `****0d4d`，结尾匹配真实 key）但 curl 用 `.env` 的 key 能通 | **auth.json credential pool 中的 token 已过期/不同步（stale token）** | `.env` 中有正确的新 key，但 `auth.json credential_pool` 缓存了旧/过期 token。Hermes 从 credential pool 取 key 而非直接从 `.env` 读。curl 用 `source ~/.hermes/.env && curl ...` 走的是 .env 的正确 key，所以能通。检查：对比 auth.json 中该 provider 的 access_token 长度和前缀，与 source .env 后 env var 的值。如果不同，用正确 key 更新 auth.json credential_pool 中该 provider 的 access_token，并清空错误标记（last_status, last_error_code 等） |
| 报错 401，`auth.json credential_pool` 中有该 provider 条目（如 `source: \"env:BLTCY_API_KEY\"`），`last_status: ok`，**但 curl 用 `.env` 的 key 直连 API 正常**，且 `source ~/.hermes/.env && echo $BLTCY_API_KEY` 输出空 | **systemd service 的环境变量缺失** | gateway 通过 systemd 运行，有独立的 `Environment=` 列表。`.env` 文件存在但** systemd 不会自动读它**。auth.json 设 `source: \"env:BLTCY_API_KEY\"` 但该 env var 不存在于 systemd 进程环境 → Hermes 读到空 → 无 key 请求 → 401。诊断：`cat /proc/$(pgrep -f 'gateway run' | head -1)/environ 2>/dev/null | tr '\\0' '\\n' | grep BLTCY` 若为空则确认。修复见下方「场景：systemd gateway 缺少 env var」 |

## 排查步骤

1. **检查 `model.api_mode` — 常见但易漏**
   ```bash
   grep api_mode ~/.hermes/config.yaml
   ```
   如果存在且不是 `chat_completions`（例如 `anthropic` 格式但实际是 OpenAI 兼容 API），API 不认识请求格式会直接 401。
   - **修复：** 删掉 `api_mode` 整行，或改成 `chat_completions`

2. **检查当前配置**
   ```bash
   hermes config set   # 查看当前 api_key/provider 设置
   ```

3. **删除对应 provider 的 env key + 重设（切 provider 后必做）**
   切模型后 `.env` 里的 key 可能是旧 provider 的，新 provider 根本没配。
   ```bash
   # 找到并注释/删除对应 provider 的 key 行
   nano ~/.hermes/.env
   # 例如从 deepseek 切到 bltcy，先删掉 BLTCY_API_KEY 行
   ```
   然后重新运行配置向导录入正确 key：
   ```bash
   hermes setup        # 重新运行配置向导
   ```

4. **根据 provider 检查 key 有效性**
   - **OpenRouter:** 去 https://openrouter.ai/keys 重新生成
   - **Anthropic:** 去 https://console.anthropic.com/ 确认 key 未过期/撤销
   - **DeepSeek:** 去 https://platform.deepseek.com 确认 key 有效
   - **bltcy:** 检查 `BLTCY_API_KEY` 环境变量是否存在且有效

4. **运行诊断**
   ```bash
   hermes doctor       # 自动检测各 provider 连通性
   ```

5. **直接修复（手动）**
   - 编辑 `~/.hermes/config.yaml`
   - 找到目标 provider 的 `api_key` 字段或 `providers` 段
   - 替换为有效 key
   - 保存后重启 gateway

## 场景：systemd gateway 缺少 env var

### 触发条件
- Hermes gateway 通过 systemd 运行（`systemctl --user status hermes-gateway.service` 显示 active）
- `.env` 文件中有正确 API key（如 `BLTCY_API_KEY=sk-xxx...`）
- curl 用该 key 直连 API 返回 200 ✅
- 但 Hermes 报 401，`auth.json credential_pool` 中该 provider 条目 `source: "env:XXX_API_KEY"` 但 key 为空
- 诊断：`cat /proc/$(pgrep -f 'gateway run' | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep <API_KEY_ENV_VAR>` 输出为空

### 根因
systemd service 有独立的 `Environment=` 声明列表。`.env` 文件不会被 systemd 自动读入。auth.json 的 `source: "env:XXX_API_KEY"` 从进程环境读取 → 该环境变量不存在 → 读到空 → 请求不带 key → 401。

### 修复

**方案 A（推荐——EnvironmentFile 注入）：**
```bash
# 1. 创建精简 env 文件（只含需要的 key）
sed -n 's/^BLTCY_API_KEY=//p' ~/.hermes/.env > ~/.hermes/.gateway-extra.env
# 只取一行: BLTCY_API_KEY=sk-xxx...

# 2. 创建 systemd drop-in override
mkdir -p ~/.config/systemd/user/hermes-gateway.service.d/
cat > ~/.config/systemd/user/hermes-gateway.service.d/50-extra-env.conf << 'EOF'
[Service]
EnvironmentFile=/home/<USER>/.hermes/.gateway-extra.env
EOF

# 3. 重新加载并重启
systemctl --user daemon-reload
systemctl --user restart hermes-gateway.service
```

**方案 B（SystemdDropIn——直接改 Environment 行）**  
只适合单变量：
```bash
systemctl --user edit hermes-gateway.service
# 在 [Service] 下加一行:
# Environment=BLTCY_API_KEY=sk-xxx...
# 保存后退出，自动 reload
```

**方案 C（懒人——把 key export 到 shell profile）**  
如果 gateway 和 CLI 都从一个 shell 启动（非 systemd）：
```bash
echo 'export BLTCY_API_KEY=sk-xxx...' >> ~/.bashrc
source ~/.bashrc
# 然后重启 gateway
```

### 验证
```bash
# 检查 gateway 进程环境是否已有该变量
cat /proc/$(pgrep -f 'gateway run' | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep BLTCY
# 应输出: BLTCY_API_KEY=sk-xxx...

# 再试 API 调用
hermes doctor 或直接聊天测试
```

### 预防
- 新加 provider 时，如果 gateway 走 systemd，记得同时配 EnvironmentFile drop-in
- 或者在 `auth.json` 中不用 `source: "env:..."`，改用 `source: "manual"` + 直接写入 access_token
- 切换 API key 后，同步更新 `.gateway-extra.env` 文件 + 重启 gateway

---

## 场景：完全移除一个 provider

### 触发条件
- `gateway_state.json` 显示所有平台 `state: "connected"`
- `curl` 直测 LLM API 返回 200 OK
- 但用户发消息后 bot 不回复、慢回复、或一会好一会坏
- 日志中出现 `Non-retryable client error: Error code: 401` 或 `400` 或 `Empty response from model` 关联到**某个特定 session ID**

### 根因
Hermes gateway 在收到用户消息时会先查找该聊天的**最近活跃 session**并尝试 resume。如果那个 session 在被创建时使用了现已过期/无效的 API key（例如你后来换了 API key 或 provider），session 中缓存了旧的认证状态，每次 resume 都触发 401。

结果：用户消息 → resume 旧 session → 401 → 创建新 session → 成功。但每次都会先卡在 401 上，用户感受到 bot 坏了几十秒才回复。

### 诊断两步走

**第一步：先确认用户说的"model不对"是不是配置问题**
有时用户说"通讯bot坏了/没换过来"其实是主模型 config 没切到期望的 provider。不要直接扎进 401 排查：
```bash
grep -A3 "^model:" ~/.hermes/config.yaml
# 确认 model.provider, model.default, model.base_url 是否匹配用户期望
# 如果不匹配，先改 config + 重启 gateway，再观察 401 是否消失
```

**第二步：确认是 corrupted session 问题**
```bash
# 1. 确认 gateway 进程存活
cat ~/.hermes/gateway_state.json | python3 -m json.tool

# 2. 查找关联 session ID 的 401 错误
grep -E "401|error|令牌不合法" ~/.hermes/logs/errors.log | grep -oP '\[[0-9_]+_[a-f0-9]+\]' | sort -u

# 3. 检查 session 是否还存活
ls ~/.hermes/sessions/ | grep <可疑 session ID>
# 通常 session 文件会被自动清理，但有 session 仍标记在 state.db 中

# 4. 确认 LLM API 本身正常（排除 key 问题）
source ~/.hermes/.env && curl -s --max-time 10 https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}],"max_tokens":5}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'choices' in d else 'FAIL: '+str(d))"
```

### 修复

```bash
# 1. 删除损坏 session 的所有残留文件（如果有）
rm -f ~/.hermes/sessions/<session_id>*

# 2. 清理 checkpoint（session 可能从 checkpoint 恢复）
# 删除后 session 文件可能仍被 gateway 通过 checkpoints 重新生成
rm -rf ~/.hermes/checkpoints/*

# 3. 重启 gateway
# 方法 A: systemd（有 DBUS 的环境）
DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus systemctl --user restart hermes-gateway

# 方法 B: WSL / 无 systemd 环境（kill -9 后手动启动）
PID=$(cat ~/.hermes/gateway.pid | python3 -c "import sys,json; print(json.load(sys.stdin)['pid'])")
kill -9 $PID
sleep 5
# ⚠️ systemd Restart=on-failure 可能不工作（WSL 无 dbus bus）
# 需要手动启动 gateway：
hermes gateway run --replace &
# 等待 20 秒确认所有平台 connected
sleep 20
cat ~/.hermes/gateway_state.json | python3 -m json.tool
# 应有 platform 节点: discord/qqbot/feishu/telegram 全部 state: "connected"

### 预防
- **切 API key 或 provider 后立即重启 gateway** — 不要等到 session 过期自然淘汰
- 如果经常切 key，考虑在 `approvals.mode: off` 环境下先做 `hermes model` + gateway restart 的自动化脚本
- 对于长期运行的 gateway，定期主动清理旧 session（可以 cron job `find ~/.hermes/sessions -name '*.json' -mtime +7 -delete`）

## 常见陷阱

### 0. Provider 名与 credential pool key 不匹配（新增！）

当你更新了 `.env` 文件里的 API key，curl 测试返回 200 ✅，但 Hermes 实际调用仍然 401 时，检查 **credential pool 的 key 名**：

```bash
cat ~/.hermes/auth.json | python3 -c "import json,sys; a=json.load(sys.stdin); print('Credential keys:', list(a.get('credential_pool',{}).keys()))"
```

**症状：** credential pool 里条目的 key（如 `bltcy`、`custom:bltcy`）与 `model.provider` 配置的值（如 `bltcy-gemini`）**不匹配**。Hermes 按 provider 名去 pool 里找 key → 找不到 → fallback 到旧缓存 → 401。

**场景示例：**
- 你在 config.yaml 中配了 `provider: bltcy-gemini`
- 但 credential pool 只有 `bltcy` 或 `custom:bltcy` 条目
- curl `https://api.bltcy.ai/v1/models` 直连通的
- Hermes 仍然 401

**修复：删除旧条目，新增匹配 provider 名的条目**

```bash
cd ~/.hermes/hermes-agent && source venv/bin/activate && python3 -c "
import json
path = '/home/mzls233/.hermes/auth.json'
with open(path) as f: auth = json.load(f)

# 1. 删除旧的不匹配条目
for old_key in list(auth['credential_pool'].keys()):
    if 'bltcy' in old_key and old_key != 'bltcy-gemini':
        del auth['credential_pool'][old_key]
        print(f'Deleted old entry: {old_key}')

# 2. 新增精确匹配 provider 名的条目
new_key = 'sk-xxx...'  # 替换为实际 key
auth['credential_pool']['bltcy-gemini'] = [{
    'auth_type': 'api_key',
    'access_token': new_key,
    'base_url': 'https://api.bltcy.ai/v1',
    'label': 'MANUAL_MATCHING_PROVIDER',
    'source': 'manual',
    'priority': 0,
    'last_status': 'ok',
    'request_count': 0
}]

with open(path, 'w') as f:
    json.dump(auth, f, indent=2)
print('Added credential for provider: bltcy-gemini ✅')
"
```

**原理：** `resolve_provider_client()` 用 `model.provider` 的值作为 credential pool 的 key 去查。如果 key 名不匹配（`bltcy` vs `bltcy-gemini`），查不到就拿不到有效 key → 401。删除旧 key 是为了避免 `_prune_stale_seeded_entries` 干扰。

同时必须清理 `~/.hermes/auth.json` 中该 provider 的 `last_status: exhausted` / `last_error_code: 401` 标记，否则 Hermes 会跳过该 credential 不再重试：

```python
for cred in auth['credential_pool'].get('bltcy-gemini', []):
    cred['last_status'] = 'ok'
    cred.pop('last_error_code', None)
    cred.pop('last_error_reason', None)
    cred.pop('last_error_message', None)
    cred.pop('last_status_at', None)
    cred.pop('last_error_reset_at', None)
```

### 0a. Named custom provider 条目必须有 api_key（命名 provider 陷阱）

当你在 `config.yaml providers:` 段下定义了一个命名 provider（如 `bltcy`），并在 `model.provider` 或 `auxiliary.*.provider` 中使用它时，`resolve_provider_client()` 走**命名自定义 provider 路径**。该路径从 `providers.<name>.api_key` 读取 key，若不存在则 fallback 到 `"no-key-required"` → 401。

**这种现象与 credential pool 无关。** 即使 credential pool 有 bltcy 的 manual 条目，主模型初始化时仍然可能因为 `providers.bltcy` 无 `api_key` 字段而报 `Provider: custom` 的 401。

**修复：**
```yaml
providers:
  bltcy:
    api_key: 'sk-xxx...'       # 必填！显式写入 key
    base_url: https://api.bltcy.ai/v1
    key_env: BLTCY_API_KEY     # 可选：声明 key 来源的 env var 用于刷新
    type: openai
```

加了 `api_key` 后，三种路径都能拿到正确 key：
1. 主模型初始化 → 命名自定义 provider 路径 → `providers.bltcy.api_key` ✅
2. auxiliary 走 `custom` 路径（无 provider 行，只配 base_url+api_key）→ explicit_api_key ✅
3. credential pool 手动条目（manual source）→ 已有 ✅

### 0b. ⚠️ 内置 provider 不要重复定义在 providers: 段

Hermes 内置已知 provider（如 `deepseek`、`openai`、`anthropic`、`gemini` 等）不需要在 `config.yaml providers:` 段重复声明。如果重复定义了且没有 `api_key`：

```yaml
providers:
  deepseek:           # ❌ 不要！deepseek 是内置 provider
    base_url: https://api.deepseek.com
    type: openai
    # 没有 api_key → resolve_provider_client("deepseek")
    # 从 providers.deepseek 找 key → 空 → "no-key-required" → 401
```

**症状：** main chat 或 auxiliary 任务使用 `provider: deepseek` 但报 401，即使 env 中有有效 `DEEPSEEK_API_KEY`，credential pool 也有条目。

**原理：** 当 `providers.deepseek` 存在于 config 中时，`resolve_provider_client("deepseek")` 走命名自定义 provider 路径，不从 credential pool 查找 key（pool 只服务于没有 `providers.<name>` 段的 provider）。

**修复：删掉 `providers.deepseek` 整段。**

```yaml
providers:
  bltcy:
    base_url: https://api.bltcy.ai/v1
    type: openai
  # deepseek 是内置 provider，不需声明
```

### 1. 自定义 provider 不在 PROVIDER_REGISTRY 时 env key 无法自动加载
某些自定义 provider（如 `bltcy`、自定义私有 endpoint）定义在 `config.yaml providers:` 段但不是 Hermes 内置已知 provider。此时 `BLTCY_API_KEY` 即使存在 `.env` 里，credential pool 也不会自动从它加载：

```python
# credential_pool.py _seed_from_env:
pconfig = PROVIDER_REGISTRY.get(provider)  # None → 跳过
if not pconfig or pconfig.auth_type != AUTH_TYPE_API_KEY:
    return
```

**症状：** env 里有 key、curl 直连能通，但 Hermes 报 401。`credential_pool` 中该 provider 条目为 0。

**修复（临时注入手动条目）：**
```python
cd ~/.hermes/hermes-agent && source venv/bin/activate && python3 -c "
from hermes_cli.config import get_env_value
from agent.credential_pool import write_credential_pool, load_pool

key = get_env_value('BLTCY_API_KEY')  # 替换为实际 env var 名
entries = [{
    'source': 'manual',
    'auth_type': 'api_key',
    'access_token': key,
    'base_url': 'https://api.bltcy.ai/v1',  # 替换为实际 base_url
    'label': 'MANUAL_ENTRY',
    'priority': 0
}]
write_credential_pool('bltcy', entries)  # 替换为实际 provider 名
pool = load_pool('bltcy')
print(f'Pool entries: {len(pool.entries())}')
"
```

验证：该条目用 `source: manual`，不会被 `_prune_stale_seeded_entries` 删除，一次修复永久有效。

### 2. API key 不在 config.yaml 里
某些 provider 不写 `api_key` 字段，而是依赖环境变量（`DEEPSEEK_API_KEY`、`BLTCY_API_KEY`）或 `auth.json` credential pool。检查方式：
```bash
env | grep API_KEY       # 环境变量
cat ~/.hermes/auth.json  # credential pool
```

### 2. fallback_providers 引发无声 401
`fallback_providers` 中配了无有效 key 的 provider，网关后台（context summary、title generation 等）会反复报 401，但对话本身可能正常工作（走的是 config 主模型）。
- **症状：** `journalctl --user -u hermes-gateway` 有 401，但聊天正常
- **修复：** 清空 fallback_providers 或去掉无效 provider
  ```yaml
  fallback_providers: []
  ```

### 3. ⚠️ auxiliary 段同时设了 base_url + provider → 谁先谁后？（已修正：base_url 优先级更高）

**注意：本陷阱在 v0.5.0+ 中行为已变。** 旧版是 `provider` 优先（丢弃 base_url+api_key），新版是 `base_url` 优先（丢弃 provider 名）。当前代码检查顺序：

```python
# _resolve_task_provider_model() 中的检查顺序：
if cfg_base_url:        # ① 先检查 base_url
    return "custom", model, cfg_base_url, cfg_api_key, api_mode
if cfg_provider and cfg_provider != "auto":  # ② 再检查 provider
    return cfg_provider, model, None, None, api_mode
```

**新版行为（当前代码）：base_url 优先 → 走 "custom" 路径**
```yaml
compression:
  base_url: https://api.deepseek.com    # ← 有值，立即走 custom 路径
  provider: deepseek                     # ← 被丢弃！provider 名无效
  api_key: ''                            # ← custom_key = "" → "no-key-required"
```
→ `("custom", model, "https://api.deepseek.com", cfg_api_key, mode)` → 若 cfg_api_key 为空 → `"no-key-required"` → 401（错误信息结尾带 "ired"）

**旧版行为（老代码）：provider 优先 → 走命名 provider 路径**
```yaml
compression:
  provider: bltcy                        # ← 有值，走命名 provider 路径
  base_url: https://api.bltcy.ai/v1      # ← 被丢弃！
  api_key: 'sk-xxx'                      # ← 也被丢弃！
```
→ `("bltcy", model, None, None, mode)` → 去 `providers.bltcy.api_key` 找 key → 通常无 api_key → `"no-key-required"` → 401

**如何判断你遇到的是哪版？**
| 特征 | 新版（base_url 优先） | 旧版（provider 优先） |
|------|----------------------|----------------------|
| Hermes 版本 | 当前版本 | 旧版本（< v0.5.0） |
| 401 错误信息 | `****ired`（末尾 "ired" 来自 "no-key-required"） | 各种格式 |
| 修复方向 | 加 explicit api_key 或删 base_url | 删 provider 行或删 base_url |

**通用修复（两版都适用）：三选一**

**方案 A（推荐——显式 api_key，删 provider）：**
```yaml
compression:
  api_key: 'sk-xxx'       # 显式 key
  base_url: https://api.deepseek.com
  model: deepseek-v4-flash
  # 不写 provider 行 → 走 "custom" 路径，explicit_api_key 生效 ✅
```
**方案 B（内置 provider，不写 base_url）：**
```yaml
compression:
  model: deepseek-v4-flash
  provider: deepseek       # 内置 provider，回退 credential pool
  # 不写 base_url → 走内置 provider 路径 ✅
```
**方案 C（显式 api_key + 保留 base_url + provider 作标签）：**
```yaml
compression:
  api_key: 'sk-xxx'       # 必填！否则 "no-key-required"
  base_url: https://api.deepseek.com
  provider: deepseek       # 实际被丢弃，仅作日志标签
  model: deepseek-v4-flash
```
⚠️ 注意：即使写了 provider，实际仍走 "custom" 路径，api_key 必须显式填写。

同上适用于 `session_search`、`skills_hub`、`vision`、`title_generation`、`mcp`、`approval`、`web_extract` 等所有 auxiliary 段。

### 3a. 快速诊断：报错结尾带 "ired" → base_url 路径的 "no-key-required"

当你看到错误信息结尾显示 `Your api key: ****ired is invalid`（"ired" 可见），这基本可以确定是陷阱 3 的情景：

- 某 auxiliary 段同时有 `base_url` + `provider`，且**没有写 `api_key`**
- `_resolve_task_provider_model()` 因 `cfg_base_url` 非空返回 `provider="custom"`
- `resolve_provider_client("custom")` 中 `explicit_api_key` 为 None → fallback 到 `"no-key-required"`
- `"no-key-required"` 的**最后 4 个字符就是 "ired"**
- 该 key 发到 API → 401

**快速验证：** 错误消息是 OpenAI 标准格式（`authentication_error`/`invalid_request_error`），不是 DeepSeek 的 "令牌不合法"。

### 4. auxiliary 模型用 provider: auto 也会触发
`compression`、`session_search`、`title_generation`、`skills_hub`、`vision`、`web_extract` 等若设为 `provider: auto`，可能通过 fallback 链调到无 key 的 provider。应将它们显式指定到有效 provider：
```yaml
session_search:
  provider: bltcy          # 非 auto
  base_url: https://api.bltcy.ai/v1
  model: gemini-3.1-flash-lite-preview
```

### 4. auxiliary 配置段里 `api_key: ''` 显式空字符串 → 始终 401

这是容易踩的坑：auxiliary 配置（`compression`、`title_generation`、`session_search`、`skills_hub` 等）里写 `api_key: ''` 会让 Hermes 用空字符串作为 key 去请求，**跳过** credential pool 查找。

**场景：** main chat 正常（走 credential pool），但 gateway 日志反复报 `compression` / `title_generation` / `session_search` / `skills_hub` 等 auxiliary 任务 401。或在 CLI 中看到 `⚠ Compression summary failed: Error code: 401`。

**⚠️ 重要：对于自定义 provider（不在 PROVIDER_REGISTRY 里的，如 bltcy），credential pool 不服务于 auxiliary 任务。** 即使你做了手动注入（陷阱 1 的方法），pool 的条目也只供给主模型。Auxiliary 任务有独立的 key 解析路径，不会查 manual pool 条目。因此：

| 配置写法 | 对内置 provider（deepseek 等） | 对自定义 provider（bltcy 等） |
|----------|-------------------------------|------------------------------|
| `api_key: ''` | ❌ 跳过 pool → 401 | ❌ 跳过 pool → 401 |
| `api_key: sk-xxx` | ✅ 正常 | ✅ 正常 |
| 不写 `api_key` 行 | ✅ 回退 pool 查找 | ❌ 仍然 401（pool 不服务 auxiliary） |
| `provider: auto` | ✅ 走 fallback 链 | ⚠️ 取决于 fallback 链上是否有有效 provider |

**修复方法（按优先级）：**
1. **最佳：** 在 auxiliary 配置段里显式填入有效 key（推荐）
2. **次选：** 确保 `fallback_providers` 里有有效 provider + 去掉 `api_key` 行
3. **不推荐：** 留 `api_key: ''` 然后指望 pool 兜底 — 对自定义 provider 行不通

```bash
# 检查 auxiliary 配置中是否有空 api_key
grep -A2 'title_generation\|session_search\|skills_hub\|compression' ~/.hermes/config.yaml | grep 'api_key'
# 如果看到 api_key: '' 或 api_key: ""，填入实际 key 值
```

#### 5. 第三方 API 中转 (Proxy/中转API) 的工具调用兼容性

当你通过第三方代理 API（如 shiyunapi.com、bltcy.ai 等中转服务）使用模型时，简单聊天可能正常，但 Hermes 的工具调用（tool calls）可能失败。不同模型类别通过代理时的兼容性不同：

| 模型类别 | 举例 | 通过中转 API 的工具调用兼容性 |
|---------|------|------------------------------|
| **Non-thinking OpenAI 兼容** | `deepseek-v3`, `deepseek-chat`, `qwen3-xxx`, `gpt-4o-mini` | ✅ 通常正常 |
| **DeepSeek thinking models** | `deepseek-v4-flash`, `deepseek-r1` | ⚠️ 需要 `reasoning_content` 传回。中转 API 的 OpenAI 兼容层通常不处理这个字段 → 返回错误: `The reasoning_content in the thinking mode must be passed back to the API` |
| **Gemini 类模型** | `gemini-3.1-flash-lite-preview`, `gemini-2.0-flash` | ⚠️ Gemini 原生 API 要求 tool call response 含 `thought_signature`。中转 API 的 OpenAI 兼容层不添加该字段 → 返回错误: `Function call is missing a thought_signature` |
| **Claude 类模型** | `claude-sonnet-4`, `claude-opus-4` | ⚠️ Gemini 同类问题。Claude 通过 OpenAI 兼容层中转时，工具调用格式可能不兼容 |

**诊断流程：**

```bash
# 1. 确认简单聊天能通
source ~/.hermes/.env && curl -s --max-time 10 <BASE_URL>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $<API_KEY_ENV>" \
  -d '{"model":"<MODEL>","messages":[{"role":"user","content":"hi"}],"max_tokens":10}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'choices' in d else 'FAIL')"

# 2. 如果简单聊天 OK 但 Hermes 报 "Empty response" / "no response after processing tool results"
#    → 测试工具调用（完整 round-trip）：
#    用 Python 或 curl 模拟：发消息 → 拿 tool_call → 传回 tool_result → 等最终回复
#    失败时看错误信息：
#    - "thought_signature" → Gemini 类模型，换非 Gemini 模型
#    - "reasoning_content" → DeepSeek thinking 模型，换非 thinking 模型
#    - "no content/tool_calls" → 不支持该模型类型的工具调用

# 3. 修复：换用该中转 API 上支持工具调用的模型
#    例如 shiyunapi.com 上 deepseek-v3 工作正常，deepseek-v4-flash 不工作
```

**常见错误信息对照：**

| 错误信息 | 原因 | 修复 |
|---------|------|------|
| `Function call is missing a thought_signature` | Gemini 模型通过中转 API | 换非 Gemini 模型 |
| `The reasoning_content in the thinking mode must be passed back` | DeepSeek thinking 模型通过中转 API | 换 `deepseek-v3` 或 `deepseek-chat`（非 thinking） |
| `Empty response from model` / `Model returned no response after processing tool results` | 工具调用 round-trip 失败（多种原因） | 先排查模型兼容性，再排查 corrupted session |
| `LLM returned invalid response (type=str): '<!DOCTYPE html>'` | **第三方 API 中转（如 shiyunapi.com）与 OpenAI Python SDK 版本不兼容** | curl 和 httpx 直连能通，但 OpenAI SDK 1.109+ 返回原始字符串而非解析后的 Response 对象 → Hermes auxiliary 任务收到 HTML 页面内容。换用 SDK 兼容的 provider 或直连 |

**预防：切模型后先测试工具调用 round-trip，再用于生产。** 简单聊天通 ≠ Hermes 正常工作。

### 4. OpenRouter 不稳定 — 优先用直连
OpenRouter 是反向代理层，它的 401 可能是：
- OpenRouter 侧 API key 过期/限流/路由故障
- 并非你本地 key 的问题

症状：用其他客户端（如 curl 直连）能正常调用，但通过 OpenRouter 就 401。

**建议：** 换成直连 Anthropic 或 OpenAI 的 key，少一层中间件，故障面更小。

## 为什么这些步骤有效？（根因解析）

- **删 `api_mode`：** Hermes 的 `api_mode` 字段决定请求格式。设成 `anthropic` 但实际是 OpenAI 兼容 API，请求体结构（messages 格式、role 命名）不匹配，服务器拒收 → 401。
- **删 `.env` key 重跑 `hermes setup`：** `.env` 里可能残留旧 provider 的 key（例如切到 bltcy 后 `DEEPSEEK_API_KEY` 还在但 `BLTCY_API_KEY` 不存在）。`hermes setup` 只覆盖你重新填的那个 key，不会自动清理其他 provider 的无效 key。
- **`hermes doctor` 一步到位：** 同时检查 config 结构、env key 存在性、API 连通性，省去手动排查。
- **弃 OpenRouter 用直连：** OR 是多租户反向代理，它那边的 401 可能是它和你目标 API 之间的认证问题，不反映你本地 key 的有效性。直连少一层依赖。
编辑 config.yaml 后必须重启 gateway：
```bash
pkill -f 'hermes.*gateway' && nohup python -m hermes_cli.main gateway run --replace &
```

### Post-Fix: 验证新 Key + 模型发现

拿到新 API key 后，三步验证一步到位：

### 1. 测试 key 连通性 + 列出可用模型

```bash
curl -s https://api.bltcy.ai/v1/models \
  -H "Authorization: Bearer <NEW_KEY>" \
  | python3 -c "import sys,json; data=json.load(sys.stdin); [print(m['id']) for m in data.get('data',[])]"
```

把 URL 和 key 换成目标 provider 的值。返回的 ID 列表就是你在这个 key 下能用的全部模型。

### 2. 确认目标模型存在

从上面列表里挑一个，用 chat completion 测试（不要只依赖 GET /v1/models，有些 provider 允许列模型但实际推理失败）：

```bash
curl -s --max-time 10 https://api.bltcy.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <NEW_KEY>" \
  -d '{"model":"<模型ID>","messages":[{"role":"user","content":"hi"}],"max_tokens":10}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'choices' in d else 'FAIL: '+str(d))"
```

### 3. 提示用户选择

列出值得用的模型供用户挑（按类别分组：Gemini、Claude、GPT、国产），避免倾倒几百个无关模型 ID。例如：
- gemini-3.1-flash-lite-preview-thinking-medium（之前用的）
- claude-sonnet-4-20250514-thinking
- deepseek-v4-flash
- qwq-plus 等

### 常见陷阱

- **sk- 格式 key 不一定就是 DeepSeek/OpenAI 的** — bltcy 等中转服务也收 sk- 格式 key
- **列模型和推理是两步** — 列模型成功 ≠ chat 能通，必须分别验证
- **provider 的 base_url 要带 /v1** — 很多自定义 provider 的 models 端点是 `<base_url>/models`，不是 `<base_url>/v1/models`

## 根治方案：一次性消灭所有 auxiliary 401

如果你的 401 是从 **Auxiliary title generation/compression/session_search/skills_hub** 来的（且 main chat 正常工作），这是个配置问题而非 key 问题。

**根因：** 所有 auxiliary 段都有 `api_key: ''` + `provider: auto` → 空字符串强制写死空 key → 自定义 provider (bltcy) 的 pool 不服务 auxiliary → 401。

**一次性彻底修复（三选一）：**

**方案 A（推荐——显式 api_key，无 provider）：**
```yaml
auxiliary:
  approval:
    api_key: 'sk-xxx...'
    base_url: https://api.deepseek.com
    model: deepseek-v4-flash
    timeout: 30
  compression:
    api_key: 'sk-xxx...'
    base_url: https://api.deepseek.com
    model: deepseek-v4-flash
    timeout: 120
  title_generation:
    api_key: 'sk-xxx...'
    base_url: https://api.deepseek.com
    model: deepseek-v4-flash
    timeout: 30
  # ... 同理 session_search, skills_hub, vision, web_extract, mcp
```
**原理：** 删掉 `provider` 行后走 "custom" 路径，explicit_api_key 直接生效，不依赖 credential pool 查找。

**方案 B（纯内置 provider，不设 base_url）：**
```yaml
auxiliary:
  compression:
    model: deepseek-v4-flash
    provider: deepseek
    timeout: 120
  title_generation:
    model: deepseek-v4-flash
    provider: deepseek
    timeout: 30
```
**原理：** deepseek 是内置已知 provider，去掉 `api_key: ''` 和 `base_url` 后自动回退 credential pool 查找，不会空 key 请求。

**⚠️ 注意：不要同时设 `provider: deepseek` + `base_url: https://api.deepseek.com` 但不设 `api_key`。**
这会造成 `_resolve_task_provider_model()` 先匹配 `cfg_base_url` 走 "custom" 路径，丢弃 provider 名，且无 explicit_api_key → fallback 到 `"no-key-required"` → 401。详见陷阱 3a。

**验证：** 改完重启 gateway，观察 `~/.hermes/logs/errors.log` 不再出现 `Auxiliary.*401`。

# 预防：切换模型时的 checklist

每次切模型时，同步检查以下四项，预防 401 和 "no response" 类错误：

1. **`fallback_providers`** — 确保不含无 key 的 provider
2. **auxiliary 模型** — session_search / title_generation / skills_hub 的 provider 固定到有效值。注意 `base_url` + `provider` 同时设置时的优先顺序（见陷阱 3）
3. **主模型** — model.{provider,default,base_url} 与 API key 匹配
4. **自定义 provider** — 如果 provider 不在 Hermes 内置已知列表（`bltcy` 等），需手动写入 credential pool（见上方陷阱 1），env var 不会自动加载
5. **清旧会话** — 切模型后旧 session 含有旧模型的对话历史（工具调用格式可能不兼容），建议删除: `rm -f ~/.hermes/sessions/session_*` + 重启 gateway。否则可能出现 "The model returned no response after processing tool results" 错误
6. **校验 auxiliary 的 base_url + provider 组合** — 如果 auxiliary 段同时有 `base_url` 和 `provider`，确保也写了 `api_key`（见陷阱 3）。否则 "custom" 路径会用 "no-key-required" 当 key 发送
7. **同步 auth.json credential pool** — 换 API key 后，auth.json 可能缓存了旧 token。验证：`python3 -c "import json,os; a=json.load(open(os.path.expanduser('~/.hermes/auth.json'))); e=os.environ.get('DEEPSEEK_API_KEY','') or open(os.path.expanduser('~/.hermes/.env')).read().split('DEEPSEEK_API_KEY=')[1].split('\n')[0]; print('match' if e==a['credential_pool']['deepseek'][0]['access_token'] else 'MISMATCH')"`
