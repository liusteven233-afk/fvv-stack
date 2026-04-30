// 大帅比专用 v5 — Background Service Worker
// Auto-open sidepanel on 1688 detail pages

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Auto-open sidepanel when navigating to 1688 product pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('detail.1688.com/offer/')) {
    chrome.sidePanel.open({ tabId }).catch(() => {});
  }
});

// ─── 接收 content script 扒取数据 → 转发到 sidepanel ──
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !sender) return;

  if (msg.action === 'auto_scraped' && msg.data) {
    chrome.storage.local.set({
      last_product: msg.data,
      product_timestamp: Date.now(),
    }).catch(() => {});
  }

  if (msg.action === 'product_ready' && msg.data) {
    chrome.runtime.sendMessage({
      action: 'auto_product_ready',
      data: msg.data,
    }).catch(() => {});
  }
});

chrome.storage.session.set({ alive: Date.now() }).catch(() => {});
