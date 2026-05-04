---
name: hermes-system-maintenance
description: "Diagnose Hermes slow performance, clean up disk hogs, and tune config for speed — stale profiles, orphaned venvs, GPU packages on CPU-only, session bloat, and config tuning."
version: 1.0.0
author: Hermes Agent
tags: [hermes, maintenance, performance, cleanup, disk, tuning]
---

# Hermes System Maintenance & Performance Tuning

**Trigger:** User says the system is slow, config is messy, or you notice Hermes has been running for weeks without maintenance. Also trigger when sessions feel sluggish during tool calls or startup.

## 1. Quick Diagnostic Scan

Run these in parallel to assess the system health:

```bash
# Memory + CPU
free -h && uptime && df -h /

# Top processes by memory
ps aux --sort=-%mem | head -15

# Hermes-specific state
hermes sessions stats
ls ~/.hermes/checkpoints/ 2>/dev/null | wc -l
ls ~/.hermes/sessions/ 2>/dev/null | wc -l
```

## 2. Disk Hog Hunt

The biggest Hermes disk eaters are typically:

### 2a. Stale Profiles (`~/.hermes/profiles/`)

```bash
du -sh ~/.hermes/profiles/*/ 2>/dev/null | sort -rh | head -5
```

Check which profile is active:
```bash
grep -i "profile" ~/.hermes/config.yaml
```
If the active profile is `default` and `profiles/local/` exists as a 6GB+ copy, it's a stale snapshot.

**Fix:** `rm -rf ~/.hermes/profiles/<stale_name>/`

### 2b. Orphaned Virtual Environments

```bash
find ~ -maxdepth 3 -name ".venv" -o -name "venv" -o -name "venv-new" 2>/dev/null | xargs -I{} du -sh {} 2>/dev/null | sort -rh | head -10
```

Check each against active projects. Old/unused venvs (e.g., old `dashboard/venv/` alongside active `venv-new/`) can be deleted.

### 2c. GPU Packages in CPU-Only Environments

In WSL or CPU-only systems, check the Hermes venv for GPU packages:

```bash
~/.hermes/hermes-agent/venv/bin/pip list 2>/dev/null | grep -iE 'nvidia|torch|triton|ctranslate'
```

These packages are often auto-installed as dependencies of `transformers` or `vllm` but are completely unused without a GPU.

**Fix:**
```bash
# List them first, then uninstall
GPU_PKGS=$(~/.hermes/hermes-agent/venv/bin/pip list 2>/dev/null | grep -iE 'nvidia|torch|triton|ctranslate' | awk '{print $1}' | tr '\n' ' ')
~/.hermes/hermes-agent/venv/bin/pip uninstall -y $GPU_PKGS
```

### 2d. Orphaned node_modules

```bash
find ~ -maxdepth 3 -name "node_modules" -type d 2>/dev/null | xargs -I{} du -sh {} 2>/dev/null | sort -rh | head -10
```

Check each against active projects. Old/unused `node_modules` (e.g., archived projects) can be deleted. Be careful not to delete active project dependencies.

### 2e. pip Cache

```bash
rm -rf ~/.cache/pip/ 2>/dev/null && echo "cleaned ~200-500MB"
```

### 2f. Hermes Caches

```bash
rm -rf ~/.hermes/cache/* 2>/dev/null
# Check audio cache too
du -sh ~/.hermes/audio_cache/ 2>/dev/null
```

### 2g. Camoufox Browser Cache

`agent-browser` (camoufox) stores hefty browser profiles that aren't cleaned on exit:

```bash
du -sh ~/.cache/camoufox/      # Often 1-2GB
du -sh /tmp/camoufox-*/        # Often 500MB-1GB
```

**Fix:**
```bash
rm -rf ~/.cache/camoufox/ 2>/dev/null
rm -rf /tmp/camoufox-*/ 2>/dev/null
echo "camoufox caches purged"
```

These are safe to delete — persistent camouflage profiles live in the camoufox data dir, not these caches. Only delete `/tmp/camoufox-*` with care if the browser is currently in use (lock files may be in that temp dir).

