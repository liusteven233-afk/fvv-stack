// FVV计算器 v2.2 — 需输入秘钥验证
// ── Auth ──────────────────────────────────────────
const FVV_SECRET = "FVV-F1D3D04D-A2C1B500-EFA1985A";
const FVV_EXPIRES = 1778043790; // seconds timestamp

function checkAuth() {
  const now = Math.floor(Date.now() / 1000);
  if (now >= FVV_EXPIRES) return { ok: false, remaining: 0, msg: '🔒 秘钥已过期' };
  const remaining = Math.ceil((FVV_EXPIRES - now) / 86400);
  return { ok: true, remaining, msg: `🔑 ${remaining}天` };
}

function verifyKey(inputKey) {
  return inputKey.trim() === FVV_SECRET;
}
// ── Data ──────────────────────────────────────────
const COUNTRIES = {
  MX: { name: '墨西哥', flag: '🇲🇽', currency: 'MXN', symbol: 'MX$', comm: 17.5, rate: 20.0, key: 'MX' },
  BR: { name: '巴西',   flag: '🇧🇷', currency: 'BRL', symbol: 'R$',  comm: 18.0, rate: 5.5,  key: 'BR' },
  CL: { name: '智利',   flag: '🇨🇱', currency: 'CLP', symbol: 'CLP$',comm: 16.0, rate: 950, key: 'CL' },
  CO: { name: '哥伦比亚',flag: '🇨🇴', currency: 'COP', symbol: 'COL$',comm: 17.5, rate: 4200,key: 'CO' },
  AR: { name: '阿根廷', flag: '🇦🇷', currency: 'ARS', symbol: 'ARS$',comm: 19.5, rate: 1450,key: 'AR' },
  UY: { name: '乌拉圭', flag: '🇺🇾', currency: 'UYU', symbol: 'UYU$',comm: 16.0, rate: 42,  key: 'UY' },
};
const CKS = ['MX', 'BR', 'CL', 'CO', 'AR', 'UY'];

// Thresholds (local currency): below threshold → lower shipping cost
const THRESHOLDS = { MX: 299, BR: 79, CL: 19990, CO: 60000, AR: 33000, UY: 1200 };

// ── CORRECT SHIPPING DATA from original Hajimi source ──
// [weight_limit_kg, high_threshold_price(above), low_threshold_price(below)]
const SHIPPING_RAW = {
  MX: [[0.1,4.0,1.7],[0.2,5.4,2.1],[0.3,6.8,2.9],[0.4,8.5,3.9],[0.5,9.9,5.0],[0.6,11.8,6.9],[0.7,13.4,8.9],[0.8,14.8,10.7],[0.9,16.3,13.8],[1.0,17.3,13.8],[1.5,21.8,21.8],[2.0,30.2,30.2],[2.5,51.8,51.8],[3.0,51.8,51.8],[3.5,60.6,60.6],[4.0,60.6,60.6]],
  BR: [[0.1,5.1,1.7],[0.2,6.2,2.4],[0.3,9.3,2.9],[0.4,9.6,4.1],[0.5,12.2,4.7],[0.6,12.7,6.8],[0.7,15.0,9.0],[0.8,15.2,10.0],[0.9,18.0,12.0],[1.0,18.5,16.0],[1.5,22.5,22.5],[2.0,29.6,29.6],[2.5,44.7,44.7]],
  CL: [[0.1,4.0,1.2],[0.2,5.0,1.2],[0.3,6.4,1.2],[0.4,7.9,1.8],[0.5,9.1,1.8],[0.6,10.0,3.6],[0.7,11.2,3.6],[0.8,11.8,3.6],[0.9,13.3,6.0],[1.0,14.0,6.0],[1.5,18.5,12.0],[2.0,25.1,24.0],[2.5,46.1,36.0],[3.0,46.1,36.0],[3.5,55.2,48.0],[4.0,55.2,48.0],[4.5,69.0,69.0],[5.0,69.0,69.0],[5.5,82.7,82.7],[6.0,82.7,82.7],[6.5,96.4,96.4],[7.0,96.4,96.4],[7.5,110.1,110.1],[8.0,110.1,110.1],[8.5,123.8,123.8],[9.0,123.8,123.8],[9.5,137.5,137.5]],
  CO: [[0.1,4.1,1.8],[0.2,5.5,2.4],[0.3,6.8,3.5],[0.4,8.8,5.0],[0.5,9.4,6.5],[0.6,11.9,8.2],[0.7,12.7,9.5],[0.8,13.3,10.5],[0.9,14.1,12.5],[1.0,14.8,14.8],[1.5,20.5,20.5],[2.0,28.3,28.3],[2.5,47.5,45.0],[3.0,47.5,45.0],[3.5,62.1,60.0],[4.0,62.1,60.0],[4.5,73.2,73.2],[5.0,73.2,73.2],[5.5,86.3,86.3],[6.0,86.3,86.3],[6.5,103.2,103.2],[7.0,103.2,103.2],[7.5,120.2,120.2],[8.0,120.2,120.2],[8.5,137.4,137.4],[9.0,137.4,137.4],[9.5,154.5,154.5]],
  AR: [[0.1,12.4,5.0],[0.2,13.6,5.0],[0.3,15.0,5.0],[0.4,16.3,5.0],[0.5,17.7,8.0],[0.6,19.0,8.0],[0.7,20.3,9.0],[0.8,21.7,9.0],[0.9,23.0,12.0],[1.0,24.3,12.0],[1.5,28.0,12.0],[2.0,35.1,25.0],[2.5,41.6,35.0],[3.0,48.2,45.0],[3.5,55.6,55.6],[4.0,61.9,61.9],[4.5,68.0,68.0],[5.0,74.5,74.5],[5.5,82.0,82.0],[6.0,88.1,88.1],[6.5,95.1,95.1],[7.0,101.8,101.8],[7.5,109.0,109.0],[8.0,114.2,114.2],[8.5,121.0,121.0],[9.0,128.4,128.4]],
  UY: [[0.1,8.31,8.31],[0.2,10.2,10.2],[0.3,11.91,11.91],[0.4,13.78,13.78],[0.5,15.68,15.68],[0.6,18.71,18.71],[0.7,20.62,20.62],[0.8,22.51,22.51],[0.9,24.40,24.40],[1.0,26.28,26.28],[1.5,32.09,32.09],[2.0,42.68,42.68],[2.5,53.00,53.00],[3.0,63.29,63.29],[3.5,74.59,74.59],[4.0,84.49,84.49],[4.5,93.67,93.67],[5.0,104.97,104.97],[5.5,115.04,115.04],[6.0,125.80,125.80],[6.5,137.88,137.88],[7.0,145.59,145.59]],
};

