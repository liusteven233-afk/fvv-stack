// ═══ 大帅比专用 v5 — 每100g运费 · 阈值双价 · 4模式 ═══

// ─── 国家数据 ──────────────────────────────────────
const COUNTRIES = {
  MX: { name: 'México', flag: '🇲🇽', currency: 'MXN', symbol: 'MX$' },
  BR: { name: 'Brasil', flag: '🇧🇷', currency: 'BRL', symbol: 'R$' },
  CO: { name: 'Colombia', flag: '🇨🇴', currency: 'COP', symbol: 'COL$' },
  CL: { name: 'Chile', flag: '🇨🇱', currency: 'CLP', symbol: 'CLP$' },
  AR: { name: 'Argentina', flag: '🇦🇷', currency: 'ARS', symbol: 'ARS$' },
  UY: { name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', symbol: 'UYU$' },
};
const CKS = ['MX', 'BR', 'CO', 'CL', 'AR', 'UY'];

// ─── 运费表: 每100g精度 + 阈值(高/低价) ────────────
// [weight_limit_kg, high_threshold_fee(USD), low_threshold_fee(USD)]
// 售价 ≥ 阈值 → 用高价运费; 售价 < 阈值 → 用低价运费
const SHIP_RAW = {
  MX: [[0.1,4.0,1.7],[0.2,5.4,2.1],[0.3,6.8,2.9],[0.4,8.5,3.9],[0.5,9.9,5.0],[0.6,11.8,6.9],[0.7,13.4,8.9],[0.8,14.8,10.7],[0.9,16.3,13.8],[1.0,17.3,13.8],[1.5,21.8,21.8],[2.0,30.2,30.2],[2.5,51.8,51.8],[3.0,51.8,51.8],[3.5,60.6,60.6],[4.0,60.6,60.6]],
  BR: [[0.1,5.1,1.7],[0.2,6.2,2.4],[0.3,9.3,2.9],[0.4,9.6,4.1],[0.5,12.2,4.7],[0.6,12.7,6.8],[0.7,15.0,9.0],[0.8,15.2,10.0],[0.9,18.0,12.0],[1.0,18.5,16.0],[1.5,22.5,22.5],[2.0,29.6,29.6],[2.5,44.7,44.7]],
  CO: [[0.1,4.1,1.8],[0.2,5.5,2.4],[0.3,6.8,3.5],[0.4,8.8,5.0],[0.5,9.4,6.5],[0.6,11.9,8.2],[0.7,12.7,9.5],[0.8,13.3,10.5],[0.9,14.1,12.5],[1.0,14.8,14.8],[1.5,20.5,20.5],[2.0,28.3,28.3],[2.5,47.5,45.0],[3.0,47.5,45.0],[3.5,62.1,60.0],[4.0,62.1,60.0],[4.5,73.2,73.2],[5.0,73.2,73.2],[5.5,86.3,86.3],[6.0,86.3,86.3],[6.5,103.2,103.2],[7.0,103.2,103.2],[7.5,120.2,120.2],[8.0,120.2,120.2],[8.5,137.4,137.4],[9.0,137.4,137.4],[9.5,154.5,154.5]],
  CL: [[0.1,4.0,1.2],[0.2,5.0,1.2],[0.3,6.4,1.2],[0.4,7.9,1.8],[0.5,9.1,1.8],[0.6,10.0,3.6],[0.7,11.2,3.6],[0.8,11.8,3.6],[0.9,13.3,6.0],[1.0,14.0,6.0],[1.5,18.5,12.0],[2.0,25.1,24.0],[2.5,46.1,36.0],[3.0,46.1,36.0],[3.5,55.2,48.0],[4.0,55.2,48.0],[4.5,69.0,69.0],[5.0,69.0,69.0],[5.5,82.7,82.7],[6.0,82.7,82.7],[6.5,96.4,96.4],[7.0,96.4,96.4],[7.5,110.1,110.1],[8.0,110.1,110.1],[8.5,123.8,123.8],[9.0,123.8,123.8],[9.5,137.5,137.5]],
  AR: [[0.1,12.4,5.0],[0.2,13.6,5.0],[0.3,15.0,5.0],[0.4,16.3,5.0],[0.5,17.7,8.0],[0.6,19.0,8.0],[0.7,20.3,9.0],[0.8,21.7,9.0],[0.9,23.0,12.0],[1.0,24.3,12.0],[1.5,28.0,12.0],[2.0,35.1,25.0],[2.5,41.6,35.0],[3.0,48.2,45.0],[3.5,55.6,55.6],[4.0,61.9,61.9],[4.5,68.0,68.0],[5.0,74.5,74.5],[5.5,82.0,82.0],[6.0,88.1,88.1],[6.5,95.1,95.1],[7.0,101.8,101.8],[7.5,109.0,109.0],[8.0,114.2,114.2],[8.5,121.0,121.0],[9.0,128.4,128.4]],
  UY: [[0.1,8.31,8.31],[0.2,10.2,10.2],[0.3,11.91,11.91],[0.4,13.78,13.78],[0.5,15.68,15.68],[0.6,18.71,18.71],[0.7,20.62,20.62],[0.8,22.51,22.51],[0.9,24.40,24.40],[1.0,26.28,26.28],[1.5,32.09,32.09],[2.0,42.68,42.68],[2.5,53.00,53.00],[3.0,63.29,63.29],[3.5,74.59,74.59],[4.0,84.49,84.49],[4.5,93.67,93.67],[5.0,104.97,104.97],[5.5,115.04,115.04],[6.0,125.80,125.80],[6.5,137.88,137.88],[7.0,145.59,145.59]],
};

// 阈值: 售价(当地币) < 阈值 → 低运费; 否则高运费
const SHIP_THRESHOLD = { MX: 299, BR: 79, CL: 19990, CO: 60000, AR: 33000, UY: 1200 };
const SHIP_LABEL = { MX: 'MX$299', BR: 'R$79', CL: 'CLP$19990', CO: 'COL$60000', AR: 'ARS$33000', UY: 'UYU$1200' };

const ML_CUT = 0.80;    // ML佣金20%
const BUFFER = 0.50;    // 缓冲USD
const FALLBACK_RATES = { MXN: 20.0, BRL: 5.5, COP: 4200, CLP: 950, ARS: 1450, UYU: 42, CNY: 7.3 };

// ═══ 密钥系统 — 7天时效 + 滚动更新 ═══
// 每期密钥不同，过期后需联系管理员获取新密钥
const AUTH_GEN = 1;  // 期号，每期换新
const AUTH_KEY = 'DSB-V5-A7X9-K3M2';
const AUTH_STORAGE_KEY = 'dsb_auth_data';

function checkAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return { ok: false, msg: '请解锁' };
    const data = JSON.parse(stored);
    // 密钥期号不对 → 已换新密钥
    if (data.gen !== AUTH_GEN) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return { ok: false, msg: '密钥已过期，请联系管理员获取新密钥' };
    }
    const expiry = parseInt(data.expiry);
    if (isNaN(expiry)) return { ok: false, msg: '密钥异常' };
    const now = Math.floor(Date.now() / 1000);
    if (now >= expiry) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return { ok: false, msg: '密钥已过期，请获取新密钥' };
    }
    const remaining = Math.ceil((expiry - now) / 86400);
    const expireDate = new Date(expiry * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' });
    return { ok: true, remaining, expireDate, msg: `🔑 第${AUTH_GEN}期 · ${remaining}天` };
  } catch (e) {
    return { ok: false, msg: '验证异常' };
  }
}

