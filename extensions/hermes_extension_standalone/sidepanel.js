// Hermes 独立核价 v3.1
// ─── Data ──────────────────────────────────────
const COUNTRIES = {
  MX: { name: 'México', flag: '🇲🇽', currency: 'MXN', symbol: 'MX$' },
  BR: { name: 'Brasil', flag: '🇧🇷', currency: 'BRL', symbol: 'R$' },
  CO: { name: 'Colombia', flag: '🇨🇴', currency: 'COP', symbol: 'COL$' },
  CL: { name: 'Chile', flag: '🇨🇱', currency: 'CLP', symbol: 'CLP$' },
  AR: { name: 'Argentina', flag: '🇦🇷', currency: 'ARS', symbol: 'ARS$' },
  UY: { name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', symbol: 'UYU$' },
};
const CKS = ['MX', 'BR', 'CO', 'CL', 'AR', 'UY'];
const SHIP_BK = [0, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
const BK_LBL = ['0-100g', '100-200g', '200-500g', '500g-1kg', '1-2kg', '2-5kg'];
const DEFAULT_SHIP = {
  MX: [1.70, 2.10, 3.93, 10.82, 26.00, 61.03],
  BR: [1.70, 2.40, 3.90, 10.76, 26.05, 50.10],
  CO: [1.80, 2.40, 5.00, 11.10, 24.40, 59.40],
  CL: [1.20, 1.20, 1.60, 4.56, 18.00, 51.00],
  AR: [5.00, 5.00, 6.00, 10.00, 18.50, 56.67],
  UY: [3.00, 3.50, 4.50, 6.00, 8.00, 11.00],
};
const FALLBACK_RATES = { MXN: 20.0, BRL: 5.5, COP: 4200, CLP: 950, ARS: 1450, UYU: 42, CNY: 7.3 };
const ML_CUT = 0.80;
const BUFFER = 0.50;

let activeSite = 'MX';
let fx = null;
let activePcts = new Set([10, 20]);

const $ = id => document.getElementById(id);

// ─── Init site buttons ────────────────────────
function renderSiteBtns() {
  const el = $('siteBtns');
  if (!el) return;
  el.innerHTML = CKS.map(k => {
    const c = COUNTRIES[k];
    return `<button class="${k === activeSite ? 'act' : 'ina'}" data-site="${k}">${c.flag} ${c.name}</button>`;
  }).join('');
  el.querySelectorAll('.ina').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSite = btn.dataset.site;
      renderSiteBtns();
      clearAllResults();
    });
  });
}

// ─── Mode tabs ─────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('#modeTabs .tab');
  if (!tabs.length) return;
  const sections = {
    calc: 'calcSection',
    reverse: 'revSection',
    compare: 'cmpSection',
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

// ─── FX fetching ──────────────────────────────
async function fetchFX() {
  const fxDisp = $('fxDisp');
  const fxBadge = $('fxBadge');
  const refreshBtn = $('refreshFxBtn');
  if (!fxDisp || !fxBadge || !refreshBtn) return;

  fxDisp.textContent = '获取中...';
  fxBadge.textContent = '加载';
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
        break;
      }
    } catch (e) {
      // try next URL
    }
  }
  if (!rates) {
    rates = { ...FALLBACK_RATES, fetched: '离线', usd_cny: 1.0 / FALLBACK_RATES.CNY };
    fxBadge.textContent = '备用';
  }
  fx = rates;
  try {
    await chrome.storage.local.set({ fx_standalone: rates });
  } catch (e) {
    // storage might not be available
  }
  renderFX(rates);
  refreshBtn.disabled = false;
}

function renderFX(r) {
  if (!r) { const el = $('fxDisp'); if (el) el.textContent = '暂无'; return; }
  const el = $('fxDisp');
  if (!el) return;
  el.innerHTML = Object.entries(r)
    .filter(([k]) => k !== 'fetched' && k !== 'usd_cny')
    .map(([k, v]) => `<span style="margin-right:4px"><b>${k}</b> ${typeof v === 'number' ? v.toFixed(4) : v}</span>`)
    .join('');
  if (r.fetched) el.innerHTML += `<br><span style="color:#4a4e58">🕐 ${r.fetched}</span>`;
}

