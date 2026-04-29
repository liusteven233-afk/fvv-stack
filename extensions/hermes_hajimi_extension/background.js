// FVV计算器 · Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[FVV] Extension installed');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.storage.session.set({ alive: Date.now() }).catch(() => {});
