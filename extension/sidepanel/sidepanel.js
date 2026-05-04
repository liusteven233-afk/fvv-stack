/* Sidepanel - 极简版 */
const API_URL = 'http://127.0.0.1:8649';
let currentMLProduct = null;

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
});

// 监听采集结果
chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'ml_product_ready' && msg.data) {
        currentMLProduct = msg.data;
        document.getElementById('mlProductStatus').textContent = '✅ 已采集: ' + (msg.data.title||'').slice(0,30);
    }
});

// 手动采集
async function scrapeCurrentML() {
    document.getElementById('mlProductStatus').textContent = '⏳ 采集中...';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { document.getElementById('mlProductStatus').textContent = '❌ 无活动标签页'; return; }

    try {
        // 检查是否ML页面
        if (!tab.url.includes('mercadolibre')) {
            document.getElementById('mlProductStatus').textContent = '❌ 当前不是ML商品页';
            return;
        }
        // 方法1: executeScript注入
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/inject_scraper.js'],
        });
        document.getElementById('mlProductStatus').textContent = '⏳ 脚本已注入，发送采集指令...';

        // 发送采集指令
        chrome.tabs.sendMessage(tab.id, { action: 'scrape_ml' }, resp => {
            if (resp && resp.ml_item_id) {
                currentMLProduct = resp;
                document.getElementById('mlProductStatus').textContent = '✅ 采集成功: ' + (resp.title||'').slice(0,25);
                document.getElementById('mlProductDetail').style.display = 'block';
                document.getElementById('mlProductDetail').innerHTML =
                    '<div style="font-size:12px;color:#e0e0e0">' +
                    '<div style="font-weight:600;margin-bottom:4px">' + (resp.title||'').slice(0,50) + '</div>' +
                    '<div>💰 ' + (resp.currency||'MXN') + ' ' + (resp.price||0) + '</div>' +
                    '<div>🔗 ' + resp.ml_item_id + '</div>' +
                    '</div>';
                // 同步到后端
                chrome.runtime.sendMessage({ action: 'ml_product_scraped', data: resp }).catch(()=>{});
            } else {
                document.getElementById('mlProductStatus').textContent = '❌ 采集失败，无数据返回';
            }
        });
    } catch(e) {
        document.getElementById('mlProductStatus').textContent = '❌ 错误: ' + e.message;
    }
}

// 读取缓存
chrome.storage.local.get(['last_ml_product', 'ml_product_timestamp'], d => {
    if (d.last_ml_product && Date.now() - (d.ml_product_timestamp || 0) < 120000) {
        currentMLProduct = d.last_ml_product;
        document.getElementById('mlProductStatus').textContent = '📦 缓存: ' + (d.last_ml_product.title||'').slice(0,25);
    }
});