function getShipping(ck, weightKg) {
  const rates = SHIPPING_RAW[ck] || [];
  for (const [limit, above, below] of rates) {
    if (weightKg <= limit) return { above, below, limit };
  }
  const last = rates[rates.length - 1];
  return { above: last[1], below: last[2], limit: last[0] };
}

const FALLBACK_FX = { MXN: 20.0, BRL: 5.5, CLP: 950, COP: 4200, ARS: 1450, UYU: 42, CNY: 7.25 };

// ── State ─────────────────────────────────────────
let selectedCountry = null;
let fxCache = null;
let calcResults = {};      // { MX: {...}, BR: {...}, ... }

const $ = id => document.getElementById(id);

// ── DOM Ready ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // ── Auth check ──
  const expiry = checkAuth();
  if (!expiry.ok) {
    renderLockScreen('🔒 秘钥已过期，请联系管理员续期', true);
    return;
  }

  // Check for saved key (localStorage + chrome.storage)
  const savedKey = (() => { try { return localStorage.getItem('fvv_key'); } catch(e) { return null; } })();
  if (savedKey && verifyKey(savedKey)) {
    initApp(expiry);
  } else {
    try {
      chrome.storage.local.get(['fvv_key'], d => {
        if (d && d.fvv_key && verifyKey(d.fvv_key)) {
          // Sync to localStorage
          try { localStorage.setItem('fvv_key', d.fvv_key); } catch(e) {}
          initApp(expiry);
        } else {
          renderLockScreen('', false);
        }
      });
    } catch (e) {
      renderLockScreen('', false);
    }
  }
});

function handleKeySubmit() {
  const input = document.getElementById('fvvKeyInput');
  const errEl = document.getElementById('fvvKeyErr');
  const key = input ? input.value.trim() : '';
  if (!verifyKey(key)) {
    if (errEl) errEl.textContent = '❌ 秘钥错误，请重试';
    if (input) { input.value = ''; input.focus(); }
    return;
  }
  // Save key and reload page (lock screen wiped original DOM)
  try { localStorage.setItem('fvv_key', key); } catch(e) {}
  try { chrome.storage.local.set({ fvv_key: key }); } catch(e) {}
  window.location.reload();
}

function initApp(expiry) {
  // Show auth status in header
  const authEl = document.getElementById('authStatus');
  if (authEl) {
    const timeStr = new Date(FVV_EXPIRES * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    authEl.innerHTML = `🔑 <b>${expiry.remaining}天</b> (至 ${timeStr})`;
    if (expiry.remaining <= 1) authEl.className = 'auth-bar warn';
    else if (expiry.remaining <= 3) authEl.className = 'auth-bar mid';
    else authEl.className = 'auth-bar ok';
  }
  renderCards();
  initProfitMode();
  initCalcTabs();
  initSettlementToggle();
  initShipToggle();
  updateWeightSummary();
  loadFXCache();

  // Event listeners
  $('profitMode').addEventListener('change', onProfitModeChange);
  $('calcBtn').addEventListener('click', doCalculateAll);
  $('fetchFxBtn').addEventListener('click', fetchOnlineFX);
  $('forwardCalcBtn').addEventListener('click', doForwardCalc);
  $('reverseCalcBtn').addEventListener('click', doReverseCalc);
  $('copyBtn').addEventListener('click', copyResults);
  $('resetBtn').addEventListener('click', resetAll);
  $('salePriceUsd').addEventListener('keydown', e => { if (e.key === 'Enter') doForwardCalc(); });
  $('targetProfitUsd').addEventListener('keydown', e => { if (e.key === 'Enter') doReverseCalc(); });
  $('compPrice').addEventListener('keydown', e => { if (e.key === 'Enter') doCompCalc(); });
  $('compWeight').addEventListener('keydown', e => { if (e.key === 'Enter') doCompCalc(); });
  $('compCalcBtn').addEventListener('click', doCompCalc);

  // Auto-recalculate on input changes (debounced)
  ['purchaseCost','grossWeight','length','width','height','domesticShip','packFee','lossRate','discountRate','targetValue','fxCny','fxLocal'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', debounce(() => { updateWeightSummary(); }, 200));
  });

  // Recalc on Enter from main inputs
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') {
        doCalculateAll();
      }
    }
  });

  // Initial calculation
  setTimeout(doCalculateAll, 100);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── FX ────────────────────────────────────────────
