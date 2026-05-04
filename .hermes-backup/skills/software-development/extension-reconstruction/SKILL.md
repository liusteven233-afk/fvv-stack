---
name: extension-reconstruction
description: Rebuild/clean-room-reconstruct Chrome extensions from existing ones — strip auth, replace external APIs, integrate local data, rebuild MV3 manifest
version: 1.0.0
author: Hermes Agent
tags: [chrome, extension, mv3, reconstruction, reverse-engineering, clean-room]

---

# Extension Reconstruction

Reconstruct a Chrome extension from an existing codebase. Use when the user wants to take an existing extension, strip bloat/auth/external dependencies, and rebuild it clean.

## When to Use

- User has a `.crx`, unpacked extension, or source code they want cleaned up
- Extension has: auth/license system, external API dependency, or bloated third-party services
- Goal is a self-contained version with direct API calls and local data instead of remote services

## Workflow

### Phase 1 — Analyze

1. **Read `manifest.json` first** — it's the architecture map:
   - `background.service_worker` → backend message handlers
   - `content_scripts[].js` → what runs on each page
   - `permissions` + `host_permissions` → what external services it touches
   - `side_panel`, `action`, `web_accessible_resources` → UI surface

2. **Read `custom-background.js` (or equivalent service worker)**:
   - Identify ALL message types (`msgType`, `type` fields)
   - Map each to its external API endpoint
   - Note any auth/signing logic (MD5, SHA, tokens, timestamps)

3. **Read `my-auth-bootstrap.js` (or equivalent auth file)** — identify:
   - Remote control URLs (GitHub Gist, etc.) — attacker can change behavior remotely
   - Hardcoded SUPER_TOKENs or license keys
   - Install ID / device fingerprinting
   - Self-destruct mechanisms
   - Trial/expiry logic
   - Periodic refresh polling

4. **Identify external API dependencies**:
   - `erp.genzhemai.com`, custom backends → need replacement
   - `api.mercadolibre.com`, `api.github.com` → can call directly
   - `open.er-api.com` → free alternatives exist

### Phase 2 — Strip

1. **Remove auth files entirely**: `my-auth-bootstrap.js`, `auth/*.js`
2. **Remove obfuscated content scripts** (>50KB+ obfuscated = usually auth/bloat)
3. **Remove license gates from UI**: sidepanel, popup, calculator HTML
4. **Remove all `king_*`, `mkd_*` localStorage/chrome.storage keys**

5. **Replace external API calls in background.js**:
   - Instead of `erp.genzhemai.com/api/spider/mercado/product/infos` → call `api.mercadolibre.com/items?ids=`
   - Instead of custom MD5-signed requests → use public APIs or no auth
   - Instead of private exchange rate API → use `open.er-api.com/v6/latest/USD`

6. **Replace content script data sources**:
   - `productDataService.js` → change `chrome.runtime.sendMessage` to query new background handlers
   - Update `collectStatusManager.js` to use clean storage keys

### Phase 3 — Rebuild

1. **New `manifest.json`** — remove:
   - Old host_permissions to private servers
   - `web_accessible_resources` pointing to auth pages
   - `sandbox` pages if not needed
   - `content_security_policy` customizations (only if sandbox needed)

2. **New `background.js`** — structure:
   ```js
   // Direct API calls for each message type
   chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
     if (msg.msgType === "GET_PRODUCT_DATA") {
       // Call public API, not private backend
       fetch("https://public-api.example.com/items?ids=" + skus)
         .then(r => r.json())
         .then(data => sendResponse({ data }))
         .catch(() => sendResponse({ data: fallback }));
       return true;
     }
   });
   ```

3. **New `lib/pricing.js`** — integrate user's known-good data:
   - Ship the shipping rate tables as compact JS arrays `[max_kg, high_price, low_price]`
   - Build the profit calculation function inline
   - Use `chrome.storage.local` for user-configurable params

4. **UI files (sidepanel/popup)** — remove:
   - Login/authorization gates
   - License key inputs
   - Trial countdowns
   - Status indicators for "blocked/revoked"

### Phase 4 — Verify

1. **File integrity**: Every `.js`/`.css` path in manifest.json must exist
2. **No auth residues**: `grep -rn "king_\|license\|revok\|self.destruct\|SUPER_TOKEN\|erp\.genzhemai" .`
3. **No old plugin names**: `grep -rn "宇宙无敌\|dff\|oldPluginName" .`
4. **Pricing math**: Verify profit calculation formula matches user's expectations
5. **Cross-file references**: All `chrome.runtime.sendMessage` msgTypes must have matching handlers in background.js

## Mercado Libre / Cross-Border E-commerce Patterns

ML (Mercado Libre) extensions have specific architecture patterns worth knowing:

### ML Page Data Sources

| Data | Source | Available Without ERP? |
|------|--------|----------------------|
| SKU | URL regex: `wid=(ML[A-Z]{3}\d+)` / `(ML[A-Z]{3}-\d+)` / `/p/(ML[A-Z]{3}\d+)` | ✅ Yes |
| Sold quantity | DOM text parsing (Spanish/Portuguese: "vendidos", "venta", "unidades") + ML API | ✅ Yes (`api.mercadolibre.com/items?ids=`) |
| Seller name/ID/reputation | `__PRELOADED_STATE__` script tag in page HTML | ✅ Yes |
| Stock | `__PRELOADED_STATE__` → `available_quantity.picker.description` | ✅ Yes |
| Warehouse type (cross-border/local) | DOM `.poly-component__cbt` text = "COMPRA INTERNACIONAL" → 1 | ✅ Yes |
| Price | DOM `.andes-money-amount__fraction` | ✅ Yes |
| **Weight** | **Not available from ML page or API** | ❌ No — show as `—`, let user input |
| **Commission rate** | Per-category, not exposed on page | ❌ No — use configurable default |

