---
name: ml-cross-border-dashboard
description: "Build Streamlit dashboards for Mercado Libre cross-border pricing/profit analysis — multi-country, live FX, shipping tables, net profit calculation, competitor comparison"
version: 2.0.0
tags: [ecommerce, cross-border, streamlit, dashboard, mercadolibre, pricing, profit-calculator, python]
---

# ML Cross-Border Dashboard (Streamlit)

Build interactive Streamlit dashboards for 1688 → Mercado Libre cross-border pricing and profit analysis. Supports 6 ML countries with live exchange rates, editable shipping rate tables, and net profit calculations.

## When to Use

- User wants a web-based pricing/profit calculator for ML cross-border selling
- User needs a dashboard with live exchange rates and shipping cost lookup
- User wants to compare profitability across multiple ML countries
- User asks for a "tool" or "面板" to input prices and get profit analysis
- User requests a chat + calculator UI for ecommerce operations

## ⚠️ CRITICAL: Multi-Format Data Sync

The shipping rate data lives in **three separate codebases** that must all be updated when rates change:

| Format | Location | Language |
|--------|----------|----------|
| Streamlit Dashboard | `hermes_dashboard.py` | Python |
| Regular Extension | `hermes_extension/sidepanel.js` | JavaScript |
| Standalone Extension | `hermes_extension_standalone/sidepanel.js` | JavaScript |

**Update workflow:**
1. Decide the new rates (e.g. from Cainiao ML page, Scrape → table → convert to 6-bracket averages)
2. Patch the Python DEFAULT_SHIP dict in dashboard
3. Patch the JS DEFAULT_SHIP const in both extension files
4. Copy updated files to Windows desktop (`/mnt/c/Users/Administrator/Desktop/`)

**When converting Cainiao's 36+ weight tiers to the dashboard's 6-bracket model** (0-0.1, 0.1-0.2, 0.2-0.5, 0.5-1.0, 1.0-2.0, 2.0-5.0 kg), compute the **average** of all Cainiao tiers that fall within each target bracket. Use the below-threshold (低售价) price tier.

## ⚠️ CRITICAL: Correct Shipping Model (Two Variants)

**You MUST determine which shipping model the user uses before building.**

**Always confirm with the user which model. Chinese sellers almost always use Variant B.**

### Variant A: Local Mercado Envíos (本地卖家) — RARE for Chinese sellers
- Zone-based rates within the country (misma ciudad / mismo estado / resto país)
- Rate tables in local currency per weight bracket per zone
- Used when seller ships from within the target country (local inventory)
- Format: `[min_kg, max_kg, zone1_rate, zone2_rate, zone3_rate]`

### Variant C: Cainiao Self-Delivery (菜鸟自配送) — 5 countries (MX, BR, AR, CL, CO)

Chinese sellers use **Cainiao** as an alternative carrier instead of ML's built-in cross-border shipping. Covers **5 countries** — Mexico, Brazil, Argentina, Chile, Colombia. Uruguay (UY) does NOT support Cainiao.

