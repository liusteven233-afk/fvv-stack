// Hermes Background Service Worker v1.2
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Hermes] Extension installed / updated');
  // Ensure side panel behavior is set
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error('[Hermes] Side panel setup:', err);
  });
});

// Also set on startup for reliability
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
  console.error('[Hermes] Side panel setup (startup):', err);
});

// Listen for FX rate broadcasts from the dashboard
chrome.runtime.onMessageExternal.addListener((msg, sender) => {
  if (msg && msg.type === 'fx_update') {
    chrome.storage.local.set({ fx: msg.data }).catch((err) => {
      console.error('[Hermes] Failed to store FX data:', err);
    });
  }
});

// Keep service worker alive a bit for reliability
chrome.storage.session.set({ alive: Date.now() }).catch(() => {});
