---
name: chrome-mv3-extension-debug
description: "Debug Chrome Manifest V3 extensions with content script + sidepanel/popup + background service worker architecture — common pitfalls that cause silent failures ('button does nothing', 'unresponsive UI', 'message not received')."
version: 1.1.0
tags: [chrome-extension, manifest-v3, csp, content-script, side-panel, message-passing, debugging, dom-scraping, regex, dynamic-content, multi-fallback]
---

# Chrome MV3 Extension Debugging

Common pitfalls and fixes for multi-component MV3 extensions (content script + sidepanel/popup + background service worker).

## Trigger Conditions

Use this skill when:

- A Chrome extension's button/UI does nothing when clicked (no console error, no visual change)
- Content script doesn't seem to run on matched pages
- Message passing between components fails silently
- `chrome.runtime.lastError` with "Could not establish connection" or "Receiving end does not exist"
- Sidepanel/popup buttons work when tested inline but fail in production
- User reports "毫无反应" (no response at all) to extension UI interactions
- New MV3 extension being built for the first time

## Architecture Overview

MV3 extensions have three layers that communicate:

```
Service Worker (background.js)
    ↕ chrome.runtime.sendMessage / onMessage
    ↕ chrome.tabs.sendMessage (to content scripts)
Sidepanel/Popup ←→ Content Script (injected in tab)
    ↕ chrome.tabs.sendMessage (sidepanel→content)
    ↕ chrome.runtime.sendMessage (sidepanel→background)
```

## Common Pitfall #1: CSP blocks inline event handlers

**The #1 cause of "button does nothing".**

In MV3, extension pages (sidepanel.html, popup.html) have a strict Content Security Policy:
```
script-src 'self'; object-src 'self';
```

This BLOCKS all inline event handlers: `onclick`, `onchange`, `onmouseover`, etc.

### ❌ WRONG (silently ignored):
```html
<button onclick="myFunction()">Click</button>
```

### ✅ CORRECT:
```html
<button id="myButton">Click</button>
<script src="popup.js"></script>
```

```javascript
// popup.js
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('myButton').addEventListener('click', myFunction);
});
```

**Debug tip:** Open DevTools for the sidepanel/popup (right-click → Inspect). If the button element exists but clicking does nothing and there's no JS error, this is almost certainly the cause.

## Common Pitfall #2: Content script not injecting

### Check manifest content_scripts matches:
```json
"content_scripts": [{
    "matches": ["https://*.example.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
}]
```

**Critical:** `*.example.com/*` requires a subdomain (e.g., `www.example.com`). It does NOT match bare `example.com`. If the site sometimes loads without www, add a separate match entry:
```json
"matches": [
    "https://*.example.com/*",
    "https://example.com/*"
]
```

### URL product ID format mismatch — silent failure

When extracting product IDs from URLs via regex, different URL formats cause regexes to fail silently even when the extension IS injected and runs.

**Real-world example — Mercado Libre URL formats:**

| URL | ID Format | Regex That Fails | Why |
|-----|-----------|------------------|-----|
| `/MLM-1234567890` | `MLM-1234567890` | `(ML[A-Z]{2}-?\d+)` | Works ✅ |
| `/p/MLM21147485` | `MLM21147485` | `(ML[A-Z]{2}-?\d+)` | Fails ❌ — `[A-Z]{2}` expects 2 letters after ML, but `MLM21147485` has only 1 letter (M) then digits |

**Solution — use multiple fallback patterns:**
```javascript
function extractItemId() {
    return (location.href.match(/\/p\/(ML[A-Z]+\d+)/)||[])[1] ||  // /p/MLM21147485
           (location.href.match(/(ML[A-Z]{2}-?\d{5,})/i)||[])[1] || // MLM-1234567890
           (location.href.match(/(ML\w{10,})/i)||[])[1] ||         // fallback
           '';
}
```

### Debug tip for empty extraction fields
If `tabs.sendMessage` gets a response but `.field` is null/undefined, the **extraction regex or DOM selector is wrong** — not the message passing. Check:
1. `console.log('[EXT] page URL:', location.href)` to confirm the actual URL
2. Test the regex manually on the console
3. Check if DOM selectors match the actual page structure (sites with dynamic rendering may serve different HTML structure)

### Check for CSP on the page itself:
Some sites (like Mercado Libre) return a bot-detection error page that doesn't match your URL pattern, causing content_scripts to not inject.