function renderLockScreen(msg) {
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0f1117;padding:30px;text-align:center;gap:16px;font-family:'Inter','SF Pro','PingFang SC','system-ui',sans-serif">
      <div style="font-size:56px">🔐</div>
      <h2 style="color:#FFE600;font-size:22px;font-weight:800;letter-spacing:-0.5px">大帅比专用 v5</h2>
      <div style="color:#6b7084;font-size:14px">请输入第${AUTH_GEN}期密钥</div>
      <input id="dsbKeyInput" type="password" placeholder="输入密钥" style="width:100%;max-width:260px;padding:12px 14px;border-radius:8px;border:1.5px solid rgba(255,230,0,0.2);background:rgba(255,255,255,0.04);color:#f0f2f8;font-size:15px;outline:none;text-align:center" autofocus />
      <button id="dsbUnlockBtn" style="padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#FFE600,#e6cf00);color:#0f1117;font-weight:700;font-size:14px;cursor:pointer">🔓 解锁</button>
      <div id="dsbKeyErr" style="color:#fb7185;font-size:13px;min-height:20px">${msg || ''}</div>
      <div style="color:#3a3d4e;font-size:11px;margin-top:4px">7天时效 · 每期换新 · 联系管理员</div>
    </div>`;

  const inp = document.getElementById('dsbKeyInput');
  const btn = document.getElementById('dsbUnlockBtn');
  const err = document.getElementById('dsbKeyErr');

  function handleKey() {
    const key = inp.value.trim();
    if (key !== AUTH_KEY) {
      err.textContent = '❌ 密钥错误，请重试';
      inp.value = '';
      inp.focus();
      return;
    }
    // 解锁成功，存期号+7天过期
    const authData = JSON.stringify({
      gen: AUTH_GEN,
      expiry: Math.floor(Date.now() / 1000) + 7 * 86400,
    });
    try { localStorage.setItem(AUTH_STORAGE_KEY, authData); } catch(e) {}
    window.location.reload();
  }

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleKey(); });
  btn.addEventListener('click', handleKey);
  setTimeout(() => inp.focus(), 100);
}

// ─── 状态 ──────────────────────────────────────────
let activeSite = 'MX';
let fx = null;
let activePcts = new Set([10, 20]);

const $ = id => document.getElementById(id);

// ─── 运费核心函数 ──────────────────────────────────
function getShipRates(ck, weightKg) {
  const rates = SHIP_RAW[ck] || [];
  for (const [limit, above, below] of rates) {
    if (weightKg <= limit) return { above, below, limit, ck };
  }
  const last = rates[rates.length - 1];
  return { above: last[1], below: last[2], limit: last[0], ck };
}

function getShipFee(ck, weightKg, localPrice) {
  const { above, below } = getShipRates(ck, weightKg);
  return localPrice < SHIP_THRESHOLD[ck] ? below : above;
}

function getShipFeeResolve(ck, weightKg, localPrice) {
  const r = getShipRates(ck, weightKg);
  const useBelow = localPrice < SHIP_THRESHOLD[ck];
  return { fee: useBelow ? r.below : r.above, useBelow, above: r.above, below: r.below, limit: r.limit };
}

function weightLabel(ck, weightKg) {
  const { limit } = getShipRates(ck, weightKg);
  return `≤${limit}kg`;
}

// ─── 站点按钮 ─────────────────────────────────────
function renderSiteBtns() {
  const el = $('siteBtns');
  if (!el) return;
  el.innerHTML = CKS.map(k => {
    const c = COUNTRIES[k];
    return `<button class="${k === activeSite ? 's-act' : 's-ina'}" data-site="${k}">${c.flag} ${c.name}<br><small style="font-size:10px;opacity:0.6">阈值${SHIP_LABEL[k]}</small></button>`;
  }).join('');
  el.querySelectorAll('.s-ina').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSite = btn.dataset.site;
      renderSiteBtns();
      clearAllResults();
    });
  });
}

// ─── 模式切换 ────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('#modeTabs .tab');
  if (!tabs.length) return;
  const sections = {
    calc: 'calcSection',
    reverse: 'revSection',
    compare: 'cmpSection',
    cross: 'crossSection',
    multi: 'multiSection',
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('act'));
      tab.classList.add('act');
      Object.keys(sections).forEach(k => {
        const sec = $(sections[k]);
        if (sec) sec.style.display = k === tab.dataset.mode ? 'block' : 'none';
      });
    });
  });
}

// ─── 汇率 ─────────────────────────────────────────
async function fetchFX() {
  const fxDisp = $('fxDisp');
  const fxBadge = $('fxBadge');
  const refreshBtn = $('refreshFxBtn');
  if (!fxDisp || !fxBadge || !refreshBtn) return;

  fxDisp.textContent = '获取中...';
  fxBadge.textContent = '加载中';
  fxBadge.className = 'fx-badge';
  refreshBtn.disabled = true;
  let rates = null;
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.dev/latest?from=USD',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await r.json();
      const rt = data.rates || {};
      const needed = ['MXN', 'BRL', 'COP', 'CLP', 'ARS', 'UYU', 'CNY'];
      const hits = needed.filter(c => rt[c] && rt[c] > 0);
      if (hits.length >= 3) {
        rates = {};
        needed.forEach(c => { if (rt[c]) rates[c] = rt[c]; });
        rates.fetched = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        rates.usd_cny = 1.0 / (rt.CNY || 7.25);
        fxBadge.textContent = '在线';
        fxBadge.className = 'fx-badge on';
        break;
      }
    } catch (e) {}
  }
  if (!rates) {
    rates = { ...FALLBACK_RATES, fetched: '离线', usd_cny: 1.0 / 7.25 };
    fxBadge.textContent = '备用';
    fxBadge.className = 'fx-badge off';
  }
  fx = rates;
  try { await chrome.storage.local.set({ fx_standalone: rates }); } catch (e) {}
  renderFX(rates);
  refreshBtn.disabled = false;
}

function renderFX(r) {
  if (!r) { const el = $('fxDisp'); if (el) el.textContent = '暂无'; return; }
  const el = $('fxDisp');
  if (!el) return;
  el.innerHTML = Object.entries(r)
    .filter(([k]) => k !== 'fetched' && k !== 'usd_cny')
    .map(([k, v]) => `<span style="margin-right:5px"><b>${k}</b> ${typeof v === 'number' ? v.toFixed(4) : v}</span>`)
    .join('');
  if (r.fetched) el.innerHTML += `<br><span style="color:#4a4e5e;font-size:11px">🕐 ${r.fetched}</span>`;
}

// ─── 格式函数 ─────────────────────────────────────
function formatUSD(v) { return '$' + (typeof v === 'number' ? v.toFixed(2) : v); }
function formatCNY(v) { return '¥' + (typeof v === 'number' ? v.toFixed(2) : v); }
function fmtNum(n) { return n.toLocaleString('zh-CN'); }

// ─── 模式1: 核价 (用户输入当地售价) ─────────────
function calcProfit(ck, price, weight, sourcing, domShip) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪' };
  const fusd = price / fx[curr];
  const afterComm = fusd * ML_CUT;

  // 根据售价判断用高/低阈值运费
  const s = getShipFeeResolve(ck, weight, price);
  const net = afterComm - s.fee;
  const totalCny = (sourcing || 0) + (domShip || 0);
  const srcCost = totalCny * fx.usd_cny + BUFFER;
  const profit = net - srcCost;
  const margin = net > 0 ? (profit / net) * 100 : 0;

  return {
    site: COUNTRIES[ck].flag + ' ' + COUNTRIES[ck].name,
    currency: curr,
    fusd, mlFee: fusd - afterComm, afterComm,
    shipping: s.fee, shipAbove: s.above, shipBelow: s.below,
    useBelow: s.useBelow, thrLabel: SHIP_LABEL[ck],
    net, srcCost, profit, margin,
    ok: profit > 0, tier: weightLabel(ck, weight),
  };
}

function showCalcResult(r) {
  if (r.error) {
    $('calcResult').innerHTML = `<div class="res-card fade"><span style="color:#fb7185;font-size:15px">❌ ${r.error}</span></div>`;
    return;
  }
  const thrBadge = r.useBelow
    ? `<span class="thr-badge low">⬇ 低阈值运费</span>`
    : `<span class="thr-badge high">⬆ 高阈值运费</span>`;
  const cls = r.ok ? '#34d399' : '#fb7185';
  $('calcResult').innerHTML = `
    <div class="res-card fade">
      <div class="r-hdr">${r.site} · 运费${r.tier} ${thrBadge}</div>
      <div class="r-val" style="color:${cls}">${r.ok ? '✅' : '❌'} 利润 ${formatUSD(r.profit)} · ${r.margin.toFixed(1)}%</div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l">售价 → USD</span><span class="r-r y">${formatUSD(r.fusd)}</span></div>
      <div class="r-line"><span class="r-l">ML佣金 (20%)</span><span class="r-r r">-${formatUSD(r.mlFee)}</span></div>
      <div class="r-line"><span class="r-l">运费 (${r.useBelow ? '低阈值' : '高阈值'} ${r.shipping >= 10 ? '' : '⬇'})</span><span class="r-r r">-${formatUSD(r.shipping)}</span></div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l">ML到账</span><span class="r-r g">${formatUSD(r.net)}</span></div>
      <div class="r-line"><span class="r-l">货源+缓冲</span><span class="r-r r">-${formatUSD(r.srcCost)}</span></div>
      <div class="r-line"><span class="r-l" style="font-weight:700;font-size:15px">净利润</span><span class="r-r" style="color:${cls};font-weight:800;font-size:16px">${formatUSD(r.profit)}</span></div>
      <div class="r-div"></div>
      <div class="r-line" style="font-size:11px;color:#4a4e5e"><span class="r-l">阈值: ${r.thrLabel} · 运费低/高: ${formatUSD(r.shipBelow)}/${formatUSD(r.shipAbove)}</span></div>
    </div>`;
}

// ─── 模式2: 反向 ─────────────────────────────────
function calcReverse(ck, weight, sourcing, domShip) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪' };
  const totalCny = (sourcing || 0) + (domShip || 0);
  const costUsd = totalCny * fx.usd_cny + BUFFER;
  const pts = [10, 15, 20, 25, 30];
  const results = [];

  for (const pct of pts) {
    const needProfit = costUsd * (pct / 100);
    const needNet = costUsd + needProfit;

    // 迭代判断阈值: 先假设高阈值，算售价，检查是否需切换
    let r = getShipRates(ck, weight);
    let ship = r.above;
    let needAml = needNet + ship;
    let needFusd = needAml / ML_CUT;
    let needPrice = needFusd * fx[curr];

    // 检查阈值: 如果算出的售价 < 阈值 → 用低运费重算
    if (needPrice < SHIP_THRESHOLD[ck]) {
      ship = r.below;
      needAml = needNet + ship;
      needFusd = needAml / ML_CUT;
      needPrice = needFusd * fx[curr];
    }

    results.push({ pct, needPrice: Math.round(needPrice), needFusd, ship, useBelow: needPrice < SHIP_THRESHOLD[ck] });
  }
  return { results, thrLabel: SHIP_LABEL[ck] };
}

function showRevResult(data) {
  if (data.error) {
    $('revResult').innerHTML = `<div class="res-card fade"><span style="color:#fb7185;font-size:15px">❌ ${data.error}</span></div>`;
    return;
  }
  const c = COUNTRIES[activeSite];
  let html = `<div class="res-card fade">
    <div class="r-hdr">${c.flag} ${c.name} · 阈值 ${data.thrLabel}</div>`;
  for (const r of data.results) {
    if (activePcts.has(r.pct)) {
      const badge = r.useBelow ? `<span class="thr-badge low">⬇低阈值</span>` : `<span class="thr-badge high">⬆高阈值</span>`;
      const toAccount = r.needFusd * ML_CUT - r.ship;
      html += `<div class="r-line"><span class="r-l">🎯 ${r.pct}%利润</span><span class="r-r y" style="font-size:16px"><b>${c.symbol}${fmtNum(r.needPrice)}</b> ${badge}</span></div>
      <div class="r-line" style="font-size:11px;color:#4a4e5e"><span class="r-l">USD $${r.needFusd.toFixed(2)} · 运费 ${formatUSD(r.ship)} · 到账 <b style="color:#34d399">${formatUSD(toAccount)}</b></span></div>`;
    }
  }
  html += `</div>`;
  $('revResult').innerHTML = html;
}

// ─── 模式2B: 按净利润反向 ──────────────────────
function calcReverseByProfit(ck, weight, sourcing, targetProfitCny) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪' };
  const totalCny = (sourcing || 0);
  const costUsd = totalCny * fx.usd_cny + BUFFER;
  const profitUsd = targetProfitCny * fx.usd_cny;

  // 迭代阈值
  let r = getShipRates(ck, weight);
  let ship = r.above;
  let needNet = costUsd + profitUsd + ship;
  let needFusd = needNet / ML_CUT;
  let needPrice = needFusd * fx[curr];

  let useBelow = needPrice < SHIP_THRESHOLD[ck];
  if (useBelow) {
    ship = r.below;
    needNet = costUsd + profitUsd + ship;
    needFusd = needNet / ML_CUT;
    needPrice = needFusd * fx[curr];
  }

  return {
    needPrice: Math.round(needPrice), needFusd, ship, useBelow,
    targetProfitCny, profitUsd, costUsd,
    thrLabel: SHIP_LABEL[ck],
    symbol: COUNTRIES[ck].symbol,
    flag: COUNTRIES[ck].flag,
  };
}

function showRevProfitResult(r) {
  if (r.error) {
    $('revResult').innerHTML = `<div class="res-card fade"><span style="color:#fb7185;font-size:15px">❌ ${r.error}</span></div>`;
    return;
  }
  const badge = r.useBelow ? `<span class="thr-badge low">⬇低阈值</span>` : `<span class="thr-badge high">⬆高阈值</span>`;
  $('revResult').innerHTML = `
    <div class="res-card fade">
      <div class="r-hdr">${r.flag} ${COUNTRIES[activeSite].name} · 阈值 ${r.thrLabel} ${badge}</div>
      <div class="r-val" style="color:#FFE600">🎯 净利润 ¥${r.targetProfitCny} → <b>${r.symbol}${fmtNum(r.needPrice)}</b></div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l">需要ML售价 (USD)</span><span class="r-r y">${formatUSD(r.needFusd)}</span></div>
      <div class="r-line"><span class="r-l">ML到账 (80%)</span><span class="r-r g">${formatUSD(r.needFusd * ML_CUT)}</span></div>
      <div class="r-line"><span class="r-l">减运费 (${r.useBelow ? '低' : '高'}阈值)</span><span class="r-r r">-${formatUSD(r.ship)}</span></div>
      <div class="r-line"><span class="r-l">减货源+缓冲</span><span class="r-r r">-${formatUSD(r.costUsd)}</span></div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l" style="font-weight:700">净利润</span><span class="r-r g" style="font-weight:800">¥${r.targetProfitCny} / ${formatUSD(r.profitUsd)}</span></div>
    </div>`;
}

// ─── 模式3: 全站对比 ─────────────────────────────
function showCmpResult(results) {
  let html = '<div class="res-card fade">';
  const sorted = CKS.map(k => ({ ck: k, r: results[k] })).filter(x => x.r && !x.r.error);
  sorted.sort((a, b) => b.r.profit - a.r.profit);
  for (let i = 0; i < sorted.length; i++) {
    const { ck, r } = sorted[i];
    const cls = r.ok ? '#34d399' : '#fb7185';
    const rank = i === 0 ? '🏆 ' : `${i + 1}.`;
    const badge = r.useBelow ? `<span class="thr-badge low">⬇</span>` : `<span class="thr-badge high">⬆</span>`;
    html += `<div class="r-line">
      <span class="r-l">${rank} ${COUNTRIES[ck].flag} ${COUNTRIES[ck].name}</span>
      <span class="r-r" style="color:${cls}">${r.ok ? '✅' : '❌'} ${formatUSD(r.profit)} · ${r.margin.toFixed(1)}% · 运费${formatUSD(r.shipping)} ${badge}</span>
    </div>`;
    if (i === 0) html += `<div class="r-div"></div>`;
  }
  html += '</div>';
  $('cmpResult').innerHTML = html;
}

// ─── 模式4: 跨境净利润模式 ──────────────────────
function calcCrossProfit(ck, price, weight, sourcing, domShip) {
  // 已知ML售价 → 算净利润
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪' };
  const fusd = price / fx[curr];
  const afterComm = fusd * ML_CUT;
  const s = getShipFeeResolve(ck, weight, price);
  const net = afterComm - s.fee;
  const totalCny = (sourcing || 0) + (domShip || 0);
  const costUsd = totalCny * fx.usd_cny;
  const profitUsd = net - costUsd - BUFFER;
  const profitCny = profitUsd / fx.usd_cny;
  const margin = net > 0 ? (profitUsd / net) * 100 : 0;
  return {
    fusd, afterComm, ship: s.fee, shipAbove: s.above, shipBelow: s.below,
    useBelow: s.useBelow, thrLabel: SHIP_LABEL[ck],
    net, costUsd, buffer: BUFFER,
    profitUsd, profitCny, margin,
    ok: profitUsd > 0, tier: weightLabel(ck, weight),
  };
}

function calcCrossReverse(ck, weight, sourcing, domShip, targetProfitCny) {
  // 已知目标净利润 → 反推ML售价 (迭代阈值)
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪' };
  const totalCny = (sourcing || 0) + (domShip || 0);
  const costUsd = totalCny * fx.usd_cny;
  const targetProfitUsd = targetProfitCny * fx.usd_cny;

  // 先假设用高阈值
  let r = getShipRates(ck, weight);
  let ship = r.above;
  let needNet = costUsd + ship + BUFFER + targetProfitUsd;
  let needFusd = needNet / ML_CUT;
  let needPrice = needFusd * fx[curr];

  // 检查阈值: 如果算出售价 < 阈值 → 用低运费重算
  let useBelow = needPrice < SHIP_THRESHOLD[ck];
  if (useBelow) {
    ship = r.below;
    needNet = costUsd + ship + BUFFER + targetProfitUsd;
    needFusd = needNet / ML_CUT;
    needPrice = needFusd * fx[curr];
  }

  return {
    ship, costUsd, needNet, needFusd, needPrice: Math.round(needPrice),
    targetProfitCny, targetProfitUsd, useBelow, thrLabel: SHIP_LABEL[ck], above: r.above, below: r.below,
  };
}

function showCrossProfit(r) {
  if (r.error) {
    $('crossResult').innerHTML = `<div class="res-card fade"><span style="color:#fb7185;font-size:15px">❌ ${r.error}</span></div>`;
    return;
  }
  const thrBadge = r.useBelow ? `<span class="thr-badge low">⬇ 低阈值</span>` : `<span class="thr-badge high">⬆ 高阈值</span>`;
  const cls = r.ok ? '#34d399' : '#fb7185';
  $('crossResult').innerHTML = `
    <div class="res-card fade">
      <div class="r-hdr">${COUNTRIES[activeSite].flag} ${COUNTRIES[activeSite].name} · ${r.tier} ${thrBadge}</div>
      <div class="r-val" style="color:${cls}">${r.ok ? '✅' : '❌'} 净利润 ${formatCNY(r.profitCny)} · ${r.margin.toFixed(1)}%</div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l">ML售价 → USD</span><span class="r-r y">${formatUSD(r.fusd)}</span></div>
      <div class="r-line"><span class="r-l">ML到账 (80%)</span><span class="r-r g">${formatUSD(r.afterComm)}</span></div>
      <div class="r-line"><span class="r-l">减运费 (${r.useBelow ? '低' : '高'}阈值)</span><span class="r-r r">-${formatUSD(r.ship)}</span></div>
      <div class="r-line"><span class="r-l">减货源</span><span class="r-r r">-${formatUSD(r.costUsd)}</span></div>
      <div class="r-line"><span class="r-l">减缓冲</span><span class="r-r r">-${formatUSD(r.buffer)}</span></div>
      <div class="r-div"></div>
      <div class="r-line"><span class="r-l" style="font-weight:700">净利润</span><span class="r-r" style="color:${cls};font-weight:800;font-size:16px">${formatCNY(r.profitCny)} · ${formatUSD(r.profitUsd)}</span></div>
    </div>`;
}

function showCrossReverse(rs) {
  const c = COUNTRIES[activeSite];
  if (Array.isArray(rs)) {
    let html = `<div class="res-card fade"><div class="r-hdr">🎯 目标净利润 ${formatCNY(rs[0]?.targetProfitCny || 0)}</div>`;
    const sorted = [...rs].filter(r => !r.error).sort((a, b) => a.needPrice - b.needPrice);
    for (const r of sorted) {
      const ck = r.siteKey || activeSite;
      const ci = COUNTRIES[ck];
      const badge = r.useBelow ? `<span class="thr-badge low">⬇</span>` : `<span class="thr-badge high">⬆</span>`;
      html += `<div class="r-line">
        <span class="r-l">${ci.flag} ${ci.name}</span>
        <span class="r-r y" style="font-size:15px"><b>${ci.symbol}${fmtNum(r.needPrice)}</b> ${badge}</span>
      </div>
      <div class="r-line" style="font-size:11px;color:#4a4e5e">
        <span class="r-l">USD $${r.needFusd.toFixed(2)} · 运${formatUSD(r.ship)} · 货源${formatUSD(r.costUsd)}</span>
      </div>`;
    }
    html += `</div>`;
    $('crossResult').innerHTML = html;
  } else if (rs.error) {
    $('crossResult').innerHTML = `<div class="res-card fade"><span style="color:#fb7185;font-size:15px">❌ ${rs.error}</span></div>`;
  } else {
    const badge = rs.useBelow ? `<span class="thr-badge low">⬇ 低阈值</span>` : `<span class="thr-badge high">⬆ 高阈值</span>`;
    $('crossResult').innerHTML = `
      <div class="res-card fade">
        <div class="r-hdr">${c.flag} ${c.name} · 阈值${rs.thrLabel} ${badge}</div>
        <div class="r-val" style="color:#FFE600">🎯 净利润 ${formatCNY(rs.targetProfitCny)} → <b>${c.symbol}${fmtNum(rs.needPrice)}</b></div>
        <div class="r-div"></div>
        <div class="r-line"><span class="r-l">需要ML售价 (USD)</span><span class="r-r y">${formatUSD(rs.needFusd)}</span></div>
        <div class="r-line"><span class="r-l">需要ML到账 (80%)</span><span class="r-r g">${formatUSD(rs.needNet)}</span></div>
        <div class="r-line"><span class="r-l">运费</span><span class="r-r r">-${formatUSD(rs.ship)}</span></div>
        <div class="r-line"><span class="r-l">货源</span><span class="r-r r">-${formatUSD(rs.costUsd)}</span></div>
        <div class="r-line"><span class="r-l">缓冲</span><span class="r-r r">-$0.50</span></div>
        <div class="r-div"></div>
        <div class="r-line" style="font-size:11px;color:#4a4e5e">
          <span class="r-l">运费低/高: ${formatUSD(rs.below)}/${formatUSD(rs.above)} · 当前: ${formatUSD(rs.ship)}</span>
        </div>
      </div>`;
  }
}

// ─── Toast ────────────────────────────────────────
function showToast(msg, color) {
  const existing = document.querySelector('.v5-toast');
  if (existing) existing.remove();
  const d = document.createElement('div');
  d.className = 'v5-toast';
  d.textContent = msg;
  d.style.cssText = `position:fixed;bottom:42px;left:10px;right:10px;background:#1e2030;color:${color || '#d0d4e2'};padding:8px 12px;border-radius:8px;font-size:14px;text-align:center;z-index:9999;border:1px solid rgba(255,230,0,0.15);animation:fadeIn 0.2s ease;font-weight:500`;
  document.body.appendChild(d);
  setTimeout(() => { if (d.parentNode) d.remove(); }, 2500);
}