function loadFXCache() {
  try {
    chrome.storage.local.get(['hajimi_fx'], d => {
      if (d && d.hajimi_fx) {
        fxCache = d.hajimi_fx;
        applyFXToInputs();
        $('fxStatus').textContent = '缓存';
        $('fxStatus').className = 'bdg bdg-b';
        doCalculateAll();
      } else {
        fetchOnlineFX();
      }
    });
  } catch (e) {
    fetchOnlineFX();
  }
}

async function fetchOnlineFX() {
  const status = $('fxStatus');
  const btn = $('fetchFxBtn');
  status.textContent = '获取中...';
  status.className = 'bdg bdg-r';
  if (btn) btn.disabled = true;

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
      const needed = ['MXN', 'BRL', 'CLP', 'COP', 'ARS', 'UYU', 'CNY'];
      const hits = needed.filter(c => rt[c] && rt[c] > 0);
      if (hits.length >= 3) {
        rates = {};
        needed.forEach(c => { if (rt[c]) rates[c] = rt[c]; });
        rates.fetched = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        break;
      }
    } catch (e) { /* try next */ }
  }

  if (!rates) {
    rates = { ...FALLBACK_FX, fetched: '离线' };
    status.textContent = '离线备用';
    status.className = 'bdg bdg-b';
  } else {
    status.textContent = `在线 ${rates.fetched}`;
    status.className = 'bdg bdg-g';
    try { chrome.storage.local.set({ hajimi_fx: rates }); } catch(e) {}
  }

  fxCache = rates;
  applyFXToInputs();
  if (btn) btn.disabled = false;
  doCalculateAll();
}

function applyFXToInputs() {
  if (!fxCache) return;
  const cnyInp = $('fxCny');
  if (cnyInp && fxCache.CNY) cnyInp.value = fxCache.CNY.toFixed(4);
}

function getFXLocal(ck) {
  if (fxCache) {
    const c = COUNTRIES[ck];
    if (fxCache[c.currency]) return fxCache[c.currency];
  }
  return COUNTRIES[ck].rate;
}

function getFXCNY() {
  const val = parseFloat($('fxCny').value);
  if (val && val > 0) return val;
  if (fxCache && fxCache.CNY) return fxCache.CNY;
  return FALLBACK_FX.CNY;
}

// ── Commission Management ─────────────────────────
function getCommission(ck) {
  // First try from dedicated storage
  try {
    const el = document.querySelector(`.comm-input[data-ck="${ck}"]`);
    if (el) {
      const v = parseFloat(el.value);
      if (v && v > 0 && v < 100) return v;
    }
  } catch(e) {}
  return COUNTRIES[ck].comm;
}

function saveCommission(ck, val) {
  // Commission is read from the DOM input; just trigger recalc
  doCalculateAll();
}

// ── Weight Calculation ────────────────────────────
function calcWeight() {
  const gross = parseFloat($('grossWeight').value) || 0;
  const l = parseFloat($('length').value) || 0;
  const w = parseFloat($('width').value) || 0;
  const h = parseFloat($('height').value) || 0;
  const volWeight = (l * w * h) / 6000 * 1000; // grams
  const billWeight = Math.max(gross, volWeight);
  return { gross, volWeight, billWeight, isVol: volWeight > gross };
}

function updateWeightSummary() {
  const w = calcWeight();
  $('volBadge').textContent = `📦 泡重: ${Math.round(w.volWeight)} g`;
  $('grossBadge').textContent = `⚖️ 毛重: ${Math.round(w.gross)} g`;
  $('billBadge').textContent = `📊 计费重: ${Math.round(w.billWeight)} g ${w.isVol ? '(泡重>' : '(毛重>'}`;
}

// ── Shipping ──────────────────────────────────────
function getShippingCost(ck, weightKg) {
  const s = getShipping(ck, weightKg);
  return [s.above, s.below]; // [aboveThresholdFee, belowThresholdFee]
}

function formatShipTable(ck, billWeightKg) {
  const rates = SHIPPING_RAW[ck];
  if (!rates) return '';
  const currentShip = getShipping(ck, billWeightKg);
  let html = '';
  for (const [limit, above, below] of rates) {
    const isCurrent = Math.abs(limit - currentShip.limit) < 0.001;
    const hl = isCurrent ? 'hl' : '';
    const curr = isCurrent ? '◄ 当前' : '';
    html += `<tr class="${hl}"><td>≤${limit}kg</td><td>$${below.toFixed(2)}</td><td>$${above.toFixed(2)}</td><td style="text-align:right">${curr}</td></tr>`;
  }
  return html;
}