### Verify injection via console:
Look for any console.log from your content script. In headless testing, content scripts run in ISOLATED worlds — `window.__myFlag` set by the content script is NOT visible in `page.evaluate()` (main world).

## Common Pitfall #3: Message passing confusion

MV3 has TWO message passing APIs:

| API | Purpose | Used between |
|-----|---------|-------------|
| `chrome.runtime.sendMessage` | Extension-wide broadcast | sidepanel ↔ background, content ↔ background |
| `chrome.tabs.sendMessage(tabId, ...)` | Specific tab's content scripts | sidepanel/popup → content script in a tab |

### ❌ Wrong: Sending to content script via `runtime.sendMessage`:
```javascript
// sidepanel.js — WRONG, content script won't receive this
chrome.runtime.sendMessage({ action: 'scrape' });
```

### ✅ Correct: Use `tabs.sendMessage` with tab ID:
```javascript
// sidepanel.js — CORRECT
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
chrome.tabs.sendMessage(tab.id, { action: 'scrape_ml' }, (resp) => {
    if (chrome.runtime.lastError) {
        // Content script not available — inject fallback
        console.log('Error:', chrome.runtime.lastError.message);
        return;
    }
    // resp contains data from content script's sendResponse(data)
});
```

### Content script must return `true` for async responses:
```javascript
// content.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'scrape') {
        const data = extractData();
        sendResponse(data);  // Send the data back
        return true;         // IMPORTANT: keeps channel open for async response
    }
});
```

If you don't `return true`, `sendResponse` fires but the channel closes immediately and the caller never gets the response.

## Common Pitfall #4: activeTab permission limitations

`activeTab` grants temporary access to the current tab when the user "invokes" the extension:
- Clicking the extension action icon ✅
- Using a keyboard shortcut ✅
- Using a context menu item ✅

**BUT** opening the sidepanel programmatically via `chrome.sidePanel.open()` does NOT count as a user gesture for all API calls.

### What activeTab allows:
- `chrome.tabs.sendMessage(tabId, ...)` ✅ (most reliable)
- `chrome.scripting.executeScript(...)` ✅ (usually works after icon click)
- `tab.url` access ✅

### Fallback strategy when content script not responding:
```javascript
async function injectAndScrape(tab) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content.js']
        });
        // Wait a beat for script to initialize
        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, (resp) => {
                if (resp) displayResult(resp);
            });
        }, 500);
    } catch(e) {
        console.error('Injection failed:', e);
    }
}
```

## Common Pitfall #6: Dynamic DOM — content script responds but with empty/null data

This is **especially subtle**: the message passes correctly, no errors, but the response has zeroes/null/empty strings for extraction fields. The user sees "采集无数据返回" or similar.

### Root cause: extraction timing vs DOM rendering

Sites with JavaScript-rendered UI (React, Vue, etc.) may not have the data in the DOM when the content script runs, even at `document_idle`. The content script finds empty selectors and returns zeros.

### Solution: poll for content before extracting in message listener

```javascript
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'scrape') {
        // Poll for price + title to be available
        let attempts = 0;
        const MAX_ATTEMPTS = 20; // ~10 seconds at 500ms intervals
        function poll() {
            const price = extractPrice();
            const title = extractTitle();
            if ((price > 0 && title) || attempts >= MAX_ATTEMPTS) {
                const data = scrapeAll();
                sendResponse(data);
                return;
            }
            attempts++;
            setTimeout(poll, 500);
        }
        setTimeout(poll, 300);
        return true; // keep channel open for async sendResponse
    }
});
```

**Gotcha:** The polling condition is critical. The check `t !== document.title` can fail if the page's h1 matches the exact document.title text. On sites like ML, `document.title` is "Product Name | Mercado Libre" while `h1` is just "Product Name", so the check works — but this is site-specific.

### Fix: use broader response acceptance check

Don't require `resp.ml_item_id` to be truthy — accept `resp.title` or any field as well. This prevents the `❌ 采集无数据返回` error when the item ID is missing but other data exists:

```javascript
// ❌ Fragile — fails if ml_item_id is empty
if (resp && resp.ml_item_id) { displayResult(resp); }

// ✅ Robust — accepts any scraped data
if (resp && (resp.ml_item_id || resp.title || resp.price > 0)) {
    displayResult(resp);
}
```

