// Scrape 1688 product detail page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'scrape1688') {
    try {
      // Try common price selectors
      const priceEl = document.querySelector('.price-value, .offer-price, .detail-price, [class*="price"], .price')
        || document.querySelector('meta[name="price"]');
      const weightEl = document.querySelector('.weight, [class*="weight"], .sku-attribute')
        || document.querySelector('meta[name="weight"]');

      let price = priceEl
        ? parseFloat((priceEl.tagName === 'META' ? priceEl.content : priceEl.textContent).replace(/[^0-9.]/g, ''))
        : null;
      let weight = weightEl
        ? parseFloat((weightEl.tagName === 'META' ? weightEl.content : weightEl.textContent).replace(/[^0-9.]/g, ''))
        : null;

      // Fallback: extract from JSON-LD
      if (!price) {
        const ld = document.querySelector('script[type="application/ld+json"]');
        if (ld) {
          try {
            const data = JSON.parse(ld.textContent);
            price = data.offers?.price || data.price;
            weight = data.weight?.value || (/\d+\.?\d*/.exec(data.description || ''))?.[0];
          } catch {}
        }
      }

      sendResponse({
        price: price ? Number(price.toFixed(2)) : null,
        weight: weight ? Number(weight.toFixed(2)) : null,
        title: document.title?.replace(/[_-]/g, ' ').trim() || ''
      });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true; // keep channel open
  }
});