// ── Core Calculation ──────────────────────────────
function calculate(ck) {
  const w = calcWeight();
  const billWeightKg = w.billWeight / 1000;

  // Inputs
  const costRmb = parseFloat($('purchaseCost').value) || 0;
  const domesticShip = parseFloat($('domesticShip').value) || 0;
  const packFee = parseFloat($('packFee').value) || 0;
  const lossRate = parseFloat($('lossRate').value) || 0;
  const discRate = parseFloat($('discountRate').value) || 0;
  const targetVal = parseFloat($('targetValue').value) || 0;
  const profitMode = $('profitMode').value;

  // Rates
  const rateUsdRmb = getFXCNY();
  const rateUsdLocal = getFXLocal(ck);
  const commission = getCommission(ck);
  const threshold = THRESHOLDS[ck];
  const commRate = commission / 100;

  // Actual cost (CNY)
  const actualCost = (costRmb + packFee) * (1 + lossRate / 100) + domesticShip;
  const costUsd = actualCost / rateUsdRmb;

  // Shipping costs
  const [shipAbove, shipBelow] = getShippingCost(ck, billWeightKg);

  // Calculate for both threshold scenarios
  function calcForShip(shipUsd) {
    let saleUsd, listPrice, netUsd;

    switch (profitMode) {
      case 'profit_value': {
        // targetValue is CNY profit
        const profitUsd = targetVal / rateUsdRmb;
        saleUsd = (costUsd + profitUsd + shipUsd) / (1 - commRate);
        break;
      }
      case 'net_margin': {
        // targetValue is margin % of net revenue
        const m = targetVal / 100;
        if (m >= 1) return null;
        saleUsd = (costUsd / (1 - m) + shipUsd) / (1 - commRate);
        break;
      }
      case 'sale_margin': {
        // targetValue is margin % of sale price
        const m = targetVal / 100;
        if (commRate + m >= 1) return null;
        saleUsd = (costUsd + shipUsd) / (1 - commRate - m);
        break;
      }
      case 'cost_margin': {
        // targetValue is margin % of cost
        const m = targetVal / 100;
        saleUsd = (actualCost * (1 + m) / rateUsdRmb + shipUsd) / (1 - commRate);
        break;
      }
      default:
        return null;
    }

    if (!saleUsd || saleUsd <= 0) return null;
    listPrice = saleUsd / (1 - discRate / 100);
    netUsd = saleUsd * (1 - commRate) - shipUsd;

    // Local price
    const localPrice = saleUsd * rateUsdLocal;
    const listLocal = listPrice * rateUsdLocal;

    // CNY values
    const netCny = netUsd * rateUsdRmb;
    const profitCny = netCny - actualCost;
    const actualMargin = netCny > 0 ? (profitCny / netCny) * 100 : 0;
    const saleMargin = saleUsd > 0 ? (profitCny / rateUsdRmb / saleUsd) * 100 : 0;
    const costMargin = actualCost > 0 ? (profitCny / actualCost) * 100 : 0;

    return {
      saleUsd, listPrice, netUsd,
      localPrice, listLocal,
      netCny, profitCny, actualMargin,
      saleMargin, costMargin,
      shipUsd, commUsd: saleUsd * commRate,
      costUsd, actualCost,
      ok: profitCny > 0,
      discount: discRate,
    };
  }

  // Determine which threshold applies
  const aboveResult = calcForShip(shipAbove);
  const belowResult = calcForShip(shipBelow);

  let useBelow = false;
  let result = aboveResult;
  let shipUsed = shipAbove;

  if (aboveResult) {
    const localPrice = aboveResult.saleUsd * rateUsdLocal;
    if (localPrice < threshold) {
      useBelow = true;
      shipUsed = shipBelow;
      result = belowResult || aboveResult;
    } else {
      result = aboveResult;
      shipUsed = shipAbove;
    }
  } else if (belowResult) {
    result = belowResult;
    shipUsed = shipBelow;
    useBelow = true;
  }

  if (!result) return { error: '计算无解（请检查利润率是否过高）' };

  // Recalculate with correct shipping
  result = calcForShip(shipUsed);
  if (!result) return { error: '计算无解' };

  // Final threshold check
  const finalLocalPrice = result.saleUsd * rateUsdLocal;
  useBelow = finalLocalPrice < threshold;

  return {
    ...result,
    country: COUNTRIES[ck].name,
    flag: COUNTRIES[ck].flag,
    currency: COUNTRIES[ck].currency,
    symbol: COUNTRIES[ck].symbol,
    commRate,
    commission,
    threshold,
    useBelow,
    shipUsed,
    shipAbove,
    shipBelow,
    rateUsdLocal,
    rateUsdRmb,
    billWeight: w.billWeight,
    billWeightKg,
    volWeight: w.volWeight,
    grossWeight: w.gross,
    isVol: w.isVol,
    discRate,
  };
}

// ── Render Cards ──────────────────────────────────
function renderCards() {
  const el = $('countryCards');
  if (!el) return;
  el.innerHTML = CKS.map(ck => {
    const c = COUNTRIES[ck];
    const r = calcResults[ck];
    const act = selectedCountry === ck ? ' act' : '';
    let npHtml = '<div class="np wait">--</div>';
    if (r) {
      if (r.error) {
        npHtml = `<div class="np no">❌ ${r.error}</div>`;
      } else {
        const cls = r.ok ? 'ok' : 'no';
        npHtml = `<div class="np ${cls}">$${r.netUsd.toFixed(2)}</div>`;
      }
    }
    const comm = getCommission(ck);
    return `<div class="card${act}" data-ck="${ck}">
      <span class="flag">${c.flag}</span><span class="cn">${c.name}</span>
      <span class="tag g"><input class="comm-input" data-ck="${ck}" type="number" step="0.1" min="0.1" max="99.9" value="${comm}" />%</span>
      <div class="cr">${c.symbol} · T:${THRESHOLDS[ck]}</div>
      <div class="cl">${r && !r.error ? `售价: ${c.symbol}${formatLocal(r.localPrice, ck)} | 到账: $${r.netUsd.toFixed(2)}` : '点击计算'}</div>
      ${npHtml}
    </div>`;
  }).join('');

  // Click handlers
  el.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const ck = card.dataset.ck;
      selectCountry(ck);
    });
  });

  // Commission input change handlers
  el.querySelectorAll('.comm-input').forEach(inp => {
    inp.addEventListener('change', function() {
      const ck = this.dataset.ck;
      const v = parseFloat(this.value);
      if (v && v > 0 && v < 100) {
        doCalculateAll();
      }
    });
    inp.addEventListener('click', e => {
      e.stopPropagation(); // prevent card click
    });
  });
}