## 3. Complete Provider Purge

When removing a provider entirely (not just switching, but deleting), you must check **all** these files or the provider will leave traces that can cause confusion:

### Check these locations:

```bash
# 1. providers section in config.yaml
grep -n "provider-name:" ~/.hermes/config.yaml

# 2. model_catalog.providers section
grep -A3 "provider-name:" ~/.hermes/config.yaml

# 3. model section (base_url/provider keys)
grep -A3 "^model:" ~/.hermes/config.yaml

# 4. auth.json credential_pool
grep -A5 "provider-name" ~/.hermes/auth.json

# 5. .env (API keys)
grep "PROVIDER_API_KEY" ~/.hermes/.env

# 6. fallback_providers list
grep "fallback_providers" ~/.hermes/config.yaml

# 7. Any associated skill
ls ~/.hermes/skills/hermes/*provider-name* 2>/dev/null
ls ~/.hermes/skills/*provider-name* 2>/dev/null

# 8. systemd drop-ins that reference it
grep -r "provider-name" ~/.config/systemd/user/hermes-gateway.service.d/ 2>/dev/null
```

### After purging, restore local providers (e.g. ollama):

If your system uses a local model provider (ollama), add it back after cleanup:

```bash
# Add to providers section
cat >> ~/.hermes/config.yaml << 'EOF'
  ollama:
    base_url: http://localhost:11434/v1
    type: openai
EOF

# Add to model_catalog.providers if your config has one
```

Verify ollama is running:
```bash
ollama list
curl -s http://localhost:11434/v1/models | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Ollama OK: {len(d.get(\"data\",[]))} models')"
```

### Verify no traces remain:

```bash
grep -r "provider-name" ~/.hermes/config.yaml ~/.hermes/auth.json ~/.hermes/.env ~/.hermes/skills/ 2>/dev/null
```

After removing large blocks from YAML, leftover blank lines may remain. Check and clean:

```bash
grep -n "^\s*$" ~/.hermes/config.yaml
# If empty lines appear mid-file where blocks were removed,
# patch them out.

## 4. Software Package Cleanup

Remove unused CLI tools installed via npm/pip:

```bash
# Check globally installed npm packages
npm list -g --depth=0 2>/dev/null | head -20

# Remove specific packages (e.g. Claude Code)
npm uninstall -g @anthropic-ai/claude-code 2>/dev/null

# Clean up config dirs
rm -rf ~/.claude ~/.claude-code 2>/dev/null
```

## 5. Session & Checkpoint Cleanup

### 5a. Check current state

```bash
hermes sessions stats
```

This shows total sessions and DB size. 700+ sessions = time to prune.

### 3b. Prune old sessions

```bash
hermes sessions prune --older-than 30 -y
```

If prune returns "0 sessions pruned" despite many sessions, the sessions may be newer than the threshold — try 14 or 7 days, or check session timestamps.

### 3c. Enable auto-prune in config

```yaml
# ~/.hermes/config.yaml
sessions:
  auto_prune: true
  retention_days: 30
  vacuum_after_prune: true

checkpoints:
  auto_prune: true
  max_snapshots: 10
  retention_days: 3
```

## 4. Config Tuning for Speed

### 4a. Reduce Terminal Output

```yaml
display:
  compact: true                  # Less verbose output
  inline_diffs: false            # Skip inline diffs
  interim_assistant_messages: false  # Don't show intermediate thoughts
  tool_progress: minimal         # Only minimal tool status
  tool_preview_length: 1         # Truncate tool output preview
  resume_display: last           # Only last message on session resume
```

### 4b. Reduce Compression Overhead

Compression helps on long conversations but costs CPU. Tune thresholds so it only triggers when needed:

```yaml
compression:
  enabled: true
  protect_last_n: 10             # Only protect last 10 turns from compression
  target_ratio: 0.3              # Compress more aggressively when triggered
  threshold: 0.65                # Only compress when context is 65% full
