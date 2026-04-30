#!/usr/bin/env python3
"""
1688 爬虫模块 v1.0 — 服务端爬取 + 产品管理 + Dashboard UI
支持: URL爬取 · 批量搜索 · 产品收藏 · 一键导入核价
"""

import streamlit as st
import requests, re, json, os, time, base64
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urlparse, parse_qs

# ─── Constants ──────────────────────────────────
PRODUCTS_FILE = "/home/mzls233/.hermes/1688_products.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9"}
TIMEOUT = 15

# ─── Local data persistence ─────────────────────
def _products_path():
    os.makedirs(os.path.dirname(PRODUCTS_FILE), exist_ok=True)
    return PRODUCTS_FILE

def load_products():
    try:
        with open(_products_path()) as f: return json.load(f)
    except: return []

def save_products(products):
    with open(_products_path(), 'w') as f: json.dump(products, f, ensure_ascii=False, indent=2)

# ─── HTML parsing helpers ───────────────────────
def _text(el):
    return el.get_text(strip=True) if el else ""

def _attr(el, key):
    return el.get(key, "") if el else ""

def _first(doc, *sels):
    for s in sels:
        el = doc.select_one(s)
        if el: return el
    return None

# ─── Core scrape: 1688 detail page ──────────────
def scrape_1688(url):
    """Scrape a 1688 product detail page. Returns dict or None.
    Uses Playwright (headless browser) for JS-rendered pages,
    falls back to requests+BS4 if Playwright unavailable."""
    if not url or "1688.com" not in url:
        return None

    item_id = ""
    m = re.search(r'offer/(\d+)', url)
    if m: item_id = m.group(1)

    # Try Playwright first (handles 1688 anti-scrape JS challenges)
    result = _scrape_with_playwright(url, item_id)
    if result and result.get("title"):
        return result

    # Fallback: try with requests
    result = _scrape_with_requests(url, item_id)
    return result

def _scrape_with_playwright(url, item_id):
    """Scrape using Playwright headless browser."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    try:
        with sync_playwright() as p:
            # Use real Chrome UA + stealth args
            chrome_args = [
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
            ]
            browser = p.chromium.launch(
                headless=True,
                args=chrome_args,
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                geolocation={"longitude": 121.4737, "latitude": 31.2304},
                permissions=["geolocation"],
            )
            page = context.new_page()

            # Stealth: remove webdriver traces
            page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                // Override permissions query to hide headless
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
                );
            """)

            # Add cookies for 1688 (empty login, just to appear less suspicious)
            context.add_cookies([{
                "name": "cna",
                "value": "test",
                "domain": ".1688.com",
                "path": "/"
            }])

            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for actual content to load
            try:
                page.wait_for_selector('h1, .detail-title, .mod-detail-title, [class*="title"]', timeout=8000)
            except: pass
            time.sleep(3)

            page_title = page.title()

            # Check if blocked
            if "验证码" in page_title or "拦截" in page_title or "punish" in page.url:
                # Try one more time with different approach
                browser.close()
                return None  # Fall through to requests fallback

            result = {"item_id": item_id, "url": url}

            # Title from page title or DOM
            try:
                h1 = page.query_selector('h1[class*="title"], .mod-detail-title h1, h1.title')
                if h1:
                    result["title"] = h1.inner_text().strip()
                else:
                    result["title"] = re.sub(r'-1688.*', '', page_title).strip() if page_title else ""
            except: result["title"] = ""

            # Price from DOM
            try:
                price_el = page.query_selector(
                    '[data-spm="price"], .price-value, .offer-price, '
                    '.tb-rmb-num, .sku-price, .detail-price'
                )
                if price_el:
                    raw = re.sub(r'[^0-9.\-~]', ' ', price_el.inner_text()).strip()
                    nums = re.findall(r'[\d.]+', raw)
                    if nums:
                        vals = [float(n) for n in nums if n.replace(".","").isdigit()]
                        if vals:
                            result["price_min"] = min(vals)
                            result["price_max"] = max(vals) if len(vals) > 1 else min(vals)
                            result["price_text"] = f"¥{result['price_min']}" if result['price_min'] == result['price_max'] else f"¥{result['price_min']}~¥{result['price_max']}"
            except: pass

            # Weight
            result["weight"] = _extract_weight_from_page(page, html)

            # Images
            result["images"] = _extract_images_playwright(page)
            result["cover"] = result["images"][0] if result.get("images") else ""

            # Seller name
            try:
                seller = page.query_selector('a[class*="seller"], .seller-name a, [class*="shop"] a')
                result["seller_name"] = seller.inner_text().strip() if seller else ""
            except: result["seller_name"] = ""

            # Specs from page
            result["specs"] = _extract_specs_from_page(page)

            # Sales
            result["sales"] = 0
            body_text = page.inner_text("body")
            m = re.search(r'(\d[\d,]*)\s*件已成交|成交[\(（](\d[\d,]*)', body_text)
            if m: result["sales"] = int((m.group(1) or m.group(2)).replace(",", ""))
            else: result["sales"] = 0

            result["skus"] = []
            result["sku_count"] = 0
            result["scraped_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")

            browser.close()
            return result

    except Exception as e:
        return {"error": str(e)[:100], "item_id": item_id}