function clearAllResults() {
  ['calcResult', 'revResult', 'cmpResult', 'crossResult'].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = '';
  });
}

// ─── 1688 自动填充 ────────────────────────────────
function fillFromProduct(data) {
  if (!data) return;

  // 多款产品 → 不自动填任何东西
  if (data.has_multiple_skus) {
    const scrapeResult = $('scrapeResult');
    if (scrapeResult && data.title) {
      scrapeResult.innerHTML = `
        <div class="scrape-card fade">
          <span style="font-size:14px;font-weight:600">📦 多款SKU</span>
          <span class="s-title">${data.title.slice(0, 35)}${data.title.length > 35 ? '...' : ''}</span>
          ${data.images && data.images[0] ? `<img src="${data.images[0]}" style="width:128px;height:128px;border-radius:10px;margin-top:5px;object-fit:cover;border:1px solid rgba(255,255,255,0.08)">` : ''}
          <div style="font-size:11px;color:#4a4e5e;margin-top:2px">
            ℹ️ 多款SKU，请手动填写价格和重量
          </div>
        </div>`;
    }
    return;
  }

  // 单款 — 自动填重量
  if (data.weight && $('inpWeight')) $('inpWeight').value = data.weight;
  if (data.weight && $('crossWeight')) $('crossWeight').value = data.weight;
  if (data.weight && $('cmpWeight')) $('cmpWeight').value = data.weight;
  if (data.weight && $('revWeight')) $('revWeight').value = data.weight;

  const scrapeResult = $('scrapeResult');
  if (scrapeResult && data.title) {
    scrapeResult.innerHTML = `
      <div class="scrape-card fade">
        <span style="font-size:14px;font-weight:600">✅ 已填充重量</span>
        <span class="s-title">${data.title.slice(0, 35)}${data.title.length > 35 ? '...' : ''}</span>
        ${data.images && data.images[0] ? `<img src="${data.images[0]}" style="width:128px;height:128px;border-radius:10px;margin-top:5px;object-fit:cover;border:1px solid rgba(255,255,255,0.08)">` : ''}
        <div style="font-size:13px;color:#f0f2f8;margin-top:4px">
          ⚖️ 重量: <b>${data.weight ? data.weight + 'kg' : '?'}</b>
        </div>
      </div>`;
  }
}

