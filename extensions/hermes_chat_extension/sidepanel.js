// Hermes Chat 扩展 v2.0 — Dual-mode AI Chat
const $ = id => document.getElementById(id);
const DS_API = 'https://api.deepseek.com/v1/chat/completions';
const OLLAMA_PROXY = 'http://localhost:11555';
const OLLAMA_DIRECT = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_TAGS = 'http://localhost:11434/api/tags';

let mode = 'hermes', busy = false, history = [];

document.addEventListener('DOMContentLoaded', () => {
  // ── Mode toggle ──
  document.querySelectorAll('#modeToggle button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#modeToggle button').forEach(x => x.classList.remove('act'));
    b.classList.add('act');
    mode = b.dataset.mode;
    $('hermesConfig').style.display = mode === 'hermes' ? 'flex' : 'none';
    $('ollamaConfig').style.display = mode === 'ollama' ? 'flex' : 'none';
    updateWelcome();
    loadKey();
    if (mode === 'ollama') fetchModels();
  }));

  // ── Send ──
  $('sendBtn').addEventListener('click', send);
  $('input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Enter' && e.shiftKey) { /* allow newline */ }
  });
  $('input').addEventListener('input', () => {
    $('input').style.height = 'auto';
    $('input').style.height = Math.min($('input').scrollHeight, 90) + 'px';
  });

  // ── Key save button ──
  $('saveKeyBtn').addEventListener('click', saveKey);
  $('apiKey').addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });

  // ── Model select ──
  $('modelSelect').addEventListener('change', () => {
    localStorage.setItem('ollama_model', $('modelSelect').value);
    setStatus(`模型: ${$('modelSelect').value}`);
  });

  // ── Init ──
  loadKey();
  if (mode === 'ollama') fetchModels();
  setStatus('就绪');
});

// ─── Welcome ──────────────────────────────────
function updateWelcome() {
  if (mode === 'hermes') {
    $('wTitle').textContent = '🤖 Hermes (DeepSeek)';
    $('wText').textContent = '填写 API Key 后开始对话';
    $('wModel').textContent = 'deepseek-chat';
  } else {
    const m = localStorage.getItem('ollama_model') || 'qwen2.5:7b';
    $('wTitle').textContent = '🦙 Ollama 本地';
    $('wText').textContent = `${m} · 本地运行`;
    $('wModel').textContent = m;
  }
}

// ─── API Key ──────────────────────────────────
function saveKey() {
  const key = $('apiKey').value.trim();
  if (!key) { setStatus('⚠️ API Key 不能为空'); return; }
  localStorage.setItem('ds_key', key);
  setStatus('✅ API Key 已保存');
}
function loadKey() {
  const saved = localStorage.getItem('ds_key');
  $('apiKey').value = saved || '';
}

// ─── Ollama Models ────────────────────────────
async function fetchModels() {
  const sel = $('modelSelect');
  const status = $('modelStatus');
  status.textContent = '获取中...';
  try {
    const resp = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    sel.innerHTML = (data.models || [])
      .map(m => {
        const saved = localStorage.getItem('ollama_model');
        const selected = (saved === m.name) ? 'selected' : '';
        return `<option value="${m.name}" ${selected}>${m.name}</option>`;
      })
      .join('');
    if (!localStorage.getItem('ollama_model') && data.models?.length > 0) {
      localStorage.setItem('ollama_model', data.models[0].name);
    }
    const count = data.models?.length || 0;
    status.textContent = `${count} 个模型`;
    status.style.color = '#10b981';
    updateWelcome();
  } catch(e) {
    status.textContent = '❌ 无法连接';
    status.style.color = '#fb7185';
    setStatus('⚠️ Ollama 未运行或代理未启动');
  }
}

