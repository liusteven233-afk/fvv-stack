/* Background */
const API_URL = 'http://127.0.0.1:8649';

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === 'ml_product_scraped' && msg.data) {
        chrome.storage.local.set({ last_ml_product: msg.data, ml_product_timestamp: Date.now() });
        chrome.runtime.sendMessage({ action: 'ml_product_ready', data: msg.data }).catch(()=>{});
        fetch(API_URL+'/api/products/sourcing', {
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(msg.data)
        }).catch(()=>{});
    }

    if (msg.action === 'scraper_ready') {
        console.log('[FVV bg] 内容脚本已就绪, itemId:', msg.itemId, 'isMlPage:', msg.isMlPage);
    }
});