**Key insight**: The original plugin's ERP API was the only source for weight and commission. After stripping, these fields show blank. Either:
- Accept the gap and use defaults/placeholders
- Add configurable fields in a settings panel (sidepanel/popup)

### ML Content Script Injection

ML extensions typically inject into **two page types**:

1. **Search / listing pages** (`mercadolibre.com/*`):
   - Parse `__NORDIC_RENDERING_CTX__` script tag for product IDs (SKU list)
   - Enhance each `.ui-search-layout__item` card with data overlay
   - Common page layouts: `pageA` (`.andes-card`), `pageB` (bare `<div>`)
   - DOM detection: `.ui-search-layout > .ui-search-layout__item .andes-card`

2. **Detail pages** (`mercadolibre.com/MLA-XXXXXX` or `/p/MLXXXXXX`):
   - Parse `__PRELOADED_STATE__` for full product data
   - Inject into `.ui-pdp-container`
   - Extract: seller name, stock, sales, warehouse type, reputation

### ML API Details

```js
// Batch fetch items (max 20 per request)
fetch("https://api.mercadolibre.com/items?ids=MLA123,MLB456,MLC789")
  .then(r => r.json())
  .then(items => items.forEach(item => {
    if (item.code === 200) {
      // item.body.id, item.body.sold_quantity, item.body.price,
      // item.body.available_quantity, item.body.currency_id,
      // item.body.seller_id, item.body.title, item.body.thumbnail
    }
  }));
```

### Collect Button Pattern

The "采集" (collect) button is a standard UI element in ML extensions:

1. **Storage**: `chrome.storage.local` with key `KRIS_COLLECTED_SKUS` (array of collected SKU strings)
2. **Button states**: "采集" → "采集..." (loading) → "已采集" (green, disabled)
3. **Badge**: Green "已采集" badge shown on already-collected items on page load
4. **Re-check**: On card enhancement, check all visible SKUs against stored set
5. **Clear**: Sidepanel/popup has "清空采集记录" button

### Pricing Engine Integration

The pricing engine for ML extensions needs:

1. **Shipping rates**: Embed as compact JS arrays in `lib/pricing.js`:
   ```js
   var KRIS_SHIPPING = {
     "墨西哥": [ [0.1, 4.0, 1.7], [0.2, 5.4, 2.1], ... ],
     "巴西":   [ [0.1, 5.1, 1.7], [0.2, 6.2, 2.4], ... ],
   };
   // Format: [max_kg, high_tier_price, low_tier_price]
   ```

2. **Site metadata**: Country, flag, currency, free-shipping threshold, default rate

3. **Profit formula** (reusable):

## Profit Calculation Formula (reusable)

```
trueNetUsd   = (targetProfitRmb + costRmb) / usdToRmbRate
salePrice    = (trueNetUsd + shippingUsd) / (1 - commissionRate)
shipSubsidy  = shippingUsd * (1 - subsidyRate)  // when price >= threshold
commission   = salePrice * commissionRate
netActualUsd = salePrice - commission - actualShipping
settlementRmb = netActualUsd * usdToRmbRate
netProfitRmb = settlementRmb - costRmb
margin       = netProfitRmb / costRmb * 100
```

## Pitfalls

- **Don't just strip — verify UI elements**: After removing auth/ERP, check that ALL expected UI elements still exist. The user expects collect buttons, profit panels, settings, popup windows. Make a checklist of UI surface areas from the original.
- **Test the popup window early**: Add `"default_popup": "popup/popup.html"` to manifest.json `action`. `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` conflicts with popups — pick one.
- **Template buttons are easy to miss**: The "采集" (collect), "找货" (find goods), "计算" (calculate) buttons are in `template.js`, not in content scripts. If you simplify the template, you lose features. Check the original template for ALL `data-action` buttons before rewriting.
- **Obfuscated files**: If a JS file is 50KB+ and unreadable, it's probably auth/analytics/tracking. Delete it and rebuild the functionality cleanly.
- **Auth injected via content_scripts**: Look for scripts injected into ALL pages (not just specific URLs) — those are often the auth checkers.
- **Remote control via GitHub Gist**: If the auth system fetches from `gist.githubusercontent.com`, it's a kill-switch. The developer can revoke you anytime. Strip completely.
- **Periodic auth refresh**: `setInterval` in background or auth files checking a remote URL every 10min = remote kill capability.
- **Self-destruct**: If `localStorage.setItem('self_destruct','1')` exists, auth failure can wipe extension data.
- **Hardcoded tokens**: `SUPER_TOKEN`, API keys in plaintext JS — delete, the user's extension shouldn't ship third-party secrets.
- **Ship the shipping tables inline** in the JS, not as external HTTP fetches. The rates change infrequently and user controls them.

## Related Skills

- `chrome-mv3-extension-debug` — debugging MV3 extensions if issues arise after reconstruction
- `hermes-dashboard-extension-sync` — sync maintenance between dashboard and extension

## Reference Files

- `references/cainiao-shipping-ml.md` — Cainiao 6-country shipping rate tables (Mexico, Brazil, Argentina, Chile, Colombia, Uruguay) in compact JS array format. Load this when building a ML cross-border pricing engine.