// ─── Send Message ─────────────────────────────
async function send() {
  const input = $('input');
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true; $('sendBtn').disabled = true;
  input.value = ''; input.style.height = 'auto';

  const msgs = $('msgs');
  const welcome = msgs.querySelector('.welcome');
  if (welcome) welcome.remove();

  // User bubble
  const uDiv = document.createElement('div');
  uDiv.className = `msg user-${mode === 'hermes' ? 'h' : 'o'}`;
  uDiv.textContent = text; msgs.appendChild(uDiv);
  msgs.scrollTop = msgs.scrollHeight;
  history.push({ role: 'user', content: text });

  // Thinking indicator
  const tDiv = document.createElement('div');
  tDiv.className = 'thinking'; tDiv.textContent = '思考中...';
  msgs.appendChild(tDiv); msgs.scrollTop = msgs.scrollHeight;
  setStatus('⏳ 思考中...');

  try {
    let fullReply = '';
    if (mode === 'hermes') {
      fullReply = await callDeepSeek(text);
    } else {
      fullReply = await callOllama(text);
    }
    tDiv.remove();
    const aDiv = document.createElement('div');
    aDiv.className = 'msg assistant'; msgs.appendChild(aDiv);
    aDiv.innerHTML = fullReply.replace(/\n/g, '<br>');
    msgs.scrollTop = msgs.scrollHeight;
    history.push({ role: 'assistant', content: fullReply });
    setStatus(`✅ 完成 (${fullReply.length}字)`);
  } catch(e) {
    tDiv.remove();
    const eDiv = document.createElement('div');
    eDiv.className = 'msg assistant error';
    eDiv.textContent = `❌ ${e.message}`;
    msgs.appendChild(eDiv);
    msgs.scrollTop = msgs.scrollHeight;
    setStatus(`❌ ${e.message}`);
    history.push({ role: 'assistant', content: `错误: ${e.message}` });
  }
  busy = false; $('sendBtn').disabled = false; $('input').focus();
}

// ─── DeepSeek API ─────────────────────────────
async function callDeepSeek(text) {
  const key = localStorage.getItem('ds_key') || '';
  if (!key) throw new Error('请先点击「保存」按钮保存 DeepSeek API Key');
  const resp = await fetch(DS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for cross-border e-commerce. 回答简洁专业。' },
        ...history.slice(-20),
        { role: 'user', content: text }
      ],
      stream: true,
      max_tokens: 4096,
    }),
  });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j.error?.message || msg; } catch(_) {}
    throw new Error(msg);
  }
  return streamRead(resp.body.getReader());
}

// ─── Ollama ───────────────────────────────────
async function callOllama(text) {
  const model = localStorage.getItem('ollama_model') || 'qwen2.5:7b';

  // Try proxy first (bypasses CORS), fallback to direct
  let resp;
  try {
    resp = await fetch(OLLAMA_PROXY + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          ...history.slice(-20),
          { role: 'user', content: text }
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch(e) {
    // Proxy down, try direct
    resp = await fetch(OLLAMA_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          ...history.slice(-20),
          { role: 'user', content: text }
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
  }

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    if (resp.status === 403) msg = 'Ollama 拒绝了请求，请确认：1) Windows 环境变量 OLLAMA_ORIGINS=* 已设置 2) Ollama 已重启';
    else try { const j = await resp.json(); msg = j.error || msg; } catch(_) {}
    throw new Error(msg);
  }
  return streamRead(resp.body.getReader());
}

// ─── SSE Stream Reader ────────────────────────
async function streamRead(reader) {
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const d = line.slice(6).trim();
      if (d === '[DONE]') return full;
      try {
        const j = JSON.parse(d);
        const delta = j.choices?.[0]?.delta;
        if (delta?.content) full += delta.content;
      } catch(e) {}
    }
  }
  return full;
}

// ─── Utility ──────────────────────────────────
function clearChat() {
  history = [];
  const m = mode === 'hermes' ? '🤖 Hermes' : '🦙 Ollama';
  $('msgs').innerHTML = `<div class="welcome" id="welcome"><h3 id="wTitle">${m}</h3><p>新对话</p><div class="tag">已清空</div></div>`;
  setStatus('🗑 已清空');
}

function copyChat() {
  if (!history.length) { setStatus('⚠️ 没有可复制的内容'); return; }
  const text = history.map(m => `${m.role === 'user' ? '🧑 You' : '🤖 AI'}: ${m.content}`).join('\n\n');
  navigator.clipboard.writeText(text).then(() => setStatus('✅ 已复制到剪贴板'));
}

function exportChat() {
  if (!history.length) { setStatus('⚠️ 没有可导出的对话'); return; }
  const lines = [];
  lines.push('=== Hermes Chat 导出 ===');
  lines.push(`时间: ${new Date().toLocaleString()}`);
  lines.push(`模式: ${mode === 'hermes' ? 'DeepSeek API (deepseek-chat)' : `Ollama (${localStorage.getItem('ollama_model') || 'qwen2.5:7b'})`}`);
  lines.push(`条数: ${history.length}`, '');
  for (const m of history) {
    lines.push(`--- ${m.role === 'user' ? '🧑 You' : '🤖 AI'} ---`);
    lines.push(m.content, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hermes_chat_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('✅ 已导出');
}

function setStatus(msg) {
  const el = $('statusBar');
  let dot = 'g';
  if (msg.includes('❌') || msg.includes('错误') || msg.includes('⚠️')) dot = 'r';
  else if (msg.includes('⏳') || msg.includes('思考')) dot = 'y';
  el.innerHTML = `<span class="dot ${dot}"></span>${msg}`;
}