// ─── Calculations ─────────────────────────────
function shipFee(ck, w) {
  const rates = DEFAULT_SHIP[ck] || [0, 0, 0, 0, 0, 0];
  if (!w || w <= 0) return 0;
  for (let i = 0; i < SHIP_BK.length - 1; i++) {
    if (w >= SHIP_BK[i] && w < SHIP_BK[i + 1]) return rates[i] || 0;
  }
  return rates[rates.length - 1] || 0;
}

function calcProfit(ck, price, weight, sourcing) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪，请刷新' };
  const fusd = price / fx[curr];
  const afterComm = fusd * ML_CUT;
  const ship = shipFee(ck, weight);
  const net = afterComm - ship;
  const srcCost = sourcing * fx.usd_cny + BUFFER;
  const profit = net - srcCost;
  const margin = net > 0 ? (profit / net) * 100 : 0;
  return { site: COUNTRIES[ck].flag + ' ' + COUNTRIES[ck].name, currency: curr,
    fusd, mlFee: fusd * (1 - ML_CUT), afterComm, shipping: ship, net, srcCost, profit, margin,
    ok: profit > 0, tier: weightTier(weight) };
}

function calcReverse(ck, weight, sourcing) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪，请刷新' };
  const ship = shipFee(ck, weight);
  const results = [];
  const pts = [10, 15, 20, 25, 30];
  for (const pct of pts) {
    const needProfit = sourcing * fx.usd_cny * (pct / 100);
    const needNet = sourcing * fx.usd_cny + BUFFER + needProfit;
    const needAml = needNet + ship;
    const needFusd = needAml / ML_CUT;
    const needPrice = needFusd * fx[curr];
    results.push({ pct, needPrice: Math.round(needPrice), needFusd: needFusd.toFixed(2), needNet: needNet.toFixed(2) });
  }
  return { ship, results };
}

function calcReverseByProfit(ck, weight, sourcing, targetProfitUsd) {
  const curr = COUNTRIES[ck].currency;
  if (!fx || !fx[curr] || !fx.usd_cny) return { error: '汇率未就绪，请刷新' };
  const ship = shipFee(ck, weight);
  const srcUsd = sourcing * fx.usd_cny + BUFFER;
  const needNet = srcUsd + targetProfitUsd;
  const needAml = needNet + ship;
  const needFusd = needAml / ML_CUT;
  const needPrice = needFusd * fx[curr];
  return { ship, srcUsd, needNet, needFusd, needPrice: Math.round(needPrice), targetProfitUsd };
}

function weightTier(w) {
  if (!w || w <= 0) return 'N/A';
  for (let i = 0; i < SHIP_BK.length - 1; i++) {
    if (w >= SHIP_BK[i] && w < SHIP_BK[i + 1]) return BK_LBL[i];
  }
  return BK_LBL[BK_LBL.length - 1];
}

function formatUSD(v) { return '$' + (typeof v === 'number' ? v.toFixed(2) : v); }

// ─── UI Results ───────────────────────────────
function showCalcResult(r) {
  if (r.error) { $('calcResult').innerHTML = `<div class="res fade"><span style="color:#fb7185">❌ ${r.error}</span></div>`; return; }
  const cls = r.ok ? '#10b981' : '#fb7185';
  $('calcResult').innerHTML = `
    <div class="res fade">
      <span class="l">${r.site} · ${r.currency} · 运费 ${r.tier}</span>
      <span class="v" style="color:${cls}">${r.ok ? '✅' : '❌'} 利润 ${formatUSD(r.profit)} · ${r.margin.toFixed(1)}%</span>
      <span class="l">售价→USD: ${formatUSD(r.fusd)} | ML佣金: ${formatUSD(r.mlFee)} | 运费: ${formatUSD(r.shipping)}</span>
      <span class="l">到账: ${formatUSD(r.net)} | 货源(含缓冲): ${formatUSD(r.srcCost)}</span>
    </div>`;
}

