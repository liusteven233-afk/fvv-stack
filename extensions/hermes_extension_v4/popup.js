// Hermes Popup v1.2
document.addEventListener('DOMContentLoaded', () => {
  loadFX();

  // Open side panel
  document.getElementById('openSidePanel').addEventListener('click', async () => {
    try {
      // Try to open side panel programmatically
      chrome.sidePanel.open().catch(() => {
        showToast('请点击浏览器工具栏的扩展图标打开侧边栏');
      });
    } catch (e) {
      showToast('请点击浏览器工具栏的扩展图标');
    }
  });

  // Scrape current 1688 product
  document.getElementById('scrapeCurrent').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('1688.com')) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape1688' });
        if (response && response.price) {
          showToast(`✅ 已扒取: ¥${response.price} / ${response.weight || '?'}kg`);
          chrome.storage.local.set({ lastScrape: response }).catch(() => {});
        } else {
          showToast('⚠️ 未能扒取，请手动输入');
        }
      } else {
        showToast('⚠️ 当前页面不是1688商品页');
      }
    } catch (e) {
      showToast('⚠️ 无法扒取，请刷新页面重试');
    }
  });

  // Send URL to side panel
  document.getElementById('sendUrl').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value.trim();
    if (url) {
      chrome.storage.local.set({ pendingUrl: url }).catch(() => {});
      showToast('✅ 已保存，侧边栏将使用该链接');
    } else {
      showToast('⚠️ 请输入链接');
    }
  });

  // Clear URL
  document.getElementById('clearUrl').addEventListener('click', () => {
    document.getElementById('urlInput').value = '';
  });

  // Refresh FX
  document.getElementById('refreshFx').addEventListener('click', refreshFX);
});

function loadFX() {
  chrome.storage.local.get(['fx_standalone', 'lastFX'], (data) => {
    const el = document.getElementById('fxDisplay');
    const badge = document.getElementById('fxBadge');
    if (!el) return;

    const rates = data.fx_standalone || data.lastFX;
    if (rates) {
      const entries = Object.entries(rates).filter(([k]) => k !== 'fetched' && k !== 'usd_cny');
      el.innerHTML = entries.map(([k, v]) =>
        `<span style="margin-right:8px"><b>${k}</b> ${typeof v === 'number' ? v.toFixed(4) : v}</span>`
      ).join('');
      if (rates.fetched) {
        el.innerHTML += `<br><span style="color:#4a4e58;font-size:12px">🕐 ${rates.fetched}</span>`;
      }
      if (badge) badge.textContent = '缓存';
    } else {
      el.textContent = '打开侧边栏后自动获取';
      if (badge) badge.textContent = '等待';
    }
  });
}

async function refreshFX() {
  const el = document.getElementById('fxDisplay');
  const badge = document.getElementById('fxBadge');
  if (!el) return;
  el.textContent = '获取中...';
  if (badge) badge.textContent = '加载';

  let rates = null;
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.dev/latest?from=USD',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      const rt = data.rates || {};
      const needed = ['MXN', 'BRL', 'COP', 'CLP', 'ARS', 'UYU', 'CNY'];
      const hits = needed.filter(c => rt[c] && rt[c] > 0);
      if (hits.length >= 3) {
        rates = {};
        needed.forEach(c => { if (rt[c]) rates[c] = rt[c]; });
        rates.fetched = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        rates.usd_cny = 1.0 / (rt.CNY || 7.25);
        if (badge) badge.textContent = '在线';
        break;
      }
    } catch {}
  }
  if (!rates) {
    rates = { MXN: 20.0, BRL: 5.5, COP: 4200, CLP: 950, ARS: 1450, UYU: 42, CNY: 7.3, fetched: '离线', usd_cny: 1.0 / 7.3 };
    if (badge) badge.textContent = '备用';
  }
  // Store and display
  chrome.storage.local.set({ fx_standalone: rates, lastFX: rates }).catch(() => {});
  const entries = Object.entries(rates).filter(([k]) => k !== 'fetched' && k !== 'usd_cny');
  el.innerHTML = entries.map(([k, v]) =>
    `<span style="margin-right:8px"><b>${k}</b> ${typeof v === 'number' ? v.toFixed(4) : v}</span>`
  ).join('');
  if (rates.fetched) {
    el.innerHTML += `<br><span style="color:#4a4e58;font-size:12px">🕐 ${rates.fetched}</span>`;
  }
}

function showToast(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = 'position:fixed;bottom:50px;left:16px;right:16px;background:#1a1c23;color:#e4e6ef;padding:8px 12px;border-radius:8px;font-size:14px;text-align:center;z-index:999;border:1px solid rgba(255,230,0,0.12)';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}