def _extract_weight_from_page(page, html):
    """Extract weight using Playwright page methods."""
    # Primary: try specific selectors
    try:
        weight_el = page.query_selector('[class*="weight"], .param-item:has-text("重量")')
        if weight_el:
            t = weight_el.inner_text()
            m = re.search(r'([\d.]+)\s*(kg|千克|公斤|g|克)?', t)
            if m:
                w = float(m.group(1))
                unit = m.group(2) or ""
                if 'g' in unit.lower() and 'kg' not in unit.lower():
                    w = w / 1000
                elif not unit and w > 1:
                    w = w / 1000
                if 0 < w < 500: return round(w, 3)
    except: pass

    # Fallback: scan all text
    body = page.inner_text("body") if page else html
    patterns = [
        (r'重量[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'毛重[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'净重[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'产品重量[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'包装信息[\s\S]{0,300}(?:重量|毛重|净重)[\s\S]{0,50}?([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?', 1, 2),
    ]
    for pat, vi, ui in patterns:
        m = re.search(pat, body, re.I)
        if m:
            w = float(m.group(vi))
            unit = m.group(ui) or ""
            if 'g' in unit.lower() and 'kg' not in unit.lower():
                w = w / 1000
            elif not unit and w > 1:
                w = w / 1000
            if 0 < w < 500: return round(w, 3)
    return None

def _extract_images_playwright(page):
    """Extract images using Playwright."""
    urls = set()
    try:
        imgs = page.query_selector_all(
            'ul#dt-tab img, .image-list img, .detail-gallery img, '
            '[class*="gallery"] img, [class*="preview"] img, '
            '.tb-thumb img, .J_Thumb img, .offer-thumb img, '
            '[class*="swiper"] img, [class*="main-img"] img'
        )
        for img in imgs:
            src = (img.get_attribute("data-src") or img.get_attribute("data-lazyload")
                   or img.get_attribute("data-original") or img.get_attribute("src"))
            if src:
                if not src.startswith("http"): src = "https:" + src
                src = re.sub(r'\.jpg_.*$', '.jpg', src)
                src = re.sub(r'_\d+x\d+\.', '.', src)
                urls.add(src)
    except: pass
    return list(urls)

def _extract_specs_from_page(page):
    """Extract product specs using Playwright."""
    specs = {}
    try:
        rows = page.query_selector_all(
            'table.param-table tr, table.attributes tr, '
            '[class*="param"] tr, [class*="attr"] tr, '
            '[class*="param"] li, [class*="attr"] li'
        )
        for row in rows:
            t = row.inner_text().strip()
            if '：' in t or ':' in t:
                parts = re.split(r'[：:]', t, 1)
                if len(parts) == 2 and parts[0] and parts[1]:
                    specs[parts[0].strip()] = parts[1].strip()
    except: pass
    return specs

# ─── JSON data extraction ───────────────────────
def _extract_json_data(soup):
    patterns = [
        r'window\.data\s*=\s*({.*?});',
        r'window\.offlineData\s*=\s*({.*?});',
        r'iDetailData\s*=\s*({.*?});',
        r'window\.__INITIAL_STATE__\s*=\s*({.*?}});',
        r'window\.__NUXT__\s*=\s*({.*?}});',
        r'__rawData__\s*=\s*({.*?});',
    ]
    for script in soup.select('script'):
        t = script.string or ""
        for pat in patterns:
            m = re.search(pat, t, re.DOTALL)
            if m:
                try:
                    data = json.loads(m.group(1))
                    if isinstance(data, dict):
                        # Unwrap common nests
                        for key in ['detailData', 'offerDetail', 'offer', 'data']:
                            if key in data and isinstance(data[key], dict):
                                return data[key]
                        return data
                except: continue
    return None

def _parse_price_from_json(data):
    # Check specific price keys
    for key in ['offerPrice', 'price']:
        v = data.get(key)
        if isinstance(v, (int, float)) and v > 0:
            return v, v
        if isinstance(v, dict):
            if v.get('minPrice'):
                return float(v['minPrice']), float(v.get('maxPrice', v['minPrice']))
    # SKU prices
    sku_prices = []
    if data.get('skuPriceInfo') and data['skuPriceInfo'].get('skuPriceList'):
        for s in data['skuPriceInfo']['skuPriceList']:
            if s.get('price'):
                try: sku_prices.append(float(s['price']))
                except: pass
    if data.get('skuMap'):
        for k, s in data['skuMap'].items():
            if s.get('price'):
                try: sku_prices.append(float(s['price']))
                except: pass
    if data.get('skuList'):
        for s in data['skuList']:
            if s.get('price'):
                try: sku_prices.append(float(s['price']))
                except: pass
    if sku_prices:
        return min(sku_prices), max(sku_prices)
    return None, None

def _parse_price_from_dom(soup, html):
    # OG meta
    og = soup.select_one('meta[property="og:product:price"]')
    if og:
        try: v = float(_attr(og, 'content')); return v, v
        except: pass
    # Common selectors
    el = _first(soup,
        '#J_StrPr49828281', '[data-spm="price"]', '.price-value',
        '.offer-price', '.tb-rmb-num', '.price .amount',
        '.sku-price', '.J_TPPrice', '[class*="offPrice"]',
        '.detail-price', '.mod-detail-price',
    )
    if el:
        raw = re.sub(r'[^0-9.\-~]', ' ', el.get_text()).strip()
        nums = re.findall(r'[\d.]+', raw)
        if nums:
            vals = [float(n) for n in nums if n.replace('.','').isdigit()]
            if vals:
                return min(vals), max(vals) if len(vals) > 1 else (vals[0], vals[0])
    # Full text fallback
    body = soup.get_text()
    m = re.search(r'¥\s*([\d.]+)\s*[-~]\s*¥?\s*([\d.]+)', body)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r'¥\s*([\d.]+)', body)
    if m:
        v = float(m.group(1))
        return v, v
    return None, None

def _parse_weight_from_json(data):
    def norm(w, unit):
        if not w or w <= 0: return None
        if unit and 'g' in unit.lower() and 'kg' not in unit.lower():
            w = w / 1000
        elif not unit and w > 1:
            w = w / 1000
        if 0 < w < 500: return round(w, 3)
        return None

    # Try sku weights first
    weights = []
    if data.get('skuMap'):
        for k, s in data['skuMap'].items():
            if s.get('weight'):
                try: weights.append(float(s['weight']))
                except: pass
    if data.get('skuPriceInfo') and data['skuPriceInfo'].get('skuPriceList'):
        for s in data['skuPriceInfo']['skuPriceList']:
            for wk in ['weight', 'skuWeight', 'packageWeight', 'grossWeight']:
                if s.get(wk):
                    try: weights.append(float(s[wk]))
                    except: pass
    if weights:
        return norm(min(weights), 'g')

    for key in ['weight', 'itemWeight', 'grossWeight', 'netWeight',
                'productWeight', 'shippingWeight', 'packageWeight',
                'singleWeight', 'offerWeight']:
        v = data.get(key)
        if v:
            try:
                w = float(v)
                if w > 0: return norm(w, 'g')
            except: pass

    # Attributes
    if data.get('attributes'):
        for attr in data['attributes']:
            if attr.get('name') and re.search(r'重量|weight', attr['name'], re.I):
                m = re.search(r'([\d.]+)', attr.get('value', ''))
                if m:
                    return norm(float(m.group(1)),
                               'kg' if re.search(r'kg|千克|公斤', attr.get('value',''), re.I) else 'g')
    return None

def _parse_weight_from_dom(soup, html):
    def norm(w, unit):
        if not w or w <= 0: return None
        if unit and 'g' in unit.lower() and 'kg' not in unit.lower():
            w = w / 1000
        elif not unit and w > 1:
            w = w / 1000
        if 0 < w < 500: return round(w, 3)
        return None

    body = soup.get_text()
    # Method 1: 包装信息 area
    m = re.search(r'包装信息[\s\S]{0,500}(?:重量|毛重|净重|产品重量|单品重量|商品重量|包装重量|单件重量|产品毛重|产品净重)[\s\S]{0,50}?([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?', body, re.I)
    if m:
        w = float(m.group(1))
        return norm(w, m.group(2) or '')

    # Method 2: 规格表
    specs = _extract_specs(soup)
    for k, v in specs.items():
        if re.search(r'重量|毛重|净重|产品重量|单品重量|商品重量|包装重量|单件重量|产品毛重|产品净重', k):
            m = re.search(r'([\d.]+)\s*(kg|k\s*g|KG|g|G|克|千克|公斤)?', str(v))
            if m:
                return norm(float(m.group(1)), m.group(2) or '')

    # Method 3: full text patterns
    patterns = [
        (r'([\d.]+)\s*(kg|千克|公斤)', 1, 2),
        (r'包装信息[\s\S]{0,300}重量[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'重量[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'毛重[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'产品重量[：:]\s*([\d.]+)\s*(kg|千克|公斤|g|克)?', 1, 2),
        (r'每件[约]?\s*([\d.]+)\s*(kg|千克|公斤|g|克)', 1, 2),
        (r'单品[约]?\s*([\d.]+)\s*(kg|千克|公斤|g|克)', 1, 2),
    ]
    for pat, vi, ui in patterns:
        m = re.search(pat, body, re.I)
        if m:
            return norm(float(m.group(vi)), m.group(ui) or '')

    return None

def _extract_images(soup, html):
    urls = set()
    og = soup.select_one('meta[property="og:image"]')
    if og: urls.add(_attr(og, 'content'))

    for img in soup.select(
        'ul#dt-tab img, .image-list img, .detail-gallery img, '
        '[class*="gallery"] img, [class*="preview"] img, '
        '.tb-thumb img, .J_Thumb img, .offer-thumb img, '
        '[class*="swiper"] img, [class*="slider"] img, '
        '[class*="main-img"] img, [class*="detail-img"] img, '
        'li[class*="img"] img'
    ):
        src = (img.get('data-src') or img.get('data-lazyload')
               or img.get('data-original') or img.get('src'))
        if src:
            if not src.startswith('http'): src = 'https:' + src
            src = re.sub(r'\.jpg_.*$', '.jpg', src)
            src = re.sub(r'_\d+x\d+\.', '.', src)
            urls.add(src)

    return list(urls)

def _extract_specs(soup):
    specs = {}
    # param/attribute tables
    for tbl in soup.select('table.param-table, table.attributes, [class*="param"] table, [class*="attr"] table'):
        for row in tbl.select('tr'):
            cells = row.select('td, th')
            if len(cells) >= 2:
                k = _text(cells[0]).rstrip('：:')
                v = _text(cells[1])
                if k and v: specs[k] = v
    # DL-style
    for dl in soup.select('[class*="param"] dl, [class*="attr"] dl, .mod-detail-attr dl'):
        dt = dl.select_one('dt'); dd = dl.select_one('dd')
        if dt and dd:
            k = _text(dt).rstrip('：:')
            v = _text(dd)
            if k and v: specs[k] = v
    # LI-style
    for li in soup.select('[class*="param"] li, [class*="attr"] li, .param-item, .prop-item'):
        t = li.get_text(strip=True)
        if '：' in t or ':' in t:
            parts = re.split(r'[：:]', t, 1)
            if len(parts) == 2 and parts[0] and parts[1]:
                specs[parts[0].strip()] = parts[1].strip()
    return specs

def _extract_seller(soup):
    el = _first(soup,
        'a[class*="seller"]', '.seller-name a',
        '[class*="shop"] a', '.mod-shop-name a',
        'a[href*="shop"]'
    )
    if el:
        return _text(el), _attr(el, 'href') or ""
    # meta
    og = soup.select_one('meta[property="og:product:brand"]')
    if og: return _attr(og, 'content'), ""
    return "", ""

def _extract_sales(soup, html):
    m = re.search(r'(\d[\d,]*)\s*件?已成交|成交\(?(\d[\d,]*)', html)
    if m:
        return int((m.group(1) or m.group(2)).replace(',', ''))
    return 0

def _extract_skus(data):
    skus = []
    seen = set()
    if data.get('skuMap'):
        for key, s in data['skuMap'].items():
            try:
                p = float(s['price']) if s.get('price') else None
                w = float(s['weight']) if s.get('weight') else None
                skus.append({"name": key, "price": p, "weight": w})
            except: pass
    if data.get('skuPriceInfo') and data['skuPriceInfo'].get('skuPriceList'):
        for s in data['skuPriceInfo']['skuPriceList']:
            try:
                p = float(s['price']) if s.get('price') else None
                w = None
                for wk in ['weight', 'skuWeight', 'packageWeight', 'grossWeight']:
                    if s.get(wk):
                        try: w = float(s[wk]); break
                        except: pass
                name = s.get('specAttrValue', s.get('skuName', ''))
                if name not in seen:
                    seen.add(name)
                    skus.append({"name": name, "price": p, "weight": w})
            except: pass
    return skus

# ═══════════════════════════════════════════════
# Streamlit UI
# ═══════════════════════════════════════════════

def sc():
    return "#8a8f98" if st.session_state.get("theme", "dark") == "dark" else "#62666d"

def render_scraper_page():
    """Full 1688 scraper & product management page."""
    # Init session state
    for k in ['scraper_result', 'scraper_error', 'scraper_loading',
              'scraper_product_list', 'manual_price', 'manual_weight',
              'scraper_url_input']:
        if k not in st.session_state: st.session_state[k] = None if k != 'scraper_product_list' else []

    # Ensure product list from file
    if not st.session_state.scraper_product_list:
        st.session_state.scraper_product_list = load_products()

    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="ct">📦 1688 产品管理</div>', unsafe_allow_html=True)

    # ─── Workflow guide ──────────────────────
    st.info(
        "**💡 使用方式**\n\n"
        "1️⃣ 打开 1688 商品页面 → **Chrome 扩展自动扒取**\n"
        "2️⃣ 点扩展侧边栏的 **📤 发送到核价面板**\n"
        "3️⃣ 数据自动出现在下方的「已保存」列表\n\n"
        "⚠️ 1688 有强反爬机制，服务端无法直接扒取，必须用浏览器扩展。"
    )

    # ─── API-received products ───────────────
    # Check API for new products (refresh button)
    c1, c2 = st.columns([3, 1])
    with c2:
        if st.button("🔄 刷新产品列表", use_container_width=True, key="refresh_products"):
            st.session_state.scraper_product_list = load_products()
            st.rerun()
    with c1:
        st.caption("从扩展发送的数据会自动保存，点击刷新查看最新产品")

    # ─── Saved products ─────────────────────
    products = st.session_state.scraper_product_list
    if products:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.markdown(f'<div class="ct">📁 已保存 ({len(products)})</div>', unsafe_allow_html=True)
        _render_product_list(products)
        st.markdown('</div>', unsafe_allow_html=True)

def _render_product_detail(p):
    """Show scraped product detail with import controls."""
    ci = {"symbol": "MX$", "currency": "MXN"}
    cols = st.columns([1, 2.5])

    with cols[0]:
        # Product image
        if p.get("cover"):
            st.image(p["cover"], use_container_width=True)
        elif p.get("images"):
            st.image(p["images"][0], use_container_width=True)
        else:
            st.markdown('<div style="height:180px;background:rgba(255,255,255,0.03);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#8a8f98">📦</div>', unsafe_allow_html=True)

        # Quick view gallery
        if p.get("images") and len(p["images"]) > 1:
            imgs = p["images"][:5]
            gi = st.columns(len(imgs))
            for i, img_url in enumerate(imgs):
                with gi[i]:
                    st.image(img_url, use_container_width=True)

    with cols[1]:
        st.markdown(f'**{p["title"][:100]}**')
        if p.get("seller_name"):
            st.caption(f"🏪 {p['seller_name']}")

        # Price
        if p.get("price_min"):
            price_str = p["price_text"]
            st.markdown(f'<div style="font-size:1.4rem;font-weight:600;color:#FFE600;margin:0.3rem 0">{price_str}</div>',
                        unsafe_allow_html=True)

        # Weight
        wt_val = p.get("weight")
        wt = wt_val if wt_val else None

        # Specs
        if p.get("specs"):
            with st.expander("📋 规格参数"):
                spec_html = '<table class="tbl">'
                for k, v in list(p["specs"].items())[:20]:
                    spec_html += f"<tr><td>{k}</td><td>{v}</td></tr>"
                spec_html += "</table>"
                st.markdown(spec_html, unsafe_allow_html=True)

        if p.get("sku_count", 0) > 0:
            st.caption(f"🧩 {p['sku_count']} 个规格选项")

        # ─── Import to calculator ──────────────
        st.markdown("---")
        st.markdown("**📥 导入核价面板**")

        # Manual weight edit
        im1, im2, im3 = st.columns([1, 1, 1.5])
        with im1:
            manual_wt = st.number_input(
                "📦 重量 (kg)", 0.0, 500.0,
                value=float(wt) if wt else 0.3,
                step=0.1, format="%.3f",
                key="iwt",
            )
        with im2:
            manual_pr = st.number_input(
                "🏭 货源价 ¥", 0.0,
                value=float(p["price_min"]) if p.get("price_min") else 0.0,
                step=5.0, format="%.2f",
                key="ipr",
            )
        with im3:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("🚀 导入并核价", type="primary", use_container_width=True, key="import_calc"):
                # Set session state values for the calculator
                st.session_state["fp_0"] = 0  # will be filled by reverse calc
                st.session_state["wt_0"] = manual_wt
                st.session_state["sr_0"] = manual_pr
                # Store for calculator
                st.session_state["_imported_price"] = manual_pr
                st.session_state["_imported_weight"] = manual_wt
                st.session_state["_imported_title"] = p["title"][:60]
                st.session_state.nav_page = "calc"
                # Auto-switch to 反向 pricing mode
                st.session_state.mode = "reverse"
                st.success(f"✅ 已导入: ¥{manual_pr} / {manual_wt}kg")
                st.rerun()

        # ─── Save product ──────────────────
        if st.button("💾 保存产品", use_container_width=True, key="save_prod"):
            products = st.session_state.scraper_product_list
            # Avoid duplicates by item_id
            existing = [i for i, x in enumerate(products) if x.get("item_id") == p.get("item_id")]
            save_data = dict(p)
            save_data["saved_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            if existing:
                products[existing[0]] = save_data
            else:
                products.insert(0, save_data)
            save_products(products)
            st.session_state.scraper_product_list = products
            st.success("✅ 已保存")
            st.rerun()

def _render_product_list(products):
    """Show saved product cards."""
    for i, p in enumerate(products):
        with st.container():
            cos = st.columns([0.3, 1, 0.7, 0.4, 0.2])
            with cos[0]:
                # Thumbnail
                img = p.get("cover") or (p.get("images") or [""])[0]
                if img:
                    st.image(img, width=50)
                else:
                    st.markdown('<div style="width:50px;height:50px;background:rgba(255,255,255,0.03);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.2rem">📦</div>', unsafe_allow_html=True)
            with cos[1]:
                st.markdown(f'**{p.get("title", "")[:50]}**')
                if p.get("price_text"):
                    st.caption(f'{p["price_text"]} · {"📦 " + str(p["weight"]) + "kg" if p.get("weight") else ""}')
            with cos[2]:
                if st.button(f"📊 核价", key=f"imp_{i}", use_container_width=True):
                    st.session_state["_imported_price"] = p.get("price_min", 0) or 0
                    st.session_state["_imported_weight"] = p.get("weight", 0.3) or 0.3
                    st.session_state["_imported_title"] = (p.get("title") or "")[:60]
                    st.session_state.nav_page = "calc"
                    st.session_state.mode = "reverse"
                    st.rerun()
            with cos[3]:
                if p.get("scraped_at"):
                    st.caption(p["scraped_at"][5:16] if len(p.get("scraped_at","")) > 10 else p.get("scraped_at",""))
            with cos[4]:
                if st.button("🗑️", key=f"del_{i}"):
                    products.pop(i)
                    save_products(products)
                    st.session_state.scraper_product_list = products
                    st.rerun()
        st.markdown(f'<div style="height:1px;background:rgba(255,255,255,0.04);margin:0.2rem 0"></div>', unsafe_allow_html=True)
