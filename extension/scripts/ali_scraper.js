/* 1688产品数据采集 */
(function() {
    'use strict';

    function extractJSONData() {
        const scripts = document.querySelectorAll('script');
        const patterns = [
            /window\.data\s*=\s*({.*?});/s,
            /window\.offlineData\s*=\s*({.*?});/s,
            /iDetailData\s*=\s*({.*?});/s,
            /window\.__INITIAL_STATE__\s*=\s*({.*?}});/s,
        ];
        for (const s of scripts) {
            const t = s.textContent || '';
            for (const pat of patterns) {
                const m = t.match(pat);
                if (m) {
                    try {
                        let data = JSON.parse(m[1]);
                        if (data.detailData) data = data.detailData;
                        if (data.offerDetail) data = data.offerDetail;
                        if (data.offer) data = data.offer;
                        return data;
                    } catch(e) {}
                }
            }
        }
        return null;
    }

    function extractTitle() {
        const meta = document.querySelector('meta[property="og:title"]');
        if (meta) return meta.getAttribute('content');
        const h1 = document.querySelector('h1');
        if (h1) return h1.textContent.trim();
        return document.title;
    }

    function extractPrice() {
        const meta = document.querySelector('meta[property="og:product:price"]');
        if (meta) { const v = parseFloat(meta.content); if (v > 0) return v; }
        const priceEl = document.querySelector('.price-value, .offer-price, .tb-rmb-num, span.price');
        if (priceEl) {
            const v = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
            if (v > 0) return v;
        }
        const body = document.body.innerText;
        const m = body.match(/¥\s*([\d.]+)/);
        return m ? parseFloat(m[1]) : null;
    }

    function extractWeight() {
        // Try JSON first
        const data = extractJSONData();
        if (data) {
            const keys = ['weight', 'itemWeight', 'grossWeight', 'netWeight', 'productWeight', 'singleWeight'];
            for (const k of keys) {
                if (data[k] !== undefined) {
                    const w = parseFloat(data[k]);
                    if (!isNaN(w) && w > 0) {
                        // 1688 uses grams
                        const kg = w > 1 ? w / 1000 : w;
                        if (kg > 0 && kg < 500) return Math.round(kg * 1000) / 1000;
                    }
                }
            }
        }
        // DOM fallback
        const body = document.body.innerText;
        const m = body.match(/([\d.]+)\s*(kg|千克|公斤|g|克)/i);
        if (m) {
            let w = parseFloat(m[1]);
            if (m[2].toLowerCase() === 'g' || m[2] === '克') w /= 1000;
            if (w > 0 && w < 500) return Math.round(w * 1000) / 1000;
        }
        return null;
    }

    function extractImages() {
        const urls = new Set();
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) urls.add(ogImg.content);
        document.querySelectorAll('img[src*="alicdn"], img[src*="taobao"], img[src*="1688"]')
            .forEach(img => { if (img.src && !urls.has(img.src)) urls.add(img.src); });
        return Array.from(urls).slice(0, 12);
    }

    if (location.href.includes('detail.1688.com/offer/')) {
        setTimeout(() => {
            const data = {
                title: extractTitle(),
                price_min: extractPrice(),
                weight_kg: extractWeight(),
                images: JSON.stringify(extractImages()),
                url: location.href,
            };
            if (data.title && data.price_min) {
                chrome.runtime.sendMessage({ action: 'ali_product_scraped', data }).catch(() => {});
            }
        }, 2000);
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrape_ali') {
            sendResponse({
                title: extractTitle(),
                price_min: extractPrice(),
                weight_kg: extractWeight(),
                images: JSON.stringify(extractImages()),
                url: location.href,
            });
            return true;
        }
    });
})();
