/* ML Scraper v2 - 多fallback选择器 */
(function() {
    'use strict';

    const SITE_CURRENCY = {MLM:"MXN",MLB:"BRL",MLC:"CLP",MCO:"COP",MLA:"ARS",MLU:"UYU"};

    function getPageType() {
        const url = window.location.href;
        if (/(ML[A-Z]{2}-\d+)/.test(url)) return 'detail';
        if (/\/listado\/|\/results|\/navegacion/.test(url)) return 'search';
        return 'unknown';
    }

    function extractItemId() {
        const m = window.location.href.match(/(ML[A-Z]{2}-\d+)/);
        return m ? m[1] : null;
    }

    function extractSiteId() {
        const url = window.location.href;
        if (url.includes('.com.mx')) return 'MLM';
        if (url.includes('.com.br')) return 'MLB';
        if (url.includes('.cl')) return 'MLC';
        if (url.includes('.com.co')) return 'MCO';
        if (url.includes('.com.ar')) return 'MLA';
        if (url.includes('.com.uy')) return 'MLU';
        return 'MLM';
    }

    function qs(selectors) {
        for (const s of selectors) {
            const el = document.querySelector(s);
            if (el) return el;
        }
        return null;
    }

    function qsa(selectors) {
        for (const s of selectors) {
            const els = document.querySelectorAll(s);
            if (els.length > 0) return els;
        }
        return [];
    }

    function extractTitle() {
        const el = qs([
            'h1.ui-pdp-title',
            'h1[class*="title"]',
            '.ui-pdp-header__title',
            'h1[class*="item-title"]',
            'meta[property="og:title"]',
            'h1'
        ]);
        if (el) {
            if (el.tagName === 'META') return el.getAttribute('content')?.trim();
            return el.textContent?.trim();
        }
        return document.title;
    }

    function extractPrice() {
        const el = qs([
            '.andes-money-amount__fraction',
            '.ui-pdp-price__second-line .andes-money-amount__fraction',
            '[class*="price"] [class*="fraction"]',
            '.ui-pdp-price .andes-money-amount__fraction',
            'meta[property="product:price:amount"]',
            '[data-testid="price-value"]',
            '[class*="price-tag-fraction"]'
        ]);
        if (el) {
            if (el.tagName === 'META') return parseFloat(el.getAttribute('content')) || 0;
            return parseFloat(el.textContent.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        }
        // Fallback: parse from body text
        const m = document.body.innerText.match(/[$]\s*([\d.,]+)/);
        return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : 0;
    }

    function extractCurrency() {
        const el = qs([
            '.andes-money-amount__currency-symbol',
            '[class*="currency-symbol"]',
            'meta[property="product:price:currency"]'
        ]);
        if (el) {
            if (el.tagName === 'META') return el.getAttribute('content')?.trim() || 'MXN';
            return el.textContent?.trim() || 'MXN';
        }
        return SITE_CURRENCY[extractSiteId()] || 'MXN';
    }

    function extractSales() {
        const el = qs([
            '.ui-pdp-subtitle',
            '[class*="sales"]',
            '[class*="ventas"]',
            '[class*="vendidos"]',
            '[class*="sold"]'
        ]);
        if (el) {
            const m = el.textContent.match(/([\d.,]+)\s*(vendidos|ventas|sold|vendas)/i);
            if (m) return parseInt(m[1].replace(/[^0-9]/g, '')) || 0;
        }
        // Fallback body text
        const m = document.body.innerText.match(/(\d[\d.,]*)\s*(vendidos|ventas|sold|vendas)/i);
        return m ? parseInt(m[1].replace(/[^0-9]/g, '')) : 0;
    }

    function extractImages() {
        const urls = new Set();
        // Try gallery images
        qsa([
            '.ui-pdp-gallery__figure img',
            '[class*="gallery"] img',
            'figure img',
            '.ui-pdp-image img',
            '[class*="image-gallery"] img'
        ]).forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src && src.includes('http')) urls.add(src);
        });
        // Try OG image
        const og = document.querySelector('meta[property="og:image"]');
        if (og) urls.add(og.content);
        // ML images to HQ
        return Array.from(urls).slice(0, 10).map(u => 
            u.replace(/\/I\//, '/O/').replace(/w=\d+/, 'w=1600').replace(/h=\d+/, 'h=1600')
        );
    }

    function extractSeller() {
        const el = qs([
            '.ui-pdp-seller__link',
            '[class*="seller"] a',
            '.ui-pdp-seller__info',
            '[class*="seller-info"]'
        ]);
        return el?.textContent?.trim() || '';
    }

    function extractFreeShipping() {
        return !!qs([
            '.ui-pdp-buybox__shipping',
            '[class*="free-shipping"]',
            '[class*="envio-gratis"]',
            '[data-testid="free-shipping"]'
        ]);
    }

    function scrapeDetail() {
        const siteId = extractSiteId();
        const itemId = extractItemId();
        const title = extractTitle();
        const price = extractPrice();
        const currency = extractCurrency();
        const sales = extractSales();
        const images = extractImages();
        const sellerName = extractSeller();
        const freeShipping = extractFreeShipping();

        // Estimate competitor count from search result count in page
        let competitorCount = 0;
        const compM = document.body.innerText.match(/(\d[\d.,]*)\s*(resultados|results)/i);
        if (compM) competitorCount = parseInt(compM[1].replace(/[^0-9]/g, ''));

        // Listed date from JSON-LD
        let listedDate = null;
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
            try {
                const d = JSON.parse(s.textContent);
                if (d.datePublished) { listedDate = d.datePublished; break; }
            } catch(e) {}
        }

        const daysSinceListed = listedDate 
            ? Math.floor((Date.now() - new Date(listedDate).getTime()) / 86400000) 
            : 0;
        const opportunityScore = Math.max(0, Math.round(
            (sales * 0.1 + (30 - Math.min(daysSinceListed, 30)) / 30 * 20 - competitorCount * 0.05) * 10
        ) / 10);

        return {
            ml_item_id: itemId,
            site_id: siteId,
            title: title,
            price: price,
            currency: currency,
            sales_7d: sales,
            total_sales: sales,
            seller_name: sellerName,
            shipping_free: freeShipping,
            competitor_count: competitorCount,
            images: JSON.stringify(images),
            listed_date: listedDate,
            days_since_listed: daysSinceListed,
            opportunity_score: opportunityScore,
        };
    }

    function scrapeSearchResults() {
        const siteId = extractSiteId();
        const defCurrency = SITE_CURRENCY[siteId] || 'MXN';
        const items = [];

        // Try multiple card selectors
        const cards = qsa([
            '.ui-search-layout__item',
            '[class*="poly-card"]',
            '[class*="poly-component"]',
            '.ui-search-result',
            '[class*="search-item"]',
            'li[class*="results-item"]'
        ]);

        cards.forEach(card => {
            function findInCard(selectors) {
                for (const s of selectors) {
                    const el = card.querySelector(s);
                    if (el) return el;
                }
                return null;
            }

            const titleEl = findInCard([
                'a.poly-component__title',
                'h2 a',
                '[class*="title"] a',
                '.ui-search-item__title a'
            ]);
            const priceEl = findInCard([
                '.andes-money-amount__fraction',
                '[class*="price"] [class*="fraction"]'
            ]);
            const linkEl = card.querySelector('a');
            const salesEl = findInCard([
                '[class*="sales"]',
                '[class*="reviews"]',
                '[class*="ventas"]',
                '[class*="vendidos"]'
            ]);

            const title = titleEl?.textContent?.trim() || '';
            const priceText = priceEl?.textContent?.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.') || '0';
            const price = parseFloat(priceText) || 0;
            const link = linkEl?.href || '';
            const itemId = link.match(/(ML[A-Z]{2}-\d+)/)?.[1] || '';
            const sales = salesEl 
                ? parseInt(salesEl.textContent.match(/(\d+)/)?.[1] || '0') 
                : 0;

            if (title && price > 0) {
                items.push({
                    ml_item_id: itemId,
                    site_id: siteId,
                    title: title.slice(0, 200),
                    price: price,
                    currency: defCurrency,
                    sales_7d: sales,
                    total_sales: sales,
                    opportunity_score: Math.round(Math.min(100, sales * 0.15) * 10) / 10,
                });
            }
        });

        return items;
    }

    // Helper: qs/qsa on a specific element
    function qsFor(el, selectors) {
        for (const s of selectors) {
            const found = el.querySelector(s);
            if (found) return found;
        }
        return null;
    }

    // Wait for content to load (up to 10s)
    function waitForContent(callback, maxWait = 10000) {
        const check = () => {
            const title = extractTitle();
            const price = extractPrice();
            if (title && title !== document.title && price > 0) {
                callback();
                return;
            }
            if (Date.now() - start > maxWait) {
                // Try anyway with what we have
                callback();
                return;
            }
            setTimeout(check, 500);
        };
        const start = Date.now();
        setTimeout(check, 500);
    }

    // --- Auto-detect and scrape ---
    const pageType = getPageType();
    if (pageType === 'detail') {
        waitForContent(() => {
            const data = scrapeDetail();
            if (data.ml_item_id) {
                chrome.runtime.sendMessage({ action: 'ml_product_scraped', data }).catch(() => {});
            }
        });
    } else if (pageType === 'search') {
        waitForContent(() => {
            const items = scrapeSearchResults();
            if (items.length > 0) {
                chrome.runtime.sendMessage({ action: 'ml_search_results', data: items }).catch(() => {});
            }
        });
    }

    // Listen for on-demand scrape
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrape_ml') {
            const pageType = getPageType();
            if (pageType === 'detail') {
                sendResponse(scrapeDetail());
            } else if (pageType === 'search') {
                sendResponse({ results: scrapeSearchResults() });
            } else {
                sendResponse({ error: 'unknown_page' });
            }
            return true;
        }
        if (request.action === 'scrape_ml_images') {
            const images = extractImages();
            sendResponse({ images: [...new Set(images)].slice(0, 12) });
            return true;
        }
    });
})();
