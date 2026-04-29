// ═══ 大帅比专用 v5 — 1688 扒取引擎 ═══
// 特性: MutationObserver · JS数据提取 · 智能重试 · 7层重量提取
(function () {
  'use strict';

  const LOG_PREFIX = '[大帅比]';
  const MAX_RETRIES = 5;
  let scrapeAttempts = 0;
  let observer = null;

  // ─── 日志 ──────────────────────────────────────
  function log(msg) { console.log(LOG_PREFIX, msg); }
  function warn(msg) { console.warn(LOG_PREFIX, msg); }

  // ─── 是否1688详情页 ─────────────────────────────
  function isDetailPage() {
    return /detail\.1688\.com\/offer\/\d+\.html/.test(window.location.href);
  }

  // ─── 延迟 ──────────────────────────────────────
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── 主扒取 ──────────────────────────────────────
  function scrapeAll() {
    try {
      const html = document.documentElement.outerHTML;
      const itemId = (window.location.href.match(/offer\/(\d+)\.html/) || [])[1] || '';

      const title = extractTitle();
      const priceInfo = extractPrice();
      const images = extractImages();
      const weight = extractWeight();
      const specs = extractSpecs();
      const seller = extractSeller();
      const salesCount = extractSales();
      const skus = extractSKUs();
      const shipping = extractShipping();
      const domShip = extractDomesticShipping();
      // 判断是否多款产品（有skuMap且>1个SKU）
      const hasMultiSkus = (() => {
        try {
          const d = extractJSONData();
          if (!d) return false;
          const count = (d.skuMap ? Object.keys(d.skuMap).length : 0)
                      + (d.skuPriceInfo?.skuPriceList?.length || 0)
                      + (d.skuList?.length || 0);
          return count > 2; // 超过2条算多款
        } catch(e) { return false; }
      })();

      return {
        item_id: itemId,
        title: title || document.title.replace(/-1688/, '').trim(),
        price_min: priceInfo.min,
        price_max: priceInfo.max,
        price_text: priceInfo.text,
        images: images,
        weight: weight,
        specs: specs,
        seller_name: seller.name,
        seller_url: seller.url,
        sales_count: salesCount,
        skus: skus,
        shipping_info: shipping,
        shipping_fee: domShip,
        has_multiple_skus: hasMultiSkus,
        url: window.location.href,
        scraped_at: new Date().toISOString(),
      };
    } catch (e) {
      warn('Scrape error:', e);
      return null;
    }
  }

  // ─── 标题 ──────────────────────────────────────
  function extractTitle() {
    // Priority: meta OG → common selectors → h1 → document title
    const og = document.querySelector('meta[property="og:title"]');
    if (og) {
      const t = og.getAttribute('content');
      if (t && t.trim().length > 5) return t.trim();
    }
    const sels = [
      '.detail-title', '.mod-detail-title', 'h1.title',
      '[class*="title"] h1', '.tb-main-title', 'h1',
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) {
        const t = el.textContent.trim();
        if (t.length > 5) return t;
      }
    }
    return null;
  }

  // ─── 获取当前选中SKU的价格和重量 ────────────────
  function getActiveSkuInfo(data) {
    if (!data) return null;
    let allSkus = [];

    // 收集所有SKU的 { price, weight }
    // 格式1: skuMap
    if (data.skuMap) {
      for (const key of Object.keys(data.skuMap)) {
        const s = data.skuMap[key];
        const p = s.price ? parseFloat(s.price) : null;
        const w = s.weight ? parseFloat(s.weight) : null;
        if (p || w) allSkus.push({ price: p, weight: w, key });
      }
    }
    // 格式2: skuPriceInfo.skuPriceList (新1688)
    if (data.skuPriceInfo && data.skuPriceInfo.skuPriceList) {
      for (const s of data.skuPriceInfo.skuPriceList) {
        const p = s.price ? parseFloat(s.price) : null;
        const w = s.weight || s.skuWeight || s.packageWeight || s.grossWeight;
        allSkus.push({ price: p, weight: w ? parseFloat(w) : null });
      }
    }
    // 格式3: skuList
    if (data.skuList) {
      for (const s of data.skuList) {
        const p = s.price ? parseFloat(s.price) : null;
        const w = s.weight || s.skuWeight || s.packageWeight;
        allSkus.push({ price: p, weight: w ? parseFloat(w) : null });
      }
    }

    if (allSkus.length === 0) return null;

    // ★ 从DOM读取当前显示的价格（用户点规格后这个价格会变）
    let activePrice = null;
    const activePriceSelectors = [
      '.price-value', '.offer-price', '.detail-price',
      '[class*="offer-price"]', '[data-spm="price"]',
      '.tb-rmb-num', '.sku-price', '.J_TPPrice',
    ];
    for (const sel of activePriceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const raw = el.textContent.replace(/[^0-9.]/g, '');
        const v = parseFloat(raw);
        if (v > 0) { activePrice = v; break; }
      }
    }

    // 找到匹配这个价格的SKU
    if (activePrice) {
      const match = allSkus.find(s => s.price !== null && Math.abs(s.price - activePrice) < 0.01);
      if (match) return match;
    }

    // 没匹配上 → 返回最小价格的那个SKU
    allSkus.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    return allSkus[0];
  }

  // ─── 价格 ──────────────────────────────────────
  function extractPrice() {
    let min = null, max = null, text = '';

    // ★ 优先: 当前选中SKU的价格（用户点哪个规格就取哪个价格）
    try {
      const data = extractJSONData();
      if (data) {
        const active = getActiveSkuInfo(data);
        if (active && active.price !== null && active.price > 0) {
          min = max = active.price;
          text = '¥' + min;
          log(`Active SKU price: ¥${min}`);
          return { min, max, text };
        }
      }
    } catch (e) {}

    // 旧有逻辑兜底: JSON data general price
    try {
      const data = extractJSONData();
      if (data) {
        if (data.offerPrice) {
          min = max = parseFloat(data.offerPrice);
          text = '¥' + min;
          return { min, max, text };
        }
        if (data.price) {
          if (typeof data.price === 'number') { min = max = data.price; text = '¥' + min; return { min, max, text }; }
          if (data.price.minPrice) { min = parseFloat(data.price.minPrice); max = parseFloat(data.price.maxPrice) || min; text = `¥${min}~¥${max}`; return { min, max, text }; }
        }
        if (data.skuPriceInfo && data.skuPriceInfo.skuPriceList) {
          const prices = data.skuPriceInfo.skuPriceList.filter(p => p.price).map(p => parseFloat(p.price));
          if (prices.length) { min = Math.min(...prices); max = Math.max(...prices); text = `¥${min}~¥${max}`; return { min, max, text }; }
        }
      }
    } catch (e) {}

    // DOM / 全文扫描 (同旧逻辑)
    const og = document.querySelector('meta[property="og:product:price"]');
    if (og) {
      const v = parseFloat(og.getAttribute('content'));
      if (v > 0) { min = max = v; text = '¥' + v; return { min, max, text }; }
    }
    const priceSels = [
      '#J_StrPr49828281', '[data-spm="price"]', '.price-value',
      '.offer-price', '.tb-rmb-num', '.price .amount',
      'span.price', '[class*="price"] [class*="num"]',
      '.sku-price', '.J_TPPrice', '[class*="offPrice"]',
      '.detail-price', '.mod-detail-price',
      '[class*="price-container"] [class*="price"]',
      '[class*="offer-price"]',
    ];
    const priceEl = document.querySelector(priceSels.join(','));
    if (priceEl) {
      const raw = priceEl.textContent.replace(/[^0-9.\-~]/g, ' ').trim();
      const nums = raw.match(/[\d.]+/g) || [];
      if (nums.length === 1) { min = max = parseFloat(nums[0]); }
      else if (nums.length >= 2) { min = Math.min(parseFloat(nums[0]), parseFloat(nums[1])); max = Math.max(parseFloat(nums[0]), parseFloat(nums[1])); }
      text = priceEl.textContent.trim();
      if (min > 0) return { min, max, text };
    }
    const body = document.body.innerText;
    const m = body.match(/¥\s*([\d.]+)\s*[-~]\s*¥?\s*([\d.]+)/);
    if (m) { min = Math.min(parseFloat(m[1]), parseFloat(m[2])); max = Math.max(parseFloat(m[1]), parseFloat(m[2])); text = `¥${min} ~ ¥${max}`; return { min, max, text }; }
    const sm = body.match(/¥\s*([\d.]+)/);
    if (sm) { min = max = parseFloat(sm[1]); text = '¥' + min; return { min, max, text }; }
    return { min: null, max: null, text: '' };
  }

  // ─── JSON数据提取 ──────────────────────────────
  function extractJSONData() {
    const scripts = document.querySelectorAll('script');
    const patterns = [
      /window\.data\s*=\s*({.*?});/s,
      /window\.offlineData\s*=\s*({.*?});/s,
      /iDetailData\s*=\s*({.*?});/s,
      /window\.__INITIAL_STATE__\s*=\s*({.*?}});/s,
      /window\.__NUXT__\s*=\s*({.*?}});/s,
      /__rawData__\s*=\s*({.*?});/s,
    ];
    for (const s of scripts) {
      const t = s.textContent || '';
      for (const pat of patterns) {
        const m = t.match(pat);
        if (m) {
          try {
            const data = JSON.parse(m[1]);
            // __INITIAL_STATE__通常嵌套 detailData/offerDetail
            if (data.detailData && (data.detailData.skuMap || data.detailData.skuPriceInfo)) return data.detailData;
            if (data.offerDetail && (data.offerDetail.skuMap || data.offerDetail.skuPriceInfo)) return data.offerDetail;
            if (data.offer && (data.offer.skuMap || data.offer.skuPriceInfo)) return data.offer;
            if (data.initialState && data.initialState.detail) return data.initialState.detail;
            return data;
          } catch (e) { /* try next pattern */ }
        }
      }
    }
    return null;
  }

  // ─── 图片 ──────────────────────────────────────
  function extractImages() {
    const urls = new Set();

    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) urls.add(ogImg.getAttribute('content'));

    // Lazy-loaded images: check data-src, data-lazyload, data-original
    document.querySelectorAll(
      'ul#dt-tab img, .image-list img, .detail-gallery img, ' +
      '[class*="gallery"] img, [class*="preview"] img, ' +
      '.tb-thumb img, .J_Thumb img, .offer-thumb img, ' +
      '[class*="swiper"] img, [class*="slider"] img, ' +
      '[class*="main-img"] img, [class*="detail-img"] img, ' +
      'li[class*="img"] img'
    ).forEach(img => {
      const src = img.getAttribute('data-src') || img.getAttribute('data-lazyload') || img.getAttribute('data-original') || img.src || img.getAttribute('srcset');
      if (src) urls.add(src.startsWith('http') ? src.replace(/\.jpg_.*$/, '.jpg').replace(/_\d+x\d+\./, '.') : 'https:' + src.replace(/\.jpg_.*$/, '.jpg').replace(/_\d+x\d+\./, '.'));
    });

    // 全局扫描 alicdn/taobao/1688 图片
    document.querySelectorAll('img[src*="alicdn"], img[src*="taobao"], img[src*="1688"], img[data-src*="alicdn"]').forEach(img => {
      const src = img.getAttribute('data-src') || img.src;
      if (src) urls.add(src.startsWith('http') ? src : 'https:' + src);
    });

    return Array.from(urls).slice(0, 12);
  }

  // ─── 重量 (7层策略) ────────────────────────────
  // 辅助: 归一化为kg — 1688大部分用g，数值>50必是g
  function normWeight(w, hasKgUnit, hasGUnit) {
    if (w <= 0 || isNaN(w)) return null;
    if (hasGUnit) w /= 1000;
    else if (!hasKgUnit && w > 1) w /= 1000;  // 无kg标记且>1 → 按g算
    if (w > 0 && w < 500) return Math.round(w * 1000) / 1000;
    return null;
  }

  function extractWeight() {
    // 方法1: 从JSON数据提取 — JSON无数据才走DOM全文
    try {
      const data = extractJSONData();
      if (data) {
        let jsonResult = null;

        // ★ 优先: 当前选中SKU的完整信息（价格+重量一致）
        const active = getActiveSkuInfo(data);
        if (active && active.weight !== null && active.weight > 0) {
          const r = normWeight(active.weight, false, false);
          if (r !== null) {
            log(`Active SKU: ¥${active.price} → ${active.weight}g → ${r}kg`);
            return r;
          }
        }

        // 各种重量key
        const weightKeys = [
          'weight', 'itemWeight', 'grossWeight', 'netWeight',
          'productWeight', 'shippingWeight', 'freightWeight',
          'productWeightValue', 'packageWeight', 'singleWeight',
        ];

        // 先扫skuMap取最小重量(更精准)，有SKU时优先用它
        let skuMinWeight = null;
        if (data.skuMap) {
          for (const skuId of Object.keys(data.skuMap)) {
            const sku = data.skuMap[skuId];
            if (sku.weight) {
              const w = parseFloat(sku.weight);
              if (!isNaN(w) && w > 0) {
                if (skuMinWeight === null || w < skuMinWeight) skuMinWeight = w;
              }
            }
          }
        }

        for (const key of weightKeys) {
          if (data[key] !== undefined && data[key] !== null) {
            const w = parseFloat(data[key]);
            if (!isNaN(w) && w > 0) {
              // 有skuMap且weight差异大 → 取sku最小
              if (skuMinWeight !== null && Math.abs(w - skuMinWeight) > 10) {
                jsonResult = normWeight(skuMinWeight, false, false);
              } else {
                jsonResult = normWeight(w, false, false);
              }
              if (jsonResult !== null) return jsonResult;
            }
          }
        }

        // Attributes
        if (data.attributes) {
          for (const attr of data.attributes) {
            if (attr.name && /重量|weight/i.test(attr.name) && attr.value) {
              const m = attr.value.match(/([\d.]+)/);
              if (m) {
                jsonResult = normWeight(parseFloat(m[1]), /kg|千克|公斤/i.test(attr.value), /g|克/.test(attr.value));
                if (jsonResult !== null) return jsonResult;
              }
            }
          }
        }
        // 商品属性 (1688新版)
        if (data.productAttrMap || data.attrMap) {
          const attrMap = data.productAttrMap || data.attrMap || {};
          for (const [k, v] of Object.entries(attrMap)) {
            if (/重量|weight|毛重|净重/i.test(k)) {
              const m = String(v).match(/([\d.]+)/);
              if (m) {
                jsonResult = normWeight(parseFloat(m[1]), /kg|千克|公斤/i.test(v), /g|克/.test(v));
                if (jsonResult !== null) return jsonResult;
              }
            }
          }
        }
        // offerWeight 直接字段
        if (data.offerWeight !== undefined) {
          const w = parseFloat(data.offerWeight);
          if (!isNaN(w) && w > 0) {
            jsonResult = normWeight(w, false, false);
            if (jsonResult !== null) return jsonResult;
          }
        }

        // ★ 关键: 有JSON数据且含skuMap → 用sku最小重量，绝不下放到DOM模糊匹配
        if (skuMinWeight !== null) {
          const r = normWeight(skuMinWeight, false, false);
          if (r !== null) {
            log(`JSON skuMin weight: ${skuMinWeight}g → ${r}kg (skip DOM)`);
            return r;
          }
        }

        // JSON有数据但没找到任何重量字段 → 返回null，但标记不让DOM方法执行
        if (Object.keys(data).length > 0) {
          log('JSON data found but no weight field — using skuMin fallback if available');
          return null; // 让上层处理，不再走DOM
        }
      }
    } catch (e) { warn('JSON extract error:', e); }

    // 方法2: 包装信息区域 TreeWalker
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text === '包装信息' || text === '包装' || text.startsWith('包装信息')) {
          let container = node.parentElement;
          for (let i = 0; i < 5; i++) {
            if (container && container.children.length >= 2) break;
            container = container?.parentElement;
          }
          if (container) {
            const containerText = container.textContent;
            const m = containerText.match(/(重量|毛重|净重|产品重量|单品重量|商品重量|包装重量|单件重量|产品毛重|产品净重)\s*[:：]?\s*([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?/i);
            if (m) {
              const w = parseFloat(m[2]);
              const r = normWeight(w, /kg|千克|公斤|KG/i.test(m[3]||''), /g|克|G/i.test(m[3]||''));
              if (r !== null) return r;
            }
            const rows = container.querySelectorAll('tr, li, div, span, p, dl');
            for (const row of rows) {
              const rt = row.textContent.trim();
              if (/重量/.test(rt)) {
                const m2 = rt.match(/([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?/i);
                if (m2) {
                  const w = parseFloat(m2[1]);
                  const r = normWeight(w, /kg|千克|公斤|KG/i.test(m2[2]||''), /g|克|G/i.test(m2[2]||''));
                  if (r !== null) return r;
                }
              }
            }
          }
          break;
        }
      }
    } catch (e) {}

    // 方法3: 全文扫描包装信息区
    const body = document.body.innerText;
    const pkgMatch = body.match(/包装信息[\s\S]{0,500}(重量|毛重|净重)[\s\S]{0,50}?([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?/i);
    if (pkgMatch) {
      const w = parseFloat(pkgMatch[2]);
      const r = normWeight(w, /kg|千克|公斤|KG/i.test(pkgMatch[3]||''), /g|克|G/i.test(pkgMatch[3]||''));
      if (r !== null) return r;
    }

    // 方法4: 规格表参数
    const specs = extractSpecs();
    for (const [k, v] of Object.entries(specs)) {
      if (/重量|毛重|净重|产品重量|单品重量|商品重量|包装重量|单件重量/i.test(k)) {
        const m = v.match(/([\d.]+)\s*(kg|k g|KG|g|G|克|千克|公斤)?/);
        if (m) {
          const w = parseFloat(m[1]);
          const r = normWeight(w, /kg|千克|公斤|KG/i.test(m[2]||''), /g|克|G/i.test(m[2]||''));
          if (r !== null) return r;
        }
      }
    }

    // 方法5: 所有行元素扫描
    const rows = document.querySelectorAll('tr, li, .param-item, .prop-item, [class*="attr"], [class*="param"], [class*="specification"], [class*="property"], [class*="attribute"]');
    for (const row of rows) {
      const text = row.textContent.trim();
      const keyMatch = text.match(/(重量|毛重|净重|产品重量|单品重量|商品重量|包装重量|单件重量|产品毛重|产品净重)\s*[:：]?\s*([\d.]+)\s*(kg|k g|KG|g|G|克|千克|公斤)?/i);
      if (keyMatch) {
        const w = parseFloat(keyMatch[2]);
        const r = normWeight(w, /kg|千克|公斤|KG/i.test(keyMatch[3]||''), /g|克|G/i.test(keyMatch[3]||''));
        if (r !== null) return r;
      }
    }

    // 方法6: 运费模板里的首重/续重
    const freightText = extractShipping();
    if (freightText) {
      const m = freightText.match(/首重[:：]?\s*([\d.]+)\s*(kg|千克|公斤)?/i);
      if (m) {
        const w = parseFloat(m[1]);
        // 首重一般是kg单位，不做g假设
        if (w > 0 && w < 500) return Math.round(w * 1000) / 1000;
      }
    }

    // 方法7: 全文本多模式
    const patterns = [
      [/包装信息[\s\S]{0,300}重量[：:]\s*([\d.]+)\s*(kg|k\s*g|千克|公斤|g|克)?/i, 1, 2],
      [/([\d.]+)\s*(kg|k\s*g|千克|公斤)/i, 1, 2],
      [/重量[：:]\s*([\d.]+)\s*(kg|k\s*g|千克|公斤|g|克)?/i, 1, 2],
      [/毛重[：:]\s*([\d.]+)\s*(kg|k\s*g|千克|公斤|g|克)?/i, 1, 2],
      [/净重[：:]\s*([\d.]+)\s*(kg|k\s*g|千克|公斤|g|克)?/i, 1, 2],
      [/产品重量[：:]\s*([\d.]+)\s*(kg|k\s*g|千克|公斤|g|克)?/i, 1, 2],
      [/([\d.]+)\s*(克|g)\s*[（(]?约?[)）]?/i, 1, 2],
      [/约\s*([\d.]+)\s*(kg|千克|公斤)/i, 1, 2],
      [/每件[约]?\s*([\d.]+)\s*(kg|千克|公斤|g|克)/i, 1, 2],
      [/单品[约]?\s*([\d.]+)\s*(kg|千克|公斤|g|克)/i, 1, 2],
      [/单个\s*([\d.]+)\s*(kg|千克|公斤|g|克)/i, 1, 2],
    ];
    for (const [pat, valIdx, unitIdx] of patterns) {
      const m = body.match(pat);
      if (m) {
        const w = parseFloat(m[valIdx]);
        if (!isNaN(w) && w > 0) {
          const r = normWeight(w, /kg|千克|公斤|KG/i.test(m[unitIdx]||''), /g|克|G/i.test(m[unitIdx]||''));
          if (r !== null) return r;
        }
      }
    }

    return null;
  }

  // ─── 规格参数 ──────────────────────────────────
  function extractSpecs() {
    const specs = {};

    // JSON data
    try {
      const data = extractJSONData();
      if (data) {
        if (data.attributes) {
          data.attributes.forEach(attr => {
            if (attr.name && attr.value) specs[attr.name] = attr.value;
          });
        }
        if (data.skuPriceInfo && data.skuPriceInfo.skuValList) {
          data.skuPriceInfo.skuValList.forEach(sku => {
            if (sku.specAttrValue) specs[sku.specAttrValue] = sku.price || '';
          });
        }
        // 长宽高 from JSON
        const dimKeys = ['length', 'width', 'height', 'size', 'dimensions', 'packageSize', 'productSize', 'volume'];
        for (const dk of dimKeys) {
          if (data[dk] !== undefined && data[dk] !== null) specs[dk] = String(data[dk]);
        }
      }
    } catch (e) {}

    // DOM
    document.querySelectorAll(
      'table.sku-table tr, .param-item, .prop-item, ' +
      'li.attribute-item, .mod-detail-attr li, ' +
      '[class*="param"] tr, .detail-attr-item, ' +
      '[class*="specification"] tr'
    ).forEach(row => {
      const key = (row.querySelector('th, .param-name, .prop-title, label, dt') || {}).textContent || '';
      const val = (row.querySelector('td, .param-value, .prop-desc, span, dd') || {}).textContent || '';
      if (key.trim() && val.trim() && !specs[key.trim()]) specs[key.trim()] = val.trim();
    });

    // 从全文中提长宽高（如无专门规格字段）
    if (!specs['长'] && !specs['长度'] && !specs['length']) {
      const body = document.body.innerText;
      const dimMatch = body.match(/(\d+)\s*[×xX*]\s*(\d+)\s*[×xX*]\s*(\d+)\s*(cm|毫米|mm|厘米)?/i);
      if (dimMatch) {
        specs['长'] = dimMatch[1] + (dimMatch[4] || '');
        specs['宽'] = dimMatch[2] + (dimMatch[4] || '');
        specs['高'] = dimMatch[3] + (dimMatch[4] || '');
        specs['_dim_raw'] = dimMatch[0].trim();
      }
    }

    return specs;
  }

  // ─── 店铺 ──────────────────────────────────────
  function extractSeller() {
    const sel = document.querySelector(
      'a.shop-name, .company-name a, [class*="shop"] a, ' +
      '.mod-shop a, .seller-name a, .J_ShopName a, ' +
      '[class*="supplier"] a, [class*="store"] a'
    );
    if (sel) return { name: (sel.textContent || '').trim(), url: sel.href || '' };
    const og = document.querySelector('meta[property="og:site_name"]');
    if (og) return { name: og.getAttribute('content') || '', url: '' };
    return { name: '', url: '' };
  }

  // ─── 销量 ──────────────────────────────────────
  function extractSales() {
    const el = document.querySelector(
      '[class*="sale"], [class*="deal"], [class*="order"], ' +
      '[class*="trade"], .sale-count, .deal-count, ' +
      '#J_SaleCount, .J_SaleCount, [class*="sold"]'
    );
    if (el) {
      const m = el.textContent.match(/([\d,]+)/);
      if (m) return parseInt(m[1].replace(/,/g, ''));
    }
    const body = document.body.innerText;
    const m = body.match(/(\d[\d,]*)\s*(笔已售|人付款|已售|成交)/);
    if (m) return parseInt(m[1].replace(/,/g, ''));
    return 0;
  }

  // ─── SKU ───────────────────────────────────────
  function extractSKUs() {
    const skus = [];
    try {
      document.querySelectorAll('.sku-item, [class*="sku"] li, .prop-unit, [class*="spec-value"], [class*="attr-value"]').forEach(el => {
        const name = el.getAttribute('data-value') || el.textContent.trim();
        if (name && name.length < 30) skus.push(name);
      });
    } catch (e) {}
    return skus;
  }

  // ─── 货运 ──────────────────────────────────────
  function extractShipping() {
    const el = document.querySelector(
      '[class*="freight"], [class*="shipping"], ' +
      '#J_Freight, .freight-info, .post-info, ' +
      '[class*="logistics"], [class*="delivery"]'
    );
    return el ? el.textContent.trim().slice(0, 80) : '';
  }

  // ─── 国内运费 ──────────────────────────────────
  function extractDomesticShipping() {
    // 1688头部区域常见格式: 运费 ¥5.00 或 ¥5.00 起 或 快递 ¥6.00
    const freightEls = document.querySelectorAll(
      '[class*="freight"], [class*="shipping"], [class*="postage"], ' +
      '#J_Freight, .freight-info, .post-info, ' +
      '[class*="delivery-fee"], [class*="logistics-cost"], ' +
      '[class*="express-fee"], [class*="post-fee"], ' +
      '[class*="logistics-fee"], [class*="transport"]'
    );
    for (const el of freightEls) {
      const text = el.textContent.trim();
      const m = text.match(/[¥￥]?\s*([\d.]+)\s*(元|起|运费)?/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v > 0) return v;
      }
    }
    const body = document.body.innerText;
    const pats = [
      /运费[：:]\s*[¥￥]?\s*([\d.]+)\s*(元|起)?/i,
      /[¥￥]\s*([\d.]+)\s*(元|运费|起)/i,
      /配送[费]?[：:]\s*[¥￥]?\s*([\d.]+)/i,
      /快递[：:]\s*[¥￥]?\s*([\d.]+)(\s*元)?/i,
      /物流[：:]\s*[¥￥]?\s*([\d.]+)/i,
      /运费[：:]?\s*[¥￥]?\s*([\d.]+)/i,
      /[¥￥]\s*([\d.]+)\s*运费/i,
    ];
    for (const pat of pats) {
      const m = body.match(pat);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v > 0) return v;
      }
    }
    return null;
  }

  // ─── 检查是否需要重试 ──────────────────────────
  function needsRetry(data) {
    if (!data) return true;
    // 重量缺失是最常见问题 → 重试
    if (!data.weight && scrapeAttempts < MAX_RETRIES) return true;
    // 价格缺失也重试
    if (!data.price_min && scrapeAttempts < MAX_RETRIES) return true;
    return false;
  }

  // ─── 带重试的扒取循环 ──────────────────────────
  function scrapeWithRetry() {
    if (!isDetailPage()) return;
    scrapeAttempts++;

    const data = scrapeAll();
    log(`Attempt ${scrapeAttempts}/${MAX_RETRIES} — ${data ? 'OK' : 'FAIL'} weight=${data?.weight || '?'} price=${data?.price_min || '?'}`);

    if (data && data.item_id) {
      // 发送到 background 保存
      chrome.runtime.sendMessage({ action: 'auto_scraped', data }).catch(() => {});
      chrome.runtime.sendMessage({ action: 'product_ready', data }).catch(() => {});
    }

    if (needsRetry(data)) {
      const delay = Math.min(2000 * Math.pow(1.5, scrapeAttempts - 1), 8000);
      log(`Retrying in ${delay}ms...`);
      setTimeout(scrapeWithRetry, delay);
    } else {
      log(`Scrape complete after ${scrapeAttempts} attempts`);
    }
  }

  // ─── MutationObserver: 监听DOM变化，有新元素时触发 ──
  function setupMutationObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      // 有新的子元素被添加 → 可能动态内容加载了
      const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
      if (hasNewNodes && scrapeAttempts === 0) {
        // 首次发现新元素时触发扒取
        setTimeout(() => {
          if (scrapeAttempts === 0) scrapeWithRetry();
        }, 1000);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ─── 消息监听 ──────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrape1688') {
      const data = scrapeAll();
      sendResponse(data || { error: 'scrape_failed' });
      return true;
    }
  });

  // ─── 启动 ──────────────────────────────────────
  function start() {
    if (!isDetailPage()) {
      log('Not a 1688 detail page, skipping');
      return;
    }
    log('Initializing on 1688 detail page');

    setupMutationObserver();

    if (document.readyState === 'complete') {
      setTimeout(scrapeWithRetry, 1500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(scrapeWithRetry, 1500);
      });
    }
  }

  start();
})();
