// Hermes 1688 扒取脚本 v2.0 — 每次请求实时查询
(function () {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrape1688') {
      try {
        const price = extractPrice();
        const title = extractTitle();
        const weight = extractWeight();
        sendResponse({
          price: price,
          weight: weight,
          title: title || document.title,
          url: window.location.href,
        });
      } catch (e) {
        console.log('Hermes: scrape error', e);
        sendResponse({
          price: null,
          weight: null,
          title: document.title,
          url: window.location.href,
        });
      }
      return true; // keep channel alive for async
    }
  });

  // ─── Price ─────────────────────────────────────
  function extractPrice() {
    // Detailed 1688 price selectors (ordered by specificity)
    const selectors = [
      '#J_StrPr49828281',
      '[data-spm="price"]',
      '.price-value',
      '.offer-price',
      '.tb-rmb-num',
      '.price .amount',
      'span.price',
      '[class*="price"] [class*="num"]',
      '[class*="price"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim().replace(/[^0-9.]/g, '');
        if (text && !isNaN(parseFloat(text)) && parseFloat(text) > 0) {
          return parseFloat(text);
        }
      }
    }
    // Fallback: scan visible text for ¥ price pattern
    const body = document.body.innerText;
    const m = body.match(/¥\s*([0-9]+\.?[0-9]*)/);
    if (m) return parseFloat(m[1]);

    return null;
  }

  // ─── Title ─────────────────────────────────────
  function extractTitle() {
    const selectors = [
      '.detail-title',
      '.mod-detail-title',
      'h1',
      '.tb-main-title',
      '[class*="title"]',
      'h1.title',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const t = el.textContent.trim();
        if (t.length > 3) return t;
      }
    }
    return null;
  }

  // ─── Weight ────────────────────────────────────
  function extractWeight() {
    const selectors = [
      '#J_Weight',
      '.goods-weight',
      '.weight',
      '[class*="weight"]',
      '[class*="shipping"]',
      '[class*="freight"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim().replace(/[^0-9.]/g, '');
        if (text && !isNaN(parseFloat(text)) && parseFloat(text) > 0) {
          return parseFloat(text);
        }
      }
    }
    // Fallback: scan for "x kg / x 千克 / x 公斤"
    const body = document.body.innerText;
    const m = body.match(/([0-9]+\.?[0-9]*)\s*(kg|千克|公斤)/i);
    if (m) return parseFloat(m[1]);

    return null;
  }
})();