### Fix: simplify — skip page type detection, always extract

The most robust approach for a scraper extension: **remove all `isDetailPage()` / `isSearchPage()` guards** and just extract what's available. If the page isn't a detail page, some fields will be empty but the message will still flow:

```javascript
// BAD: conditionally responds, blocking data flow
if (isDetailPage()) {
    sendResponse(scrapeDetail());
} else {
    sendResponse({ error: 'not a detail page' }); // ❌ sidepanel gets empty data
}

// GOOD: always respond with whatever is available
sendResponse(scrapeWhateverIsAvailable()); // ✅ sidepanel can display partial results
```

## Common Pitfall #9: Silent IIFE crash with guard preventing recovery

**Devastating pattern — the #1 cause of "注入后仍失败" after a reload.**

When you use a guard pattern in a content script IIFE:
```javascript
(function(){
    if (window.__injected) return;   // ⚠️ If crash happens AFTER this line
    window.__injected = true;         //    the guard is SET but listener is NOT
    // ... extraction functions ...
    chrome.runtime.onMessage.addListener(...) // ❌ Never reached
})();
```

If ANY code between `window.__injected = true` and the listener registration throws, the listener never gets registered. On re-injection (e.g., via `scripting.executeScript` as a fallback), the IIFE immediately returns because `window.__injected` is already `true`. The extension is **permanently dead** until the extension is reloaded or the tab is refreshed.

### Common silent crash triggers:
- **Invalid CSS selector** — `querySelector(':contains("text")')` throws `SyntaxError` because `:contains` is jQuery-only
- **Regex syntax error** — `new RegExp('(ML[A-Z')` throws
- **Fetching missing DOM** — `document.querySelector(null)` returns null (safe), but `null.textContent` throws
- **setTimeout/setInterval with string eval** — not allowed in MV3 content scripts

### ✅ Fix: wrap IIFE in try/catch that resets guard on error

```javascript
(function(){
    'use strict';
    try {
        if (window.__injected) return;
        window.__injected = true;

        // ... ALL code here ...

        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            // ...
        });

    } catch(e) {
        console.error('[EXT] init error, resetting guard:', e);
        window.__injected = false;  // 🔑 Allow re-injection to retry
    }
})();
```

This way, if anything goes wrong during initialization, `window.__injected` is reset to `false`, allowing the fallback `scripting.executeScript` to re-run the full IIFE and register the listener.

### Defense in depth: also wrap each extraction function
For extra robustness, wrap individual extraction functions in try/catch so one bad selector doesn't crash the whole script:

```javascript
function extractPrice() {
    try {
        return parseFloat(document.querySelector('.price').textContent) || 0;
    } catch(e) {
        return 0;  // Graceful fallback
    }
}
```

### Debug tip: detect this state
If you're getting "注入后仍失败" or "Could not establish connection" despite the extension being loaded:
1. Open the target page's DevTools → Console
2. Type `window.__injected` — if it's `true` but no console.log from your content script appears, the script crashed during init
3. Check for JS errors in the page's Console tab (content script errors DO show here)

## Common Pitfall #7: Multi-layer message chain failures

When data must flow through multiple layers (content → sidepanel → background → backend API), failures in any layer cause silent data loss.

### The chain:
```
Content script → [tabs.sendMessage] → Sidepanel callback → [runtime.sendMessage] → Background → [fetch] → Backend API
```

### Failure points:

| Layer | Failure | Symptom |
|-------|---------|---------|
| Content → Sidepanel | Content script not responding | `chrome.runtime.lastError` in sidepanel |
| Sidepanel → Background | Background service worker not running | Message silently lost |
| Background → Backend | CORS, network error, backend down | Console error in service worker |

### Robust multi-fallback strategy:

```javascript
// sidepanel.js — primary path with fallback
async function scrapeCurrentML() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Path 1: try messaging content script (injected via manifest)
    chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, resp => {
        if (chrome.runtime.lastError) {
            // Path 2: inject via executeScript then retry
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content.js']
            });
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, resp2 => {
                    if (resp2) displayResult(resp2);
                });
            }, 500);
            return;
        }
        if (resp && (resp.id || resp.title)) {
            displayResult(resp);
            // Forward to background for backend sync
            chrome.runtime.sendMessage({ action: 'data_collected', data: resp });
        }
    });
}
```