function formatLocal(val, ck) {
  if (!val || isNaN(val)) return '0';
  if (ck === 'CL') return Math.round(val).toLocaleString();
  if (ck === 'CO') return Math.round(val).toLocaleString();
  if (ck === 'AR') return Math.round(val).toLocaleString();
  return val.toFixed(2);
}

function selectCountry(ck) {
  selectedCountry = ck;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('act', c.dataset.ck === ck));
  $('selectedCountry').textContent = COUNTRIES[ck].flag + ' ' + COUNTRIES[ck].name;
  updateSettlement(ck);
  updateShipping(ck);
  $('settlementSection').style.display = 'block';
  $('shippingSection').style.display = 'block';

  // Update FX local display
  const fxLocal = getFXLocal(ck);
  $('fxLocal').value = fxLocal.toFixed(4);

  // Update competitor currency badge
  const compCur = $('compCurrency');
  if (compCur) compCur.textContent = COUNTRIES[ck].symbol;
}

function updateSettlement(ck) {
  const r = calcResults[ck];
  const el = $('settlementContent');
  if (!el) return;
  if (!r || r.error) {
    el.innerHTML = `<div class="r-line"><span class="r-l" style="color:#fb7185">${r ? r.error : '请先计算该国家'}</span></div>`;
    return;
  }

  const c = COUNTRIES[ck];
  const profitCny = r.profitCny;
  const netCny = r.netCny;
  const costRmb = r.actualCost;
  const saleUsd = r.saleUsd;

  el.innerHTML = `
    <div class="r-hdr">${c.flag} ${c.name} · ${c.symbol} · ${c.currency}</div>
    <div class="r-line"><span class="r-l">平台标价</span><span class="r-r">${c.symbol}${formatLocal(r.listLocal, ck)}</span></div>
    <div class="r-line"><span class="r-l">折扣率 ${r.discount}%</span><span class="r-r">${c.symbol}${formatLocal(r.listLocal * r.discount / 100, ck)}</span></div>
    <div class="r-line"><span class="r-l">折后售价 (USD)</span><span class="r-r y">$${r.saleUsd.toFixed(2)} / ${c.symbol}${formatLocal(r.localPrice, ck)}</span></div>
    <div class="r-line"><span class="r-l">平台佣金 (${r.commission}%)</span><span class="r-r r">-$${r.commUsd.toFixed(2)}</span></div>
    <div class="r-line"><span class="r-l">平台运费 (${r.useBelow ? '低阈值' : '高阈值'})</span><span class="r-r r">-$${r.shipUsed.toFixed(2)}</span></div>
    <div class="r-div"></div>
    <div class="r-line"><span class="r-l" style="font-weight:600;font-size:14px">🚀 到账 (净利润/USD)</span><span class="r-r g" style="font-size:19px;font-weight:700">$${r.netUsd.toFixed(2)}</span></div>
    <div class="r-line"><span class="r-l">净收益 (CNY)</span><span class="r-r">¥${r.netCny.toFixed(2)}</span></div>
    <div class="r-div"></div>
    <div class="r-hdr">📦 成本拆解</div>
    <div class="r-line"><span class="r-l">采购价 ¥${costRmb.toFixed(2)}</span><span class="r-r r">-¥${costRmb.toFixed(2)}</span></div>
    <div class="r-div"></div>
    <div class="r-hdr">📊 利润分析</div>
    <div class="r-line"><span class="r-l" style="font-weight:600">最终利润</span><span class="r-r ${r.ok ? 'g' : 'r'}" style="font-size:16px;font-weight:700">${r.ok ? '✅' : '⚠️'} ¥${profitCny.toFixed(2)}</span></div>
    <div class="r-line"><span class="r-l">实际毛利率(占净收)</span><span class="r-r ${r.actualMargin > 0 ? 'g' : 'r'}">${r.actualMargin.toFixed(2)}%</span></div>
    <div class="r-line"><span class="r-l">实际利润率(占售价)</span><span class="r-r ${r.saleMargin > 0 ? 'g' : 'r'}">${r.saleMargin.toFixed(2)}%</span></div>
    <div class="r-line"><span class="r-l">实际利润率(占成本)</span><span class="r-r ${r.costMargin > 0 ? 'g' : 'r'}">${r.costMargin.toFixed(2)}%</span></div>
    <div class="r-div"></div>
    <div class="r-line" style="font-size:10px;color:#5a5e6a">
      <span class="r-l">计费重: ${Math.round(r.billWeight)}g ${r.isVol ? '(泡重)' : '(毛重)'} · 汇率: ${r.rateUsdRmb.toFixed(4)}</span>
      <span class="r-r">阈值: ${c.symbol}${THRESHOLDS[ck]} ${r.useBelow ? '⬇低' : '⬆高'}</span>
    </div>
  `;
}