function showRevResult(data) {
  if (data.error) { $('revResult').innerHTML = `<div class="res fade"><span style="color:#fb7185">❌ ${data.error}</span></div>`; return; }
  const c = COUNTRIES[activeSite];
  const weight = parseFloat($('revWeight').value || 0);
  let html = `<div class="res fade">
    <span class="l">${c.flag} ${c.name} · 运费: ${formatUSD(data.ship)} (${weightTier(weight)})</span>`;
  for (const r of data.results) {
    if (activePcts.has(r.pct)) {
      html += `<span class="v" style="color:#FFE600">🎯 ${r.pct}%利润 → <b>${c.symbol}${r.needPrice.toLocaleString()}</b> (USD $${r.needFusd}) | 到账 ${formatUSD(r.needNet)}</span>`;
    }
  }
  html += `</div>`;
  $('revResult').innerHTML = html;
}

function showRevProfitResult(data) {
  if (data.error) { $('revResult').innerHTML = `<div class="res fade"><span style="color:#fb7185">❌ ${data.error}</span></div>`; return; }
  const c = COUNTRIES[activeSite];
  const weight = parseFloat($('revWeight').value || 0);
  $('revResult').innerHTML = `<div class="res fade">
    <span class="l">${c.flag} ${c.name} · 运费: ${formatUSD(data.ship)} (${weightTier(weight)}) · 货源(含缓冲): ${formatUSD(data.srcUsd)}</span>
    <span class="v" style="color:#FFE600">🎯 净利润 <b>$${data.targetProfitUsd.toFixed(2)}</b> USD → <b>${c.symbol}${data.needPrice.toLocaleString()}</b></span>
    <span class="l">需售价USD: ${formatUSD(data.needFusd)} | 到账: ${formatUSD(data.needNet)}</span>
  </div>`;
}

function showCmpResult(results) {
  let html = '<div class="res fade">';
  const sorted = CKS.map(k => ({ ck: k, r: results[k] })).filter(x => x.r && !x.r.error);
  sorted.sort((a, b) => b.r.profit - a.r.profit);
  for (let i = 0; i < sorted.length; i++) {
    const { ck, r } = sorted[i];
    const cls = r.ok ? '#10b981' : '#fb7185';
    const rank = i === 0 ? '🏆 ' : `${i + 1}.`;
    html += `<span class="l">${rank} ${COUNTRIES[ck].flag} ${COUNTRIES[ck].name}</span>
      <span class="v" style="color:${cls}">${r.ok ? '✅' : '❌'} $${r.profit.toFixed(2)} · ${r.margin.toFixed(1)}% · 运费 $${r.shipping.toFixed(2)}</span>`;
  }
  html += '</div>';
  $('cmpResult').innerHTML = html;
}

function showToast(msg, color) {
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = `position:fixed;bottom:40px;left:10px;right:10px;background:#1a1c23;color:${color || '#e4e6ef'};padding:6px 10px;border-radius:5px;font-size:12px;text-align:center;z-index:999;border:1px solid rgba(255,230,0,0.12)`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2000);
}

