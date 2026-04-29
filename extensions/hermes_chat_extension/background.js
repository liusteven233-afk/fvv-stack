// Hermes Chat 扩展 background service worker v1.1
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Hermes Chat] 扩展已安装/更新');
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error('[Hermes Chat] setPanelBehavior 失败:', err));