// ─── DOMContentLoaded ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // ═══════ 密钥验证 ═══════
  const auth = checkAuth();
  if (!auth.ok) {
    renderLockScreen(auth.msg);
    return;
  }
  // 显示密钥状态
  const authEl = document.getElementById('authStatus');
  if (authEl) {
    authEl.textContent = auth.msg;
    authEl.className = auth.remaining <= 1 ? 'fx-badge off' : 'fx-badge on';
  }

  renderSiteBtns();
  initTabs();

  // Load cached FX + product
  try {
    chrome.storage.local.get(['fx_standalone', 'last_product'], d => {
      if (d.fx_standalone) {
        fx = d.fx_standalone;
        renderFX(fx);
        if ($('fxBadge')) { $('fxBadge').textContent = '缓存'; $('fxBadge').className = 'fx-badge cache'; }
      } else { fetchFX(); }
      if (d.last_product && Date.now() - (d.product_timestamp || 0) < 60000) {
        fillFromProduct(d.last_product);
      }
    });
  } catch (e) { fetchFX(); }

  // Listen for auto-scraped products
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'auto_product_ready' && msg.data) {
      fillFromProduct(msg.data);
    }
  });

  // ── Scrape 1688 ──
  $('scrapeBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('1688.com')) {
        showToast('⚠️ 当前不是1688商品页');
        return;
      }
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'scrape1688' });
      if (resp && !resp.error && resp.price_min) {
        showToast(`✅ ¥${resp.price_min} / ${resp.weight || '?'}kg`, '#34d399');
        fillFromProduct(resp);
      } else showToast('⚠️ 未扒取到数据，请手动输入', '#fb7185');
    } catch (e) {
      showToast('⚠️ 页面未加载完或无法访问', '#fb7185');
    }
  });

  // ── 模式1: 核价 ──
  $('calcBtn').addEventListener('click', () => {
    const price = parseFloat($('inpPrice').value);
    const weight = parseFloat($('inpWeight').value);
    const sourcing = parseFloat($('inpSourcing').value);
    if (!price || !weight || !sourcing) { showToast('⚠️ 请填全售价、重量、货源价'); return; }
    const r = calcProfit(activeSite, price, weight, sourcing, 0);
    showCalcResult(r);
  });

  // ── 模式2: 反向 ──
  document.querySelectorAll('[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.dataset.pct);
      if (activePcts.has(pct)) { activePcts.delete(pct); btn.classList.remove('on'); }
      else { activePcts.add(pct); btn.classList.add('on'); }
    });
  });
  $('revBtn').addEventListener('click', () => {
    const weight = parseFloat($('revWeight').value);
    const sourcing = parseFloat($('revSourcing').value);
    if (!weight || !sourcing) { showToast('⚠️ 请填写重量和货源价'); return; }
    if (activePcts.size === 0) { showToast('⚠️ 请至少选择一个目标利润率'); return; }
    const r = calcReverse(activeSite, weight, sourcing, 0);
    showRevResult(r);
  });

  // ── 模式2B: 按净利润反向 ──
  // (removed, use 跨境 tab instead)

  // ── 模式2C: 售价利润率 ──
  // (removed)

  // ── 模式3: 全站对比 ──
  $('cmpBtn').addEventListener('click', () => {
    const price = parseFloat($('cmpPrice').value);
    const weight = parseFloat($('cmpWeight').value);
    const sourcing = parseFloat($('cmpSourcing').value);
    if (!price || !weight || !sourcing) { showToast('⚠️ 请填全售价(USD)、重量、货源价'); return; }
    if (!fx || !fx.usd_cny) { showToast('⚠️ 汇率未就绪'); return; }
    const results = {};
    for (const ck of CKS) {
      const curr = COUNTRIES[ck].currency;
      if (!fx[curr]) { results[ck] = { error: true }; continue; }
      const fusd = price;
      const afterComm = fusd * ML_CUT;
      // 全站对比: USD售价统一，需按当地币判断阈值
      const localPrice = price * fx[curr];
      const s = getShipFeeResolve(ck, weight, localPrice);
      const net = afterComm - s.fee;
      const srcCost = sourcing * fx.usd_cny + BUFFER;
      const profit = net - srcCost;
      const margin = net > 0 ? (profit / net) * 100 : 0;
      results[ck] = { profit, margin, shipping: s.fee, ok: profit > 0, useBelow: s.useBelow };
    }
    showCmpResult(results);
  });

  // ══ 模式4: 跨境净利润模式 ══
  $('crossCalcBtn').addEventListener('click', () => {
    const price = parseFloat($('crossPrice').value);
    const weight = parseFloat($('crossWeight').value);
    const sourcing = parseFloat($('crossSourcing').value);
    if (!price || !weight || !sourcing) { showToast('⚠️ 请填全ML售价、重量、货源价'); return; }
    const r = calcCrossProfit(activeSite, price, weight, sourcing, 0);
    showCrossProfit(r);
  });

  $('crossRevBtn').addEventListener('click', () => {
    const weight = parseFloat($('crossWeight').value);
    const sourcing = parseFloat($('crossSourcing').value);
    const targetProfit = parseFloat($('crossProfitTarget').value);
    if (!weight || !sourcing) { showToast('⚠️ 请填写重量和货源价'); return; }
    if (!targetProfit || targetProfit <= 0) { showToast('⚠️ 请输入目标净利润(¥)'); return; }
    const r = calcCrossReverse(activeSite, weight, sourcing, 0, targetProfit);
    showCrossReverse(r);
  });

  $('crossAllBtn').addEventListener('click', () => {
    const weight = parseFloat($('crossWeight').value);
    const sourcing = parseFloat($('crossSourcing').value);
    const targetProfit = parseFloat($('crossProfitTarget').value);
    if (!weight || !sourcing) { showToast('⚠️ 请填写重量和货源价'); return; }
    if (!targetProfit || targetProfit <= 0) { showToast('⚠️ 请输入目标净利润(¥)'); return; }
    const results = [];
    for (const ck of CKS) {
      const r = calcCrossReverse(ck, weight, sourcing, 0, targetProfit);
      if (!r.error) { r.siteKey = ck; results.push(r); }
    }
    showCrossReverse(results);
  });

  // ══ 模式5: 多模式 ══
  // ── 多模式切换标签 ──
  $('multiMode').addEventListener('change', () => {
    const mode = $('multiMode').value;
    const label = $('multiTargetLabel');
    const inp = $('multiTarget');
    switch (mode) {
      case 'profit_value': label.textContent = '期望利润 ¥'; inp.placeholder = '50'; break;
      case 'net_margin': label.textContent = '目标毛利率 %'; inp.placeholder = '20'; break;
      case 'sale_margin': label.textContent = '售价利润率 %'; inp.placeholder = '15'; break;
      case 'cost_margin': label.textContent = '成本利润率 %'; inp.placeholder = '25'; break;
      case 'net_profit_margin': label.textContent = '净利润毛利率 %'; inp.placeholder = '20'; break;
      case 'forward_margin': label.textContent = '正向利润率 %'; inp.placeholder = '20'; break;
    }
  });

  function doMultiCalculate() {
    const mode = $('multiMode').value;
    const targetVal = parseFloat($('multiTarget').value) || 0;
    const costRmb = parseFloat($('multiCost').value) || 0;
    const grossG = parseFloat($('multiWeight').value) || 0;
    const l = parseFloat($('multiLen').value) || 0;
    const w = parseFloat($('multiWid').value) || 0;
    const h = parseFloat($('multiHei').value) || 0;
    const domShip = parseFloat($('multiDom').value) || 0;
    const packFee = parseFloat($('multiPack').value) || 0;
    const lossRate = parseFloat($('multiLoss').value) || 0;
    const discRate = parseFloat($('multiDisc').value) || 0;

    if (!costRmb) { showToast('⚠️ 请填采购成本'); return; }
    if (!targetVal) { showToast('⚠️ 请填目标值'); return; }

    const volG = (l * w * h) / 6000 * 1000;
    const billG = Math.max(grossG, volG);
    const billKg = billG / 1000;
    const rateCny = fx && fx.usd_cny ? (1.0 / fx.usd_cny) : FALLBACK_RATES.CNY;
    const actualCost = (costRmb + packFee) * (1 + lossRate / 100) + domShip;
    const costUsd = actualCost / rateCny;

    const results = {};
    let html = '<div class="site-btns" style="margin-bottom:6px">';

    for (const ck of CKS) {
      const curr = COUNTRIES[ck].currency;
      const rateLocal = fx && fx[curr] ? fx[curr] : FALLBACK_RATES[curr];
      const comm = 20; // 固定20%
      const commRate = comm / 100;
      const threshold = SHIP_THRESHOLD[ck];
      const { above: shipAbove, below: shipBelow } = getShipRates(ck, billKg);

      function calcForShip(shipUsd) {
        let saleUsd, netUsd;
        switch (mode) {
          case 'profit_value': {
            const profitUsd = targetVal / rateCny;
            saleUsd = (costUsd + profitUsd + shipUsd) / (1 - commRate);
            break;
          }
          case 'net_margin': {
            const m = targetVal / 100;
            if (m >= 1) return null;
            saleUsd = (costUsd / (1 - m) + shipUsd) / (1 - commRate);
            break;
          }
          case 'sale_margin': {
            const m = targetVal / 100;
            if (commRate + m >= 1) return null;
            saleUsd = (costUsd + shipUsd) / (1 - commRate - m);
            break;
          }
          case 'cost_margin': {
            const m = targetVal / 100;
            saleUsd = (actualCost * (1 + m) / rateCny + shipUsd) / (1 - commRate);
            break;
          }
          case 'net_profit_margin': {
            const m = targetVal / 100;
            const baseUsd = costUsd + 0.5;
            const targetNet = baseUsd * (1 + m);
            saleUsd = (targetNet + shipUsd) / (1 - commRate);
            break;
          }
          case 'forward_margin': {
            const m = targetVal / 100;
            const baseUsd = costUsd - 0.5;
            const targetNet = baseUsd * (1 + m);
            saleUsd = (targetNet + shipUsd) / (1 - commRate);
            break;
          }
          default: return null;
        }
        if (!saleUsd || saleUsd <= 0) return null;
        netUsd = saleUsd * (1 - commRate) - shipUsd;
        const listPrice = saleUsd / (1 - discRate / 100);
        const localPrice = saleUsd * rateLocal;
        const netCny = netUsd * rateCny;
        const profitCny = netCny - actualCost;
        return { saleUsd, netUsd, listPrice, localPrice, netCny, profitCny, shipUsd, commUsd: saleUsd * commRate, ok: profitCny > 0 };
      }

      // 阈值判断
      let result = calcForShip(shipAbove);
      let shipUsed = shipAbove, useBelow = false;
      if (result) {
        const localP = result.saleUsd * rateLocal;
        if (localP < threshold) {
          useBelow = true;
          shipUsed = shipBelow;
          result = calcForShip(shipBelow);
        }
      }
      if (!result) result = calcForShip(shipBelow);
      if (!result) continue;

      results[ck] = { ...result, useBelow, shipUsed, shipAbove, shipBelow, rateLocal, threshold, comm };
      const cls = result.ok ? '#34d399' : '#fb7185';
      const badge = useBelow ? `<span class="thr-badge low">⬇</span>` : `<span class="thr-badge high">⬆</span>`;
      html += `<button style="flex:1;min-width:55px;padding:6px 4px;border-radius:6px;border:1.5px solid ${cls};background:rgba(255,255,255,0.03);cursor:pointer;font-size:11px;text-align:center;line-height:1.4" data-multi-ck="${ck}">
        ${COUNTRIES[ck].flag} ${COUNTRIES[ck].name} ${badge}
        <br><b style="color:#34d399;font-size:13px">${formatUSD(result.netUsd)}</b>
      </button>`;
    }
    html += '</div>';

    // 详细结果
    let detail = '<div class="res-card fade">';
    const sorted = CKS.map(k => ({ ck: k, r: results[k] })).filter(x => x.r && !x.r.error);
    for (const { ck, r } of sorted) {
      const cls = r.ok ? '#34d399' : '#fb7185';
      const badge = r.useBelow ? `<span class="thr-badge low">⬇低阈值</span>` : `<span class="thr-badge high">⬆高阈值</span>`;
      detail += `<div class="r-line"><span class="r-l">${COUNTRIES[ck].flag} ${COUNTRIES[ck].name}</span><span class="r-r y" style="font-size:14px;font-weight:700">${COUNTRIES[ck].symbol}${fmtNum(Math.round(r.localPrice))}</span></div>
      <div class="r-line" style="font-size:11px;color:#4a4e5e">
        <span class="r-l">到账 ${formatUSD(r.netUsd)} · 佣${r.comm}% · 运${formatUSD(r.shipUsed)} ${badge}</span>
        <span class="r-r" style="color:${cls}">利润 ${formatCNY(r.profitCny)}</span>
      </div>`;
    }
    html += detail + '</div>';
    $('multiResult').innerHTML = html;

    // 点击卡片选国家
    document.querySelectorAll('[data-multi-ck]').forEach(el => {
      el.addEventListener('click', () => {
        activeSite = el.dataset.multiCk;
        renderSiteBtns();
        showToast(`📌 已选 ${COUNTRIES[activeSite].flag} ${COUNTRIES[activeSite].name}`, '#34d399');
      });
    });
  }

  $('multiCalcBtn').addEventListener('click', doMultiCalculate);
  $('multiTarget').addEventListener('keydown', e => { if (e.key === 'Enter') doMultiCalculate(); });

  // ── Enter键 ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const mode = document.querySelector('#modeTabs .tab.act');
      if (!mode) return;
      switch (mode.dataset.mode) {
        case 'calc': $('calcBtn').click(); break;
        case 'reverse': $('revBtn').click(); break;
        case 'compare': $('cmpBtn').click(); break;
        case 'cross': $('crossRevBtn').click(); break;
        case 'multi': $('multiCalcBtn').click(); break;
      }
    }
  });

  // ── FX refresh ──
  $('refreshFxBtn').addEventListener('click', fetchFX);
});