function clearAllResults() {
  ['calcResult', 'revResult', 'cmpResult'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
}

// ─── Event handlers ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSiteBtns();
  initTabs();

  // Load cached FX
  try {
    chrome.storage.local.get(['fx_standalone'], d => {
      if (d && d.fx_standalone) {
        fx = d.fx_standalone;
        renderFX(fx);
        const badge = $('fxBadge');
        if (badge) badge.textContent = '缓存';
      } else {
        fetchFX();
      }
    });
  } catch (e) {
    // storage not available, fetch directly
    fetchFX();
  }

  // Scrape 1688
  $('scrapeBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('1688.com')) {
        showToast('⚠️ 当前不是1688商品页'); return;
      }
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'scrape1688' });
      if (resp && resp.price) {
        showToast(`✅ ¥${resp.price} / ${resp.weight || '?'}kg`, '#10b981');
        if ($('inpSourcing')) $('inpSourcing').value = resp.price;
        if (resp.weight && $('inpWeight')) $('inpWeight').value = resp.weight;
        if ($('scrapeResult')) $('scrapeResult').textContent = resp.title ? `📄 ${resp.title.substring(0, 28)}...` : '';
      } else showToast('⚠️ 未找到数据，请手动输入');
    } catch (e) {
      showToast('⚠️ 页面未加载完或无法访问');
    }
  });

  // Calc
  $('calcBtn').addEventListener('click', doCalc);
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const mode = document.querySelector('#modeTabs .tab.act');
      if (mode) {
        if (mode.dataset.mode === 'calc') doCalc();
        else if (mode.dataset.mode === 'reverse') doReverse();
        else if (mode.dataset.mode === 'compare') doCompare();
      }
    }
  });

  function doCalc() {
    const price = parseFloat($('inpPrice').value);
    const weight = parseFloat($('inpWeight').value);
    const sourcing = parseFloat($('inpSourcing').value);
    if (!price || !weight || !sourcing) { showToast('⚠️ 请填全售价、重量、货源价'); return; }
    const r = calcProfit(activeSite, price, weight, sourcing);
    if (r.error) { showCalcResult(r); return; }
    showCalcResult(r);
  }

  // Reverse pricing - profit % buttons
  document.querySelectorAll('[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.dataset.pct);
      if (activePcts.has(pct)) { activePcts.delete(pct); btn.classList.remove('on'); }
      else { activePcts.add(pct); btn.classList.add('on'); }
    });
  });

  $('revBtn').addEventListener('click', doReverse);
  $('revProfitBtn').addEventListener('click', doReverseByProfit);
  function doReverse() {
    const weight = parseFloat($('revWeight').value);
    const sourcing = parseFloat($('revSourcing').value);
    if (!weight || !sourcing) { showToast('⚠️ 请填写重量和货源价'); return; }
    if (activePcts.size === 0) { showToast('⚠️ 请至少选择一个目标利润率'); return; }
    const r = calcReverse(activeSite, weight, sourcing);
    if (r.error) { showRevResult(r); return; }
    showRevResult(r);
  }
  function doReverseByProfit() {
    const weight = parseFloat($('revWeight').value);
    const sourcing = parseFloat($('revSourcing').value);
    const targetProfit = parseFloat($('revProfitUsd').value);
    if (!weight || !sourcing) { showToast('⚠️ 请填写重量和货源价'); return; }
    if (!targetProfit || targetProfit <= 0) { showToast('⚠️ 请输入净利润(USD)'); return; }
    const r = calcReverseByProfit(activeSite, weight, sourcing, targetProfit);
    if (r.error) { showRevProfitResult(r); return; }
    showRevProfitResult(r);
  }

  // Compare
  $('cmpBtn').addEventListener('click', doCompare);
  function doCompare() {
    const price = parseFloat($('cmpPrice').value);
    const weight = parseFloat($('cmpWeight').value);
    const sourcing = parseFloat($('cmpSourcing').value);
    if (!price || !weight || !sourcing) { showToast('⚠️ 请填全售价(USD)、重量、货源价'); return; }
    if (!fx || !fx.usd_cny) { showToast('⚠️ 汇率未就绪，请刷新'); return; }
    const results = {};
    for (const ck of CKS) {
      const curr = COUNTRIES[ck].currency;
      if (!fx[curr]) { results[ck] = { error: true }; continue; }
      const fusd = price;
      const afterComm = fusd * ML_CUT;
      const s = shipFee(ck, weight);
      const net = afterComm - s;
      const srcCost = sourcing * fx.usd_cny + BUFFER;
      const profit = net - srcCost;
      const margin = net > 0 ? (profit / net) * 100 : 0;
      results[ck] = { profit, margin, shipping: s, ok: profit > 0 };
    }
    showCmpResult(results);
  }

  // Refresh FX
  $('refreshFxBtn').addEventListener('click', fetchFX);
});