**Structure:**
- **36+ weight brackets** from 0-15kg (vs ML's 6 brackets for 0-5kg)
- **Two price tiers** depending on listing price relative to a threshold:
  - "Above threshold" — higher shipping cost
  - "Below threshold" — lower shipping cost, used as the primary rate in the panel
- Both tiers **converge at ~1kg+** (same rate for both tiers above 1kg)
- Each country has its own threshold in local currency

**Current below-threshold rates (averaged into 6-bracket model, Apr 2026):**
```python
DEFAULT_SHIP = {
    "MX":[1.70,2.10,3.93,10.82,26.00,61.03],   # 菜鸟 <MXN299
    "BR":[1.70,2.40,3.90,10.76,26.05,50.10],   # 菜鸟 <BRL79
    "CO":[1.80,2.40,5.00,11.10,24.40,59.40],   # 菜鸟 <COP60000
    "CL":[1.20,1.20,1.60,4.56,18.00,51.00],    # 菜鸟 <CLP19990
    "AR":[5.00,5.00,6.00,10.00,18.50,56.67],   # 菜鸟 <ARS33000
    "UY":[3.00,3.50,4.50,6.00,8.00,11.00],     # ML自发货（不变）
}
```

**Threshold values by country:**
- MX: MXN 299
- BR: BRL 79
- AR: ARS 33,000
- CL: CLP 19,990
- CO: COP 60,000

**See `cainiao-shipping-ml` skill** for full 36-tier per-country tables with both above/below threshold rates.

**Key pricing difference from ML Cross-Border (Variant B):** Cainiao is cheaper for sub-1kg items (e.g. MX 0-100g: $1.70 vs $2.50) but MUCH more expensive for 2-5kg (e.g. MX 2-5kg: $61.03 vs $9.00). Always verify carrier.

### Variant B: ML Cross-Border Shipping (跨境自发货) ✅ DEFAULT for Chinese sellers
- **No zones** — just one flat fee per country per weight bracket
- Fee is in **USD per item** (not local currency, not per-kg, not ¥/kg)
- Weight brackets: `0-100g, 100-200g, 200-500g, 500g-1kg, 1-2kg, 2-5kg`
- Simple format: `[fee_100g, fee_200g, fee_500g, fee_1kg, fee_2kg, fee_5kg]` — one list per country
- This is what ML charges the seller for handling last-mile delivery from China
- **NOT** a simple ¥/kg multiplier — it's a lookup table by weight bracket
- Default rates (reference only, user should adjust):
  ```python
  DEFAULT_SHIP_USD = {
      "MX": [2.50, 3.00, 3.50, 4.50, 6.00, 9.00],
      "BR": [3.00, 3.50, 4.50, 6.00, 8.00, 12.00],
      "CO": [2.50, 3.00, 4.00, 5.00, 7.00, 10.00],
      "CL": [2.50, 3.00, 3.50, 5.00, 6.50, 9.50],
      "AR": [3.50, 4.00, 5.00, 7.00, 9.00, 14.00],
      "UY": [3.00, 3.50, 4.50, 6.00, 8.00, 11.00],
  }
  ```
- Shipping lookup:
  ```python
  def sfee(ck, w):
      rates = st.session_state.ship.get(ck, [0]*6)
      if w <= 0: return 0.0
      for i in range(len(BRACKETS) - 1):
          if BRACKETS[i] <= w < BRACKETS[i+1]:
              return rates[i] if i < len(rates) else 0.0
      return rates[-1] if rates else 0.0
  ```

## Login System (Optional)

Simple password-only login page:
- **Master password**: Fixed string (default "Hermes2024")
- **Do NOT** add OTP/TOTP unless user explicitly asks — most users prefer just a password
- **Do NOT** put password changer in Settings — user wants to change it through the agent only
- **Theme toggle**: Dark/Light mode button (🌙/☀️) on both login page and app header

Implementation pattern — keeping login_page() and main_app() as separate entry points:
```python
if st.session_state.logged_in: main_app()
else: login_page()
```

```
hermes_dashboard.py (single Streamlit file)
├── Exchange Rates (live fetch from open.er-api.com)
├── Shipping Rate Tables (6 countries, zone-based, editable)
├── Calculator (profit formula per user spec)
├── Chat Panel (sidebar, message history + quick actions)
├── Results Display (metric cards + detailed breakdown)
├── History Table (session calculation records)
└── Settings (editable rate tables in-app)
```

## Country Data Structure

```python
COUNTRIES = {
    "MX": {"name": "México", "flag": "🇲🇽", "currency": "MXN", "zone_names": ["同城", "同州", "全国其他"]},
    "BR": {"name": "Brasil", "flag": "🇧🇷", "currency": "BRL", "zone_names": ["首都", "大都市区", "内陆", "北部/东北部"]},
    "CO": {"name": "Colombia", "flag": "🇨🇴", "currency": "COP", "zone_names": ["同城", "同省", "全国"]},
    "CL": {"name": "Chile", "flag": "🇨🇱", "currency": "CLP", "zone_names": ["圣地亚哥都会区", "其他地区"]},
    "AR": {"name": "Argentina", "flag": "🇦🇷", "currency": "ARS", "zone_names": ["AMBA", "省会", "内陆"]},
    "UY": {"name": "Uruguay", "flag": "🇺🇾", "currency": "UYU", "zone_names": ["蒙得维的亚", "内陆"]},
}
```

## Core Calculation Formula (per user spec)

```
竞品净收入(USD) = (前端售价(local) ÷ 站点汇率) × 0.8 − 运费(重量查表)
  其中:
    0.8 = 扣除ML 20%佣金后的留存比例
    运费 = 从运费表中按重量区间 + 配送区域查询

货源成本(USD) = 1688货源价(CNY) × CNY→USD汇率 + 0.5
  其中:
    0.5 = 缓冲费用

纯利润(USD) = 竞品净收入(USD) − 货源成本(USD)
利润率(%) = 纯利润 / 竞品净收入 × 100
结论: 纯利润 > 0 → ✅ 可做, 否则 ❌ 不可做
```

## Exchange Rate API

Use **open.er-api.com** (free, no key):

```python
import requests
resp = requests.get("https://open.er-api.com/v6/latest/USD", timeout=10)
rates = resp.json()["rates"]
# rates["MXN"], rates["BRL"], rates["COP"], rates["CLP"], rates["ARS"], rates["UYU"], rates["CNY"]
```

## Shipping Rate Table Format

Each country has weight-break rows with zone-based rates:

```python
# MX example: [min_kg, max_kg, zone1_rate, zone2_rate, zone3_rate]
DEFAULT_SHIPPING["MX"] = [
    [0, 0.5, 59, 79, 109],
    [0.5, 1, 79, 109, 149],
    ...
]
```

Shipping cost lookup function:
```python
def get_shipping_cost(country_code, weight_kg, zone_idx=0):
    rates = st.session_state.shipping_rates[country_code]
    for row in rates:
        if row[0] <= weight_kg < row[1]:
            return row[2 + min(zone_idx, len(row)-3)]
    return rates[-1][2 + min(zone_idx, len(rates[-1])-3)]
```

## Three Calculation Modes

The dashboard can operate in 3 modes that the user can switch between via radio buttons or tabs (both in the dashboard and the extensions):

### Mode 1: Standard (核价 — 标准)

The original profit calculation. Enter `selling_price`, `weight`, `sourcing_cost` → get profit, margin, and detailed breakdown.

### Mode 2: Reverse Pricing (反向定价)

Enter `weight`, `sourcing_cost`, and a `target_profit_percentage` → outputs the **required selling price** for each target profit %. Useful for pricing strategy — "I want 20% profit on this product, what should I sell it for?"

```python
# Implementation pattern
def calc_reverse(ck, weight, sourcing, target_pct):
    xl = fx_rate(ck)  # local → USD
    xc = usd_cny()    # CNY → USD
    need_net = sourcing * xc + BUFFER + (sourcing * xc) * (target_pct / 100.0)
    need_aml = need_net + ship_fee(ck, weight)
    need_fusd = need_aml / ML_CUT
    need_fp = need_fusd / xl
    return need_fp  # in local currency
```

For extensions, add **selectable profit % buttons** (10%/15%/20%/25%/30%) that toggle on/off. Only selected %s are shown in results. Default: 10% and 20%.

### Mode 3: Multi-Country Comparison (全站对比)

Enter a **single selling price in USD**, weight, and sourcing cost → view a **sorted table** of all 6 countries ranked by profit, with the best option marked 🏆.

```python
def calc_all(fp, wt, sr):
    results = {}
    for ck in CKS:
        res, err = calc(ck, fp, wt, sr)
        results[ck] = res if res else None
    return results
```

The table columns: `站点 | 佣金 | 运费 | 利润(USD) | 利润率 | 结论(✅/❌)`. Sort by profit descending. Show the top pick with 🏆.

In extensions: display results sorted descending by profit, highlight the best with 🏆 prefix:

```javascript
function showCmpResult(results) {
  const sorted = CKS.map(k => ({ ck: k, r: results[k] }))
    .filter(x => x.r && !x.r.error)
    .sort((a, b) => b.r.profit - a.r.profit);
  for (const { ck, r } of sorted) {
    const rank = sorted.indexOf({ ck, r }) === 0 ? '🏆 ' : '';
    // render rank + country + profit + margin
  }
}
```

## Keyboard Shortcuts

Add Enter key support in both dashboard and extensions:

**Dashboard:** Streamlit doesn't easily support keyboard listeners, but extensions can:
```javascript
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const activeTab = document.querySelector('#modeTabs .tab.act');
    if (activeTab.dataset.mode === 'calc') doCalc();
    else if (activeTab.dataset.mode === 'reverse') doReverse();
    else if (activeTab.dataset.mode === 'compare') doCompare();
  }
});
```

## UI Design Pattern

- **Theme**: Linear-inspired dark (#08090a background), ML Yellow (#FFE600) accent, gold gradients for CTAs
- **Cards**: Semi-transparent backgrounds `rgba(255,255,255,0.02)` with thin white borders `rgba(255,255,255,0.06)`
- **No shadows** on dark — depth comes from background luminance stepping, not box-shadows
- **Inter font** with `font-feature-settings: 'cv01', 'ss03'` (Linear's signature OpenType features)
- **Letter-spacing**: aggressive negative tracking on titles (-0.02em), standard on body
- **Hover effects**: subtle background opacity increase + 0.5px Y translation + quick transition (0.12-0.15s)
- **Hover effects**: subtle background opacity increase + 0.5px Y translation + quick transition (0.12-0.15s)
- **Layout**: Chat sidebar (1) + Main calculator area (2.3) ratio via st.columns
- **Country switcher**: 6 buttons as pill-style tabs at top
- **Mode switcher**: radio buttons (`标准`/`反向`/`对比`) or custom tabs in extensions
- **Metric display**: st.columns with custom CSS metric boxes
- **Results**: col-row of 5 key metrics + expandable detail section
- **Animated results**: CSS `@keyframes fadeIn` (opacity 0→1, translateY(-2px)→0) on result divs
- **Status bar**: Fixed bottom bar with current mode icon, FX time, calc count, version
- **Toast notifications**: Positioned fixed bottom-center, auto-dismiss after ~1.8s
  
  CSS + JS for extension toasts:
  ```javascript
  // showToast("msg", "#10b981")
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = `position:fixed;bottom:40px;left:10px;right:10px;background:#1a1a2e;
    color:${color||'#e8e8f0'};padding:5px 8px;border-radius:5px;font-size:10px;text-align:center;z-index:999;border:1px solid rgba(255,230,0,0.15)`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1800);
  ```

- **Results with fade-in**: Add class `fade` to result divs so they animate in:
  ```html
  <div class="res fade">...</div>
  ```

- **Status bar with mode icon**: Fixed bottom bar showing current mode icon + FX time + calc count + version:
  ```python
  mode_icon = {"normal":"🧮","reverse":"📊","compare":"🌍"}.get(mode,"🧮")
  st.markdown(f'<div class="sb"><div>🟢 运行中</div><div>{mode_icon} {mode_label} | 💱 {fx_time} | {count} 次</div><div>v4.0</div></div>')
  ```

- **Reverse pricing % toggle buttons**: In extensions, use clickable toggle buttons for target profit percentages (default: 10% and 20% selected):
  ```html
  <div class="flex" style="margin-bottom:4px">
    <button class="btn btn-s on" data-pct="10">10%</button>
    <button class="btn btn-s" data-pct="15">15%</button>
    <button class="btn btn-s on" data-pct="20">20%</button>
    <button class="btn btn-s" data-pct="25">25%</button>
    <button class="btn btn-s" data-pct="30">30%</button>
  </div>
  ```
  ```javascript
  let activePcts = new Set([10, 20]);
  document.querySelectorAll('[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.dataset.pct);
      if (activePcts.has(pct)) { activePcts.delete(pct); btn.classList.remove('on'); }
      else { activePcts.add(pct); btn.classList.add('on'); }
    });
  });
  ```
  Only show results for selected %s.

### Key CSS Classes

```css
.glass-card: frosted glass card with hover glow, semi-transparent bg + thin border
.metric-box: centered metric with label/value
.comp-table: styled comparison/data table
.chat-user / .chat-ai: message bubbles
.country-tab: pill-style tab buttons (active = gold border, inactive = thin white border)
.fx-bar: horizontal exchange rate display
.status-bar: fixed footer with mode icon, FX time, count, version
.fade: animation fadeIn 0.15s
.tabs: horizontal tab bar for mode switching (dark bg, active tab = lighter bg + gold text)
.ctab: flex container for country buttons
```

## Chat Auto-Reply System

For standalone mode (no gateway connection), implement keyword-based auto-replies:
```python
QUICK_ACTIONS = [
    ("💰 计算核价", "帮我算一下这个产品的利润"),
    ("🔍 查竞品", "帮我分析这个竞品"),
    ("📦 找货源", "帮我找1688货源"),
    ("📊 站点对比", "帮我对比各站点"),
]
```
Map keywords: 计算/核价/利润, 竞品/分析, 货源/1688, 站点/对比, 汇率

## AI Chat Integration (Optional)

Users may ask for the chat box to actually call an AI model instead of using keyword-based auto-replies. To implement:

### Configurable API Settings

Add in Settings section (not hardcoded):
```python
# In session state init:
"api_key":"","api_model":"deepseek-chat","api_url":"https://api.deepseek.com/v1/chat/completions"

# In Settings UI:
ak = st.text_input("API密钥", type="password", value=st.session_state.api_key)
am = st.text_input("模型名", value=st.session_state.api_model)
au = st.text_input("API地址", value=st.session_state.api_url)
```

### Chat Function

```python
def ai_chat(messages):
    key = st.session_state.api_key
    if not key: return "⚠️ 未配置API密钥"
    url = st.session_state.api_url
    model = st.session_state.api_model
    msgs = [{"role":"system","content":"You are a cross-border ecommerce pricing assistant..."}]
    for m in messages[-10:]:
        role = "assistant" if m["role"]=="ai" else "user"
        msgs.append({"role":role, "content":m["text"]})
    r = requests.post(url, json={"model":model, "messages":msgs, "max_tokens":512},
                      headers={"Authorization":f"Bearer {key}"}, timeout=15)
    return r.json()["choices"][0]["message"]["content"]
```

### Key Points
- Support any OpenAI-compatible API (DeepSeek, 豆包, etc.)
- **DO NOT** prompt for API key during first use — just show a caption "去设置填入密钥"
- System prompt should be concise and cross-border focused
- Error handling: catch auth errors, timeout, malformed responses
- API key goes in Settings, **do NOT** put it in code or hardcode it
- Default to DeepSeek (`api.deepseek.com`) since it's popular among Chinese users
- `max_tokens: 512` is sufficient for pricing Q&A

## Browser Extension Companion (Optional)

Users may ask for a Chrome extension companion that integrates with the dashboard. Two modes: **popup** (traditional) or **side panel** (persistent right sidebar).

### Mode A: Popup (simple)

```
hermes_extension/
├── manifest.json
├── popup.html        # 380px wide popup
├── popup.js
├── content.js        # 1688 scraper
├── icon16/48/128.png
```

### Mode B: Side Panel (recommended) ✅

Users who say "侧边栏" or "一直保持在浏览器右侧" want side panel mode:

```
hermes_extension/
├── manifest.json     # ← needs sidePanel permission
├── sidepanel.html    # ← replaces popup.html
├── sidepanel.js
├── background.js     # ← new: opens side panel on icon click
├── content.js        # 1688 scraper
├── icon16/48/128.png
```

**manifest.json** — key differences from popup mode:
```json
{
  "permissions": ["activeTab", "storage", "sidePanel"],
  "action": { "default_title": "Title here", "default_icon": {...} },
  "side_panel": { "default_path": "sidepanel.html" },
  "background": { "service_worker": "background.js" }
}
```
Note: No `default_popup` in action — the popup is replaced by the side panel.

**background.js** — minimal service worker:
```javascript
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error(err));
```

**sidepanel.html** — same structure as popup but:
- Full viewport height (min-height: 100vh) not fixed 380px
- Sticky header and footer
- Wider, more spacious layout
- Additional utility widgets (quick pricing calculator, etc.)

**sidepanel.js** — like popup.js but can include more features since there's more space. Add a "quick calc" feature:
```javascript
// Quick pricing estimate using cached FX rates
const srcUSD = parseFloat(srcPrice) * usd_cny_rate + 0.5;
const net = frontUSD * 0.8 - shippingFee;
const profit = net - srcUSD;
```

### Mode C: Standalone Extension (No Dashboard Needed)

Some users want the extension to work **without** running a dashboard or backend at all. The extension embeds all pricing logic, shipping rate tables, and FX fetching directly — fully self-contained in the browser.

**When to use this:** User says "不用依赖我的网站/面板", "离了面板也能用", or "独立版".

Key differences from dashboard-dependent versions:
- No `host_permissions` for the dashboard address → **remove** from manifest.json
- No external message listener for FX sync from dashboard
- All pricing data (shipping tables, commission rates, fallback FX) hardcoded in JS
- FX fetched directly from public APIs via `fetch()` in the extension, not from dashboard

**File structure:**
```
hermes_extension_standalone/
├── manifest.json           # No dashboard host_permissions
├── sidepanel.html          # No "打开面板" link
├── sidepanel.js            # Full pricing logic embedded
├── content.js              # 1688 scraper (same)
├── background.js           # Minimal (same)
├── icon16/48/128.png
```

**manifest.json adjustments:**
```json
{
  "permissions": ["activeTab", "storage", "sidePanel"],
  "host_permissions": [
    "https://detail.1688.com/offer/*",
    "https://open.er-api.com/*",
    "https://api.frankfurter.dev/*"
  ],
  // NO dashboard address in host_permissions
}
```

**Embedded static data (in sidepanel.js):**
```javascript
const COUNTRIES = {
  MX: { name: 'México', flag: '🇲🇽', currency: 'MXN', symbol: 'MX$' },
  BR: { name: 'Brasil', flag: '🇧🇷', currency: 'BRL', symbol: 'R$' },
  CO: { name: 'Colombia', flag: '🇨🇴', currency: 'COP', symbol: 'COL$' },
  CL: { name: 'Chile', flag: '🇨🇱', currency: 'CLP', symbol: 'CLP$' },
  AR: { name: 'Argentina', flag: '🇦🇷', currency: 'ARS', symbol: 'ARS$' },
  UY: { name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', symbol: 'UYU$' },
};
const CKS = ['MX', 'BR', 'CO', 'CL', 'AR', 'UY'];
const SHIP_BK = [0, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
const BK_LBL = ['0-100g', '100-200g', '200-500g', '500g-1kg', '1-2kg', '2-5kg'];
const DEFAULT_SHIP = {
  MX: [2.50, 3.00, 3.50, 4.50, 6.00, 9.00],
  BR: [3.00, 3.50, 4.50, 6.00, 8.00, 12.00],
  CO: [2.50, 3.00, 4.00, 5.00, 7.00, 10.00],
  CL: [2.50, 3.00, 3.50, 5.00, 6.50, 9.50],
  AR: [3.50, 4.00, 5.00, 7.00, 9.00, 14.00],
  UY: [3.00, 3.50, 4.50, 6.00, 8.00, 11.00],
};
const FALLBACK_RATES = { MXN: 20.0, BRL: 5.5, COP: 4200, CLP: 950, ARS: 1450, UYU: 42, CNY: 7.3 };
```

**FX fetch (direct API call from extension):**
```javascript
async function fetchFX() {
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.dev/latest?from=USD',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      const rt = data.rates || {};
      const needed = ['MXN', 'BRL', 'COP', 'CLP', 'ARS', 'UYU', 'CNY'];
      if (needed.filter(c => rt[c] && rt[c] > 0).length >= 3) {
        // transform and return
        const rates = {};
        needed.forEach(c => { if (rt[c]) rates[c] = rt[c]; });
        rates.fetched = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        rates.usd_cny = 1.0 / (rt.CNY || 7.25);
        return rates;
      }
    } catch {}
  }
  return { ...FALLBACK_RATES, fetched: '备用', usd_cny: 1.0 / 7.3 };
}
```

**Profit calculation (all local, no API call):**
```javascript
function calcProfit(ck, price, weight, sourcing) {
  const curr = COUNTRIES[ck].currency;
  const fxRate = fx[curr];            // e.g. MXN per USD
  const usd_cny = fx.usd_cny;         // USD per CNY
  const fusd = price / fxRate;
  const afterComm = fusd * 0.80;       // ML 20% commission
  const ship = shipFee(ck, weight);     // lookup in DEFAULT_SHIP
  const net = afterComm - ship;
  const srcCost = sourcing * usd_cny + 0.50; // buffer
  const profit = net - srcCost;
  const margin = net > 0 ? (profit / net) * 100 : 0;
  return { profit, margin, fusd, afterComm, ship, net, srcCost, ok: profit > 0 };
}
```

**Side panel HTML — no external links, all content is the calculator itself:**
```html
<div class="hd"><h1>🛒 Hermes 独立核价</h1><div class="s">1688 → ML · 6站点 · 离线可用</div></div>
```

**Installation:**
```bash
# Copy to Windows desktop
cp -r ~/hermes_extension_standalone /mnt/c/Users/Administrator/Desktop/hermes_standalone/
```
Then Chrome → 管理扩展 → 加载已解压的扩展 → select the folder.

### Cross-Extension Features (Dashboard-Dependent & Standalone)

1. **1688 scraping** — content script on `https://detail.1688.com/offer/*`:
```javascript
setTimeout(() => {
  const priceEl = document.querySelector('.price-value, .offer-price');
  const price = priceEl ? priceEl.textContent.trim().replace(/[^0-9.]/g, '') : null;
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'scrape1688') sendResponse({price, weight, title, url});
  });
}, 1000);
```

2. **FX sync** — dashboard → extension communication via chrome.storage:
```python
# In Streamlit dashboard, after fetching rates:
import json
fx_data = {k: f"{v:.2f}" for k, v in rates.items() if k != "fetched" and k != "usd_cny"}
# Store to a local file or use a simple endpoint
```

The extension reads from `chrome.storage.local`. The dashboard can write to a shared file or serve an HTTP endpoint that the extension polls.

3. **Icons** — generate simple PNG icons in Python (no external deps):
```python
import struct, zlib
def create_png(size):
    w = h = size
    bg = (10, 10, 15, 255); fg = (255, 230, 0, 255)
    pixels = []
    for y in range(h):
        for x in range(w):
            cx, cy = x/w, y/h
            f = ((0.2<cx<0.35 and 0.1<cy<0.9) or (0.65<cx<0.8 and 0.1<cy<0.9)
                 or (0.15<cx<0.85 and 0.42<cy<0.58))
            c = fg if f else bg; pixels.extend(c)
    # ... PNG chunk assembly (IHDR, IDAT, IEND)
    return png_bytes
```

Note: 1688 has strong anti-scrape protection. The content script is best-effort; always provide manual fallback inputs in the dashboard.

## 1688 Product Integration (In-Dashboard)

Add an expandable section in the dashboard for 1688 product lookup:

```python
with st.expander("📦 1688 货源信息"):
    url = st.text_input("1688商品链接", key="url_1688")
    if st.button("🔍 扒取信息", key="scrape_1688"):
        # Extract offerId from URL via regex, then attempt API call
        match = re.search(r'offer/(\d+)', url)
    # Always provide manual fallback inputs
    st.number_input("参考价 (¥)", key="ref_price")
    st.number_input("参考重量 (kg)", key="ref_weight")
```

Due to 1688's anti-scrape measures, automatic extraction often fails. The manual fallback is the reliable path. The scraper is a nice-to-have convenience when it works.

## Public Deployment (Reverse Proxy via Caddy)

When the user wants others to access the dashboard, deploy behind Caddy on a non-privileged port (no root needed).

### Step 1: Download Caddy

```bash
mkdir -p ~/bin
curl -sL "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz" -o /tmp/c.tgz
tar xzf /tmp/c.tgz -C /tmp/ caddy
mv /tmp/caddy ~/bin/caddy && chmod +x ~/bin/caddy
```

### Step 2: Create Caddyfile (no-root, port 8080)

```bash
echo 'http://:8080 { reverse_proxy localhost:8501 }' > ~/Caddyfile
~/bin/caddy run --config ~/Caddyfile
```

Use `http://:8080` (NOT `:8080` alone, NOT `tls off`) — this syntax explicitly disables TLS and HTTPS redirect, avoiding port 80 binding which needs root.

### Step 3: Update Extension URLs

When dashboard goes from localhost to a public domain, update ALL of these in the extension:

| File | What to change |
|------|---------------|
| `manifest.json` | `host_permissions` — `http://localhost:8501/*` → `http://yourdomain:8080/*` |
| `sidepanel.html` | The "打开核价面板" link `href` |
| `popup.html` | Same link `href` |

### Step 4: Cloud Firewall

**Tencent Cloud (腾讯云)** — Lightweight Server firewall:
```
方向: 入站规则
协议: TCP
端口: 8080
来源: 0.0.0.0/0
```

**AWS/GCP/Azure** — analogous security group / firewall rule for the chosen port.

### Step 5: DNS

User must add an A record pointing their domain to the server's public IP.

```bash
# Kill old process
pkill -f "streamlit run hermes_dashboard"

# Start fresh
cd /path/to/app && python3 -m streamlit run hermes_dashboard.py --server.port 8501 --server.headless true
```

## Dependencies

```
streamlit>=1.30
requests>=2.25
```

## Pitfalls

### Critical

- **⚠️ St.radio with Chinese labels** — When using `st.radio` with Chinese display labels (e.g. `["标准","反向","对比"]`), `st.session_state` stores the Chinese string, not an English key. You MUST use a mapping dict:
  ```python
  mode_map={"标准":"normal","反向":"reverse","对比":"compare"}
  cur_mode=st.session_state.get("mode","normal")
  cur_label=[k for k,v in mode_map.items() if v==cur_mode][0]
  m=st.radio("模式",["标准","反向","对比"],horizontal=True,label_visibility="collapsed",
             index=["标准","反向","对比"].index(cur_label),key="mode_sel")
  st.session_state.mode=mode_map.get(m,"normal")
  ```
  Never do `["normal","reverse","compare"].index(st.session_state.get("mode","normal"))` — the index lookup will crash with `ValueError`.

- **⚠️ CRITICAL: Currency code vs country code mismatch** — Exchange rate dict stores currency codes ("MXN", "BRL"), NOT country codes ("MX", "BR"). The lookup function `ld(ck)` receives a country code. You MUST map it:
  ```python
  # WRONG — returns None because r["MX"] doesn't exist:
  def ld(ck):
      return 1.0 / r[ck] if r and ck in r else None
  
  # CORRECT — maps MX → MXN first:
  def ld(ck):
      curr = COUNTRIES[ck]["currency"]  # "MX" → "MXN"
      return 1.0 / r[curr] if r and curr in r else None
  ```
  This bug causes "汇率未加载" errors that survive refresh — the API works fine, the lookup just fails silently.

- **Exchange rates can fail** — Use multi-tier fallback strategy, not just retry:
  1. Primary: `open.er-api.com/v6/latest/USD` (retry 2x)
  2. Secondary: `api.frankfurter.dev/latest?from=USD` (retry 2x)
  3. Ultimate fallback: hardcoded approximate rates
     ```python
     FALLBACK_RATES = {"MXN":20.0,"BRL":5.5,"COP":4200,"CLP":950,"ARS":1450,"UYU":42,"CNY":7.3}
     ```
  Without these fallbacks, a flaky API call renders the entire dashboard unusable.

- **Every button needs a unique `key`** — Streamlit auto-generates keys from button text. Two buttons with identical text (e.g. two "🔄 刷新汇率" buttons) cause a full-page crash with no visible error. Always add explicit keys:
  ```python
  if st.button("🔄 刷新汇率", key="ref_calc"):    # calculator
  if st.button("🔄 刷新汇率", key="ref_set"):     # settings
  ```
- **Shipping rates are approximate** — mark as editable in Settings; always let user adjust
- **st.rerun()** — use after state changes (tab switch, save rates) to refresh UI
- **Number input precision** — set `format="%.2f"` on monetary values, `format="%.1f"` on weights
- **Session state init** — all state must be initialized before first render (check `if "key" not in st.session_state`)
- **Status bar overlap** — add `3rem` bottom padding to body to prevent content being hidden by fixed footer
- **Marketplace commission (0.8)** — this is 20% commission. Verify with user if their actual ML commission rate differs by category. IMPORTANT: 0.8 is applied BEFORE subtracting shipping (front_usd × 0.8 - shipping, not front_usd × (0.8 - shipping_ratio))
- **Fade-in animation pattern** — Add CSS fadeIn animation for result containers to improve UX:
  ```css
  .fade { animation: fadeIn 0.15s; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
  ```
- **Toast notification CSS** — For extensions (not Streamlit), position fixed bottom-center with auto-dismiss:
  ```javascript
  function showToast(msg, color) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = `position:fixed;bottom:40px;left:10px;right:10px;background:#1a1a2e;
      color:${color||'#e8e8f0'};padding:5px 8px;border-radius:5px;font-size:10px;
      text-align:center;z-index:999;border:1px solid rgba(255,230,0,0.15)`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
  ```
- **`--server.headless true`** — Add this flag when running Streamlit in background to avoid browser-open attempts: `streamlit run app.py --server.port 8501 --server.headless true`
- **Streamlit startup on slow servers** — Use the system Python directly, not the venv Python. `streamlit` binary at `~/.local/bin/streamlit` calls system Python, while `python3` may be a venv Python without Streamlit installed.
- **Rate table editing** — use st.number_input in expandable sections per country, save to session_state.ship
- ❌ **DO NOT use st.tabs() for country switching** — tabs don't update session_state on click, so only the initially active tab works. Use **buttons** instead:
  ```python
  cos = st.columns(6)
  for i, k in enumerate(COUNTRY_KEYS):
      with cos[i]:
          if st.button(f"{COUNTRIES[k]['flag']} {COUNTRIES[k]['name']}", key=f"ck_{k}"):
              st.session_state["_ck"] = k
              st.rerun()
  ```
- **Input widget key collision** — use f-strings with country code as suffix: `key=f"fp_{ck}"`, `key=f"wt_{ck}"`, `key=f"sr_{ck}"`. Otherwise switching tabs keeps stale values
- **Password change in Settings** — most users don't want this. Ask before adding it. Default: store `master_pwd` in session_state only
- **shipping_cny_kg** — do NOT use a ¥/kg multiplier model. The ML cross-border shipping fee is a **weight-bracket lookup table in USD**, not a per-kg rate