function updateShipping(ck) {
  if (!ck) return;
  const w = calcWeight();
  const billWeightKg = w.billWeight / 1000;
  const c = COUNTRIES[ck];

  $('shipCountryName').textContent = c.flag + ' ' + c.name;
  $('shipBillWeight').textContent = Math.round(w.billWeight) + 'g';
  $('shipThreshold').textContent = c.symbol + THRESHOLDS[ck];

  const r = calcResults[ck];
  if (r && !r.error) {
    $('shipThresholdStatus').textContent = r.useBelow ? '⬇ 低阈值运费' : '⬆ 高阈值运费';
    $('shipThresholdStatus').className = r.useBelow ? 'bdg bdg-y' : 'bdg bdg-b';
  }

  $('shipBodyRows').innerHTML = formatShipTable(ck, billWeightKg);
}

// ── Calculate All ─────────────────────────────────
function doCalculateAll() {
  updateWeightSummary();
  const results = {};
  let firstValid = null;
  for (const ck of CKS) {
    const r = calculate(ck);
    results[ck] = r;
    if (r && !r.error && !firstValid) firstValid = ck;
  }
  calcResults = results;
  renderCards();

  // Auto-select first valid country if none selected
  if (!selectedCountry && firstValid) {
    selectCountry(firstValid);
  } else if (selectedCountry && results[selectedCountry]) {
    selectCountry(selectedCountry);
  }

  // Update FX local for selected
  if (selectedCountry) {
    $('fxLocal').value = getFXLocal(selectedCountry).toFixed(4);
  }
}

// ── Forward / Reverse ─────────────────────────────
function doForwardCalc() {
  const saleUsd = parseFloat($('salePriceUsd').value);
  if (!saleUsd || saleUsd <= 0) return;

  if (!selectedCountry) {
    showToast('⚠️ 请先选择国家');
    return;
  }

  const ck = selectedCountry;
  const c = COUNTRIES[ck];
  const w = calcWeight();
  const billWeightKg = w.billWeight / 1000;
  const rateUsdRmb = getFXCNY();
  const rateUsdLocal = getFXLocal(ck);
  const commission = getCommission(ck);
  const commRate = commission / 100;
  const costRmb = parseFloat($('purchaseCost').value) || 0;
  const domesticShip = parseFloat($('domesticShip').value) || 0;
  const packFee = parseFloat($('packFee').value) || 0;
  const lossRate = parseFloat($('lossRate').value) || 0;
  const discRate = parseFloat($('discountRate').value) || 0;
  const actualCost = (costRmb + packFee) * (1 + lossRate / 100) + domesticShip;
  const costUsd = actualCost / rateUsdRmb;

  const [shipAbove, shipBelow] = getShippingCost(ck, billWeightKg);
  const localPrice = saleUsd * rateUsdLocal;
  const useBelow = localPrice < THRESHOLDS[ck];
  const shipUsd = useBelow ? shipBelow : shipAbove;
  const commUsd = saleUsd * commRate;
  const netUsd = saleUsd - commUsd - shipUsd;
  const netCny = netUsd * rateUsdRmb;
  const profitCny = netCny - actualCost;
  const actualMargin = netCny > 0 ? (profitCny / netCny) * 100 : 0;
  const saleMargin = saleUsd > 0 ? (profitCny / rateUsdRmb / saleUsd) * 100 : 0;
  const costMargin = actualCost > 0 ? (profitCny / actualCost) * 100 : 0;
  const listPrice = saleUsd / (1 - discRate / 100);

  // Show result in settlement
  const result = {
    saleUsd, listPrice, netUsd, localPrice,
    listLocal: listPrice * rateUsdLocal,
    netCny, profitCny, actualMargin, saleMargin, costMargin,
    shipUsd, commUsd, costUsd, actualCost,
    ok: profitCny > 0,
    useBelow, shipUsed: shipUsd, shipAbove, shipBelow,
    commRate, commission, threshold: THRESHOLDS[ck],
    rateUsdLocal, rateUsdRmb, billWeight: w.billWeight,
    billWeightKg, volWeight: w.volWeight, grossWeight: w.gross, isVol: w.isVol,
    discRate, discount: discRate,
    country: c.name, flag: c.flag, currency: c.currency, symbol: c.symbol,
  };
  calcResults[ck] = result;
  renderCards();
  selectCountry(ck);
  showToast(`✅ 正向: 到账 $${netUsd.toFixed(2)} / 利润 ¥${profitCny.toFixed(2)}`, '#10b981');
}