```

#### Compression model context mismatch (post-update pitfall)

After updating Hermes or switching models/providers, you may see:

```
Compression model <name> context is 256,000 tokens, but the main model <name>'s
compression threshold was 650,000 tokens. Auto-lowered this session's threshold
to 256,000 tokens so compression can run.
```

This happens when the compression model (resolved via `auxiliary.compression.provider: auto`) has a **smaller context window** than the threshold implies. The auto-resolved compression model uses the same provider as the main model, which may have different per-model context limits.

**Trigger:** After `hermes update`, model/provider change, or when you see the warning above.

**Fix — lower threshold to fit the compression model's context:**

```bash
# Calculate: threshold = compression_model_context / model_context_length
# e.g., for 256K compression model and 1M main model:
hermes config set compression.threshold 0.25
```

Or set an explicit compression model with larger context:

```bash
hermes config set auxiliary.compression.model <large-context-model>
hermes config set auxiliary.compression.base_url <provider-url>
hermes config set auxiliary.compression.provider <provider-name>
```

**Verification:** Check the value was set:
```bash
grep "threshold:" ~/.hermes/config.yaml
# Should show: threshold: 0.25
```

### 4c. Gateway Env Injection (for systemd)

When the gateway runs as a systemd user service, env vars from `~/.hermes/.env` are NOT automatically loaded. This means bot tokens (Telegram, Discord, QQ, Feishu) and API keys are invisible to the gateway. The symptom: gateway starts but platforms silently fail to connect.

**Diagnosis:**
```bash
cat /proc/$(pgrep -f 'gateway run' | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep -c 'TELEGRAM_BOT_TOKEN'
# Returns 0 → vars not loaded
```

**Fix — One-shot extraction:**

1. Extract only the needed vars from `.env`:
```bash
python3 -c "
import os, re
env_path = os.path.expanduser('~/.hermes/.env')
needed = [
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USERS', 'TELEGRAM_PROXY',
    'DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_USERS', 'DISCORD_PROXY',
    'QQ_APP_ID', 'QQ_CLIENT_SECRET', 'QQ_ALLOWED_USERS',
    'FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_DOMAIN', 'FEISHU_CONNECTION_MODE',
    'SUDO_PASSWORD', 'DEEPSEEK_API_KEY',
]
with open(env_path) as f: lines = f.readlines()
with open(os.path.expanduser('~/.hermes/.hermes-gateway.env'), 'w') as out:
    for line in lines:
m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line.strip())
        if m and m.group(1) in needed:
            out.write(f'{m.group(1)}={m.group(2)}\n')
print(f'Written {len(needed)} vars')
"
```

2. Add systemd override:
```bash
mkdir -p ~/.config/systemd/user/hermes-gateway.service.d/
cat > ~/.config/systemd/user/hermes-gateway.service.d/50-gateway-env.conf << 'EOF'
[Service]
EnvironmentFile=/home/mzls233/.hermes/.hermes-gateway.env
EOF
```

3. Restart:
```bash
systemctl --user daemon-reload && systemctl --user restart hermes-gateway.service
```

### 4d. Verify API Latency

Test the active model's API latency:

```bash
# Source key from .env, test with real completion
curl -s --max-time 30 "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"$MODEL","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  -w "\n--- Time: %{time_total}s ---"
```

If latency is >5s, consider switchting providers/models or checking proxy health.

## Pitfalls

- **Do NOT use `EnvironmentFile=~/.hermes/.env` directly in systemd.** The `.env` file contains commented-out lines, `***` placeholder values (from credential redaction), and unrelated vars. These will set invalid values.
- **Profile snapshots (`profiles/local/`)** can be 6GB+ and are often stale copies of the entire home directory. Only keep them if actively using `--profile local`.
- **GPU packages in CPU-only venvs** (nvidia/*, torch, triton, ctranslate2) can account for 4-5GB. These are pulled in as `transformers` dependencies but are dead weight without a GPU.
- **Session prune returns 0** even with hundreds of sessions — the sessions may be newer than the threshold. Use a shorter `--older-than` value or check timestamps.
- **After cleaning the Hermes venv** (removing GPU packages), verify Hermes still works: `hermes chat -q "test"` or check the gateway isn't crashing.
