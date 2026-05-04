/* FVV 基础注入 */
(function(){
    if(window.__fvvInjected) return;
    window.__fvvInjected = true;
    console.log('[FVV] 脚本已注入');

    // 检查是否在ML商品页
    const itemId = (location.href.match(/(ML[A-Z]{2}-?\d+)/)||[])[1];
    const isMlPage = location.href.includes('mercadolibre');
    console.log('[FVV] 页面类型:', isMlPage?'ML页面':'非ML页面', '商品ID:', itemId);

    // 监听消息
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'scrape_ml' || req.action === 'auto_scrape') {
            const id = (location.href.match(/(ML[A-Z]{2}-?\d+)/)||[])[1];
            const title = document.title || '';
            const priceEl = document.querySelector('.andes-money-amount__fraction');
            const price = priceEl ? parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')) || 0 : 0;

            const data = {
                ml_item_id: id,
                site_id: location.href.includes('.com.mx')?'MLM':location.href.includes('.com.br')?'MLB':'MLM',
                title: title.slice(0,200),
                price: price,
            };

            console.log('[FVV] 采集到:', JSON.stringify(data));
            sendResponse(data);
            return true;
        }
    });

    // 自动发送就绪信号
    chrome.runtime.sendMessage({ action: 'scraper_ready', itemId: itemId, isMlPage: isMlPage }).catch(()=>{});
})();