function doReverseCalc() {
  const targetProfit = parseFloat($('targetProfitUsd').value);
  if (!targetProfit || targetProfit <= 0) return;
  if (!selectedCountry) {
    showToast('⚠️ 请先选择国家');
    return;
  }

  const ck = selectedCountry;
  const c = COUNTRIES[ck];
  const w = calcWeight();
  const billWeightKg = w.billWeight / 1000;
  const rateUsdRmb = getFXCNY();
  const rateUsdLocal = getFXLocal(ck);
  const commission = getCommission(ck);
  const commRate = commission / 100;
  const costRmb = parseFloat($('purchaseCost').value) || 0;
  const domesticShip = parseFloat($('domesticShip').value) || 0;
  const packFee = parseFloat($('packFee').value) || 0;
  const lossRate = parseFloat($('lossRate').value) || 0;
  const actualCost = (costRmb + packFee) * (1 + lossRate / 100) + domesticShip;
  const costUsd = actualCost / rateUsdRmb;

  const [shipAbove, shipBelow] = getShippingCost(ck, billWeightKg);

  // Need to find saleUsd such that netUsd - costUsd = targetProfit
  // netUsd = saleUsd * (1-commRate) - ship
  // saleUsd * (1-commRate) - ship - costUsd = targetProfit
  // saleUsd = (targetProfit + costUsd + ship) / (1-commRate)
  const saleAbove = (targetProfit + costUsd + shipAbove) / (1 - commRate);
  const saleBelow = (targetProfit + costUsd + shipBelow) / (1 - commRate);

  // Check threshold
  const localAbove = saleAbove * rateUsdLocal;
  let useBelow = localAbove < THRESHOLDS[ck];
  let saleUsd = useBelow ? saleBelow : saleAbove;
  let shipUsd = useBelow ? shipBelow : shipAbove;

  // Re-check
  const finalLocal = saleUsd * rateUsdLocal;
  useBelow = finalLocal < THRESHOLDS[ck];

  const commUsd = saleUsd * commRate;
  const netUsd = saleUsd - commUsd - shipUsd;
  const netCny = netUsd * rateUsdRmb;
  const profitCny = netCny - actualCost;

  $('salePriceUsd').value = saleUsd.toFixed(2);

  showToast(`✅ 反向: 需售价 $${saleUsd.toFixed(2)} → 利润 ¥${profitCny.toFixed(2)}`, '#FFE600');
  doForwardCalc(); // trigger update
}