Content scripts injected via manifest `content_scripts` or `scripting.executeScript` run in an **isolated world**. This means:

- `window.__fvvInjected = true` set by content script is NOT visible to the page's JavaScript
- `page.evaluate(() => window.__fvvInjected)` in Puppeteer returns `undefined`
- DOM manipulation from content script IS visible (modifies actual DOM)
- `chrome.runtime` API is available in content script but NOT in page context

This is by design — it prevents the page from interfering with the extension.

## Testing Tips

### End-to-end test with Puppeteer:
```javascript
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({
    headless: 'shell',  // 'new' supports extensions in newer Chrome
    args: [
        `--load-extension=/path/to/extension`,
        `--disable-extensions-except=/path/to/extension`,
    ]
});
```

### Check background service worker:
In `chrome://extensions` → find extension → click "Service Worker" link to open DevTools for the background script. Check Console tab for errors.

### Check content script execution:
Open the target page's DevTools → Console tab. If your content script does `console.log('[EXT] injected')`, you should see it. If not, the content script wasn't injected.

## Common Pitfall #8: Cross-component API integration failures (extension ↔ backend)

When an extension calls a backend API (e.g., for pricing, listing, or data storage), the failure often manifests as **silent data loss** — the extension's UI shows success but the data never reaches the backend, or the backend returns an error that's swallowed by `.catch(()=>{})`.

### Root cause: mismatched field names and endpoints

The extension's sidepanel and the backend API are often developed separately. Common mismatches:

| Extension sends | Backend expects | Result |
|----------------|-----------------|--------|
| `price` | `sourcing_cny` | 400 error or wrong calculation |
| `shipping_cost` | `freight_fee_cny` | Wrong field ignored |
| `cross_border_rate` | Built-in via `get_ship_fee()` | Redundant input, user confused |
| POST to `/api/listings` | POST to `/api/listings/create` | 404 Not Found |

### Prevention: always verify API contract before coding

```javascript
// 1. Check backend endpoints FIRST before writing extension code:
// curl -X POST http://localhost:8649/api/pricing/calculate -H 'Content-Type: application/json' -d '{"sourcing_cny":50,"weight_kg":0.5}'

// 2. Log the full request payload and response for debugging:
async function callApi(endpoint, payload) {
    console.log('[API REQ]', endpoint, JSON.stringify(payload));
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await resp.json();
    console.log('[API RES]', JSON.stringify(result));
    return result;
}
```

### Response format mismatch

Backend APIs often return results in nested structures (e.g., array of per-site results). Don't assume flat response:

```javascript
// ❌ Wrong: assuming flat response
document.getElementById('resultProfit').textContent = result.profit_mxn;

// ✅ Correct: navigate response structure
const siteResult = result.results?.find(r => r.site_id === siteId) || result.results?.[0];
document.getElementById('resultProfit').textContent = siteResult?.profit_cny + ' CNY';
```

### Frontend-backend duplicate logic removal

If the backend already calculates something (shipping fees, exchange rates, commission), don't let the frontend also ask for it — remove those fields from the HTML form entirely. This reduces user confusion and eliminates stale input bugs.

### Debug workflow for API issues:

1. **Test the backend API directly** (curl or browser) before wiring the extension
2. Check the `result.results` array structure — it's likely `[{site_id, sale_local, cost_cny, margin_pct, ...}]`
3. Look at the API router definition (`@router.post("/create")` vs `@router.post("")`) — the path suffix matters
4. Enable verbose console logging on both sides: extension sidepanel + backend

## Quick Troubleshooting Flow

```
Extension UI button does nothing
  │
  ├─① Check if inline onclick in HTML? → Move to addEventListener
  │
  ├─② Check content script injection
  │  Open Chrome DevTools on target page
  │  Look for content script console logs
  │  If not found: check manifest matches patterns
  │
  ├─③ Check message passing
  │  Use console.log in content script listener
  │  Check if tabs.sendMessage or runtime.sendMessage is correct API
  │  Check if content script returns true from listener
  │
  ├─④ Check permissions
  │  manifest permissions: activeTab, scripting, sidePanel
  │  host_permissions: https://target-site.com/*
  │
  └─⑤ Check background service worker
     Open extension's Service Worker DevTools
     Look for uncaught errors or failed fetch calls
```