// ── 竞品算到账 ──────────────────────────────────
function doCompCalc() {
  if (!selectedCountry) {
    showToast('⚠️ 请先选择国家', '#fb7185');
    return;
  }
  const compPrice = parseFloat($('compPrice').value);
  if (!compPrice || compPrice <= 0) {
    showToast('⚠️ 请填写竞品当地售价', '#fb7185');
    return;
  }
  const ck = selectedCountry;
  const c = COUNTRIES[ck];
  const rateUsdLocal = getFXLocal(ck);
  const commission = getCommission(ck);
  const commRate = commission / 100;
  const w = calcWeight();

  // Weight: use compWeight if filled, else main form's billWeight
  const compWeightG = parseFloat($('compWeight').value) || w.billWeight;
  const billWeightKg = compWeightG / 1000;

  const [shipAbove, shipBelow] = getShippingCost(ck, billWeightKg);
  const saleUsd = compPrice / rateUsdLocal;
  const localPrice = saleUsd * rateUsdLocal;

  // Threshold check
  const useBelow = localPrice < THRESHOLDS[ck];
  const shipUsd = useBelow ? shipBelow : shipAbove;
  const commUsd = saleUsd * commRate;
  const netUsd = saleUsd - commUsd - shipUsd;

  const resultEl = $('compResult');
  resultEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <span style="color:#7a7f8c">竞品售价 → USD</span>
      <span>${c.symbol}${formatLocal(compPrice, ck)} → $${saleUsd.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <span style="color:#7a7f8c">佣金(${commission}%)</span>
      <span style="color:#fb7185">-$${commUsd.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <span style="color:#7a7f8c">运费(${useBelow ? '低' : '高'}阈值)</span>
      <span style="color:#fb7185">-$${shipUsd.toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-weight:700;font-size:15px">
      <span style="color:#10b981">📥 到账 (净利润)</span>
      <span style="color:#10b981;font-size:17px">$${netUsd.toFixed(2)}</span>
    </div>
    <div style="font-size:10px;color:#5a5e6a;margin-top:2px;text-align:center">
      计费重: ${Math.round(billWeightKg * 1000)}g · 汇率: ${rateUsdLocal.toFixed(4)}
    </div>
  `;
  showToast(`✅ 竞品到账: $${netUsd.toFixed(2)} (${c.name})`, '#10b981');
}

// ── Profit Mode ──────────────────────────────────
function initProfitMode() {
  onProfitModeChange();
}

function onProfitModeChange() {
  const mode = $('profitMode').value;
  const label = $('targetLabel');
  const inp = $('targetValue');
  switch (mode) {
    case 'profit_value':
      label.textContent = '期望利润 ¥';
      inp.placeholder = '0.00';
      break;
    case 'net_margin':
      label.textContent = '目标毛利率 %';
      inp.placeholder = '20';
      if (!inp.value || inp.value === '50') inp.value = '20';
      break;
    case 'sale_margin':
      label.textContent = '售价利润率 %';
      inp.placeholder = '15';
      if (!inp.value || inp.value === '50') inp.value = '15';
      break;
    case 'cost_margin':
      label.textContent = '成本利润率 %';
      inp.placeholder = '25';
      if (!inp.value || inp.value === '50') inp.value = '25';
      break;
  }
}

// ── Tabs ──────────────────────────────────────────
function initCalcTabs() {
  const tabs = document.querySelectorAll('#calcTabs .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('act'));
      tab.classList.add('act');
      const mode = tab.dataset.mode;
      $('forwardSection').style.display = mode === 'forward' ? 'block' : 'none';
      $('reverseSection').style.display = mode === 'reverse' ? 'block' : 'none';
    });
  });
}

// ── Collapsible ──────────────────────────────────
function initSettlementToggle() {
  const hdr = $('settlementToggle');
  const bd = $('settlementBody');
  if (!hdr || !bd) return;
  let open = true;
  hdr.addEventListener('click', () => {
    open = !open;
    hdr.classList.toggle('open', open);
    bd.style.display = open ? 'block' : 'none';
  });
}

function initShipToggle() {
  const hdr = $('shipToggle');
  const bd = $('shipBody');
  if (!hdr || !bd) return;
  let open = true;
  hdr.addEventListener('click', () => {
    open = !open;
    hdr.classList.toggle('open', open);
    bd.style.display = open ? 'block' : 'none';
  });
}

// ── Copy / Reset ─────────────────────────────────
function copyResults() {
  let text = 'FVV计算器 v2.0 结果\n' + '='.repeat(36) + '\n';
  for (const ck of CKS) {
    const r = calcResults[ck];
    if (!r || r.error) continue;
    const c = COUNTRIES[ck];
    text += `\n${c.flag} ${c.name} [${c.currency}]\n`;
    text += `  售价: ${c.symbol}${formatLocal(r.localPrice, ck)} ($${r.saleUsd.toFixed(2)})\n`;
    text += `  佣金(${r.commission}%): -$${r.commUsd.toFixed(2)}\n`;
    text += `  运费(${r.useBelow ? '低阈值' : '高阈值'}): -$${r.shipUsed.toFixed(2)}\n`;
    text += `  净收益: $${r.netUsd.toFixed(2)} = ¥${r.netCny.toFixed(2)}\n`;
    text += `  成本: ¥${r.actualCost.toFixed(2)}\n`;
    text += `  利润: ¥${r.profitCny.toFixed(2)} ${r.ok ? '✅盈利' : '⚠️亏损'}\n`;
    text += `  毛利率(占净收): ${r.actualMargin.toFixed(2)}%\n`;
    text += `  利润率(占售价): ${r.saleMargin.toFixed(2)}%\n`;
    text += `  利润率(占成本): ${r.costMargin.toFixed(2)}%\n`;
  }
  text += '\n' + '='.repeat(36) + '\n';
  if (calcResults[CKS[0]]) {
    text += `计费重: ${Math.round(calcResults[CKS[0]].billWeight)}g\n`;
  }
  text += `汇率 USD/CNY: ${getFXCNY().toFixed(4)}\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('✅ 已复制到剪贴板', '#10b981');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('✅ 已复制', '#10b981');
  });
}

function resetAll() {
  selectedCountry = null;
  calcResults = {};
  $('purchaseCost').value = '100';
  $('grossWeight').value = '500';
  $('length').value = '20';
  $('width').value = '15';
  $('height').value = '10';
  $('domesticShip').value = '0';
  $('packFee').value = '4';
  $('lossRate').value = '5';
  $('discountRate').value = '30';
  $('targetValue').value = '50';
  $('salePriceUsd').value = '';
  $('targetProfitUsd').value = '';
  $('profitMode').value = 'profit_value';
  onProfitModeChange();
  $('settlementSection').style.display = 'none';
  $('shippingSection').style.display = 'none';
  $('selectedCountry').textContent = '未选择';
  $('fxLocal').value = '--';
  updateWeightSummary();
  renderCards();
  showToast('🔄 已重置', '#7a7f8c');
}

// ── Toast ─────────────────────────────────────────
function showToast(msg, color) {
  const existing = document.querySelector('.fvv-toast');
  if (existing) existing.remove();
  const d = document.createElement('div');
  d.className = 'fvv-toast';
  d.textContent = msg;
  d.style.cssText = `position:fixed;bottom:38px;left:10px;right:10px;background:#1a1c23;color:${color || '#e4e6ef'};padding:6px 10px;border-radius:5px;font-size:12px;text-align:center;z-index:9999;border:1px solid rgba(255,230,0,0.12);animation:fadeIn 0.15s ease`;
  document.body.appendChild(d);
  setTimeout(() => { if (d.parentNode) d.remove(); }, 2500);
}

// ── Lock Screen ──────────────────────────────────
function renderLockScreen(msg, expired) {
  const inputHtml = expired ? '' : `
    <input id="fvvKeyInput" type="password" placeholder="输入秘钥" style="width:100%;max-width:240px;padding:10px 12px;border-radius:6px;border:1px solid rgba(255,230,0,0.2);background:rgba(255,255,255,0.03);color:#e4e6ef;font-size:14px;outline:none;text-align:center" autofocus />
    <button id="fvvUnlockBtn" style="padding:8px 20px;border-radius:6px;border:none;background:linear-gradient(135deg,#FFE600,#e0c800);color:#0b0c0f;font-weight:600;font-size:13px;cursor:pointer">🔓 解锁</button>
    <div id="fvvKeyErr" style="color:#fb7185;font-size:12px;min-height:18px"></div>`;
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0b0c0f;padding:30px;text-align:center;gap:14px">
      <div style="font-size:48px">${expired ? '🔒' : '🔐'}</div>
      <h2 style="color:#FFE600;font-size:20px;font-weight:700">FVV计算器</h2>
      ${expired
        ? `<div style="color:#fb7185;font-size:14px;background:rgba(251,113,133,0.08);border:1px solid rgba(251,113,133,0.2);border-radius:8px;padding:12px 18px;max-width:280px">${msg}</div>`
        : `<div style="color:#9ea3ae;font-size:13px">请输入秘钥以解锁</div>${inputHtml}`
      }
      <div style="color:#6a6e7a;font-size:11px;margin-top:4px">联系管理员获取秘钥</div>
    </div>`;
  // Attach event listeners (inline handlers blocked by CSP)
  if (!expired) {
    const inp = document.getElementById('fvvKeyInput');
    const btn = document.getElementById('fvvUnlockBtn');
    if (inp) {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleKeySubmit(); });
      setTimeout(() => inp.focus(), 100);
    }
    if (btn) btn.addEventListener('click', handleKeySubmit);
  }
}
