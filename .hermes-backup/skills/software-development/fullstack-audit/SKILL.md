---
name: fullstack-audit
description: "Systematically test a multi-component full-stack application for bugs, logic errors, and integration issues — backend APIs, frontend code, browser extensions, and data flow."
version: 1.2.0
metadata:
  hermes:
    tags: [qa, testing, audit, fullstack, bug-hunt, code-review]
    related_skills: [dogfood, requesting-code-review, systematic-debugging, subagent-driven-development]
---

# Full-Stack System Audit (Bug Hunt)

## Overview

Proactively test a running multi-component application for bugs, logical errors, and integration issues. This is **not** a browser-only QA check (`dogfood`) nor a pre-commit diff review (`requesting-code-review`) — it covers backend APIs, frontend UI code, browser extensions, and the data flow between them.

**Core method:** Decompose the system into components, test each in parallel via `delegate_task`, then verify integration.

## When to Use

- User asks "检查bug" / "检查逻辑错误" / "test all components for bugs"
- After building or deploying a new multi-component system (backend + frontend + extension)
- After major refactoring of a full-stack app
- When investigating "为什么不行" / "why isn't it working" with an unknown cause

**Skip for:** Single-file scripts, documentation-only changes, minor frontend-only CSS tweaks.

## Workflow

### Phase 1 — Component Inventory

Identify the components of the system. Common breakdown:

| Component | What to test | How |
|-----------|-------------|-----|
| **Backend API** | All REST endpoints — health, CRUD, edge cases, error handling | curl / httpx against the running server |
| **Frontend/Dashboard** | Static code review — API calls, error handling, UX logic | Read source code, trace API call paths |
| **Browser Extension** | Content scripts, background service worker, message passing, manifest | Read source code, verify cross-file message flow |
| **Integration** | Data flowing through the whole chain | End-to-end data write + read test |

### Phase 2 — Decompose and Distribute (Parallel)

Use `delegate_task` to review components in parallel. Each reviewer gets:

1. The exact file paths to read
2. The API endpoints to test (if applicable)
3. The specific aspects to check
4. The running service URL (if applicable)

Example decomposition prompt pattern:

```
Task: Review [component] for bugs
Files: [file paths]
Running at: [URL if applicable]
Check for: [specific concerns - API routes, error handling, domain logic, etc.]
Report: ALL bugs found with file:line references and severity
```

**Best practice:** Give each reviewer a focused scope. Don't ask one agent to review everything.

### Phase 3 — Backend API Testing

For each API endpoint, test:

1. **Health/liveness** — does the root/health endpoint respond?
2. **Happy path** — send valid data, confirm proper 200 response with correct structure
3. **Missing required fields** — omit required fields, expect 4xx (not 500)
4. **Invalid data** — send wrong types, expect 4xx
5. **Duplicate data** — if unique constraints exist, expect proper 409 Conflict (not 500)
6. **Boundary values** — empty strings, zero, negative numbers, very long strings
7. **Nonexistent resources** — query with non-existent IDs, expect 404

Key red flags:
- **500 errors** on bad input → missing input validation or `data["key"]` instead of `data.get("key")`
- **Silent failures** → empty responses with 200 instead of proper error codes
- **Generic `except Exception`** that hides the real error
- **No foreign key validation** — creating records that reference non-existent parent records
- **Enum/mode mismatch** — frontend sends `sale_margin` but backend only accepts `sale_price`. Cross-check option values between frontend select/radio UIs and backend validation.
- **Query param vs body** — `description: str` in FastAPI reads as query param by default. Use `Body(...)` for request body parameters.

### Phase 4 — Frontend/Dashboard Code Review

For web-based UIs (Streamlit, React, etc.):

1. **API endpoint correctness** — do the frontend API call paths match the actual backend routes?
2. **Error handling** — what happens when the backend is down? Are errors shown to the user or swallowed?
3. **Silent failures** — do save/submit operations have `else: st.error()` / error display branches?
4. **Hardcoded values** — account_id=1, currency="MXN", etc. that should be dynamic
5. **Widget/state management** — session_state keys, rerun logic, widget key uniqueness
6. **Form validation** — missing field checks before submission
7. **DOM/rendering** — Element IDs referenced in JS that don't exist in HTML
8. **`st.stop()` causing blank UI** — When API is offline, `st.stop()` halts ALL rendering, leaving a blank page with sidebar. Replace with graceful degradation: show warning + `st.rerun()` to auto-retry.
9. **Falsy-zero confusion** — `0 || '?'` evaluates to `'?'` because 0 is falsy. For numeric displays, use `??` (nullish coalescing): `value ?? fallback` instead of `value || fallback`.
10. **Silent API error swallowing** — Check all `api_get`/`api_post` wrappers: if they return `None` on any error (bare `except:`), all backend error messages are lost. Show toast/error with the actual error detail.
11. **Pricing/domain mode name mismatch** — Frontend selects (dropdowns, radio buttons) that send mode/type values must match what the backend `VALID_MODES` list accepts. Cross-check every option pair. Common failure: frontend sends `sale_margin` but backend only accepts `sale_price`. Check both dashboard Python selects AND extension HTML `<select>` options.
12. **Multiple hardcoded `currency` locations** — Currency is often hardcoded in: Dashboard listing form (`"MXN"`), extension sidepanel JS (`currency: 'MXN'`), content scraper search results (`currency: 'MXN'`). All must derive from `site_id` (MLM→MXN, MLB→BRL, MLC→CLP, etc.). Create a shared mapping and use it everywhere.
13. **Account ID hardcoded to 1** — Dashboard and extension often have `account_id: 1` for listing creation. Fetch accounts from `/api/ml/auth/accounts` and add a dropdown selector. Consider this a P1 bug for multi-account users.

### Phase 5 — Browser Extension Code Review

For Chrome MV3 extensions:

1. **manifest.json** — correct permissions, all referenced files exist, sidePanel / host_permissions
2. **Background service worker** — message passing, `.catch()` on all `chrome.runtime.sendMessage` calls
3. **Content scripts** — DOM selectors for target sites, error handling for missing elements, race conditions with SPA content loading
4. **Message passing** — verify all message actions are consistent across files (background.js ↔ sidepanel.js ↔ ml_scraper.js)
5. **Hardcoded values** — account_id, currency, API_URL that should be dynamic
6. **Undefined tab/port** — `chrome.tabs.query()` may return empty array → `tab.id` crash
7. **DOM selector fragility** — Target sites (especially SPAs like Mercado Libre) change CSS classes frequently. Content scripts MUST use multi-level fallback selectors for each data field. Pattern:
   ```javascript
   // WRONG — single fragile class
   const price = document.querySelector('.andes-money-amount__fraction');
   // RIGHT — multiple fallbacks
   function qs(selectors) {
     for (const s of selectors) {
       const el = document.querySelector(s);
       if (el) return el;
     }
     return null;
   }
   const priceEl = qs([
     '.andes-money-amount__fraction',
     '[data-testid="price-value"]',
     'meta[property="product:price:amount"]',
     '[class*="price-tag-fraction"]'
   ]);
   ```
8. **SPA content race conditions** — Fixed `setTimeout` for auto-scraping is unreliable on heavy SPAs. Use polling instead:
   ```javascript
   // WRONG — fixed timeout, may miss dynamic content
   setTimeout(() => scrapeDetail(), 2000);
   // RIGHT — poll until content loaded, max wait 10s
   function waitForContent(callback, maxWait = 10000) {
     const start = Date.now();
     const check = () => {
       const title = document.querySelector('h1')?.textContent;
       if (title && title !== document.title) { callback(); return; }
       if (Date.now() - start > maxWait) { callback(); return; }
       setTimeout(check, 500);
     };
     setTimeout(check, 500);
   }
   ```
9. **`chrome.runtime.sendMessage` error handling in content scripts** — In MV3, content script's `chrome.runtime.sendMessage` returns a Promise. Always attach `.catch(() => {})` to prevent unhandled rejection when the extension context closes.
10. **Sidepanel ↔ content script tab query** — `chrome.tabs.query({ active: true })` from the sidepanel may return empty array (e.g., sidepanel opened in a popup window or DevTools panel). Always null-check `tab` before accessing `tab.id`.

11. **`tabs.sendMessage` silent failure pattern** — When the sidepanel calls `chrome.tabs.sendMessage(tabId, msg, callback)`, a missing content script will silently produce `chrome.runtime.lastError` (not a thrown exception). The callback fires with `chrome.runtime.lastError` set. Correct pattern: always check `chrome.runtime.lastError` in the callback AND have a fallback. Use `tabs.sendMessage` FIRST (content script may already be injected via manifest), then fall back to `scripting.executeScript` on failure:
    ```javascript
    // In sidepanel.js — correct two-step pattern
    function sendScrapeMessage(tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'scrape_ml' }, resp => {
        const err = chrome.runtime.lastError;
        if (err) {
          // Content script not injected yet — inject manually
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/inject_scraper.js'],
          }).then(() => {
            // Retry after injection
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'scrape_ml' }, resp2 => {
                if (resp2) handleResponse(resp2);
              });
            }, 500);
          }).catch(e => showError('注入失败: ' + e.message));
          return;
        }
        if (resp) handleResponse(resp);
      });
    }
    ```

12. **MV3 CSP blocks inline event handlers in extension pages** — Chrome Manifest V3 extensions have a strict Content Security Policy that **silently ignores** inline `onclick`, `onchange`, `onsubmit`, etc. attributes in `.html` files. This is the single most common cause of "button does nothing" bugs:
    ```html
    <!-- ❌ BROKEN in MV3 — silently ignored -->
    <button class="btn-gold" onclick="scrapeCurrentML()">采集</button>
    ```
    ```html
    <!-- ✅ CORRECT: add an id and bind via addEventListener in the .js file -->
    <button class="btn-gold" id="btnScrapeML">采集</button>
    ```
    ```javascript
    // In sidepanel.js or popup.js:
    document.getElementById('btnScrapeML').addEventListener('click', scrapeCurrentML);
    ```
    Only scripts loaded via `<script src="...">` can execute in MV3 extension pages. This applies to: `sidepanel.html`, `popup.html`, `options.html`, and all other extension pages. The default CSP is `script-src 'self'; object-src 'self'`, which blocks all inline JavaScript.

13. **Content script injection fallback** — Manifest-declared content scripts may fail to inject on SPA pages due to MV3 match pattern quirks or dynamic page navigation. When the user clicks a "collect" button and `chrome.tabs.sendMessage` returns no response, use `chrome.scripting.executeScript` as the primary fallback injection method (note: this is the SECOND attempt after `tabs.sendMessage` fails):
14. **Verify extraction regex against real URL structures, not assumptions** — When extracting IDs or parameters from URLs in content scripts, always test the regex against multiple real URL formats from the target site. Sites change their URL structures over time:
    - Old ML URL: `/MLM-21147485-nombre-producto`
    - New ML URL: `/p/MLM21147485` (different format)
    - Pattern `(ML[A-Z]{2}-?\d+)` matches `MLM-21147485` but NOT `MLM21147485` (just one letter after ML).
    - **Best practice:** log every URL the content script encounters and build regex that covers all observed patterns.
    - For testing, use `console.log('[FVV] URL:', location.href, 'match:', match)` in the content script and check extension logs via `chrome://extensions` → service worker console.
    ```javascript
    // In sidepanel.js — primary injection approach
    async function collectCurrentPage() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      try {
        // Inject the scraper script directly into the page
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['scripts/inject_scraper.js'],
        });
        // Script auto-detects page type and sends data back via runtime message
      } catch (e) {
        // Fallback: content script already injected, send message
        chrome.tabs.sendMessage(tab.id, { action: 'scrape_ml' }, callback);
      }
    }
    ```
    This requires `"scripting"` permission AND `"host_permissions"` for the target domain in manifest.json.

12. **Floating panel ↔ sidepanel communication pattern** — Injected content scripts that display a floating panel on a target page CANNOT directly call sidepanel functions (they're in different contexts). Instead, use a message relay:
    ```
    Floating panel button click
      → chrome.runtime.sendMessage({action:'fvv_open_sidepanel', tab:'pricing', data:productData})
      → background.js receives it
      → chrome.sidePanel.open({ tabId })
      → chrome.storage.local.set({ pending_sidepanel_data: data, pending_sidepanel_tab: 'pricing' })
      → sidepanel.js on load reads chrome.storage.local to get pending data
      → switches to correct tab, fills form with data
    ```
    Pattern for background.js handler:
    ```javascript
    if (msg.action === 'fvv_open_sidepanel' && sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        chrome.storage.local.set({
          pending_sidepanel_data: msg.data,
          pending_sidepanel_tab: msg.tab,
          pending_sidepanel_time: Date.now(),
        });
      }).catch(() => {});
    }
    ```
    Pattern for sidepanel.js consumer:
    ```javascript
    chrome.storage.local.get(['pending_sidepanel_data', 'pending_sidepanel_tab', ...], d => {
      if (d.pending_sidepanel_data && Date.now() - d.pending_sidepanel_time < 30000) {
        // Switch to the requested tab and fill data
        document.querySelector(`[data-tab="${d.pending_sidepanel_tab}"]`)?.click();
        // Fill form fields from data
        chrome.storage.local.remove(['pending_sidepanel_data', ...]);
      }
    });
    ```

13. **Listing date extraction — multi-strategy fallback** — ML and other e-commerce SPAs may embed listing dates in various ways. Use multiple strategies in order of reliability:
    ```javascript
    let listedDate = null;
    // Strategy 1: JSON-LD structured data (most reliable when present)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { const d = JSON.parse(s.textContent); if (d.datePublished) listedDate = d.datePublished; } catch(e) {}
    });
    // Strategy 2: HTML meta tag
    if (!listedDate) {
      const m = document.querySelector('meta[property="product:availability:date"]');
      if (m) listedDate = m.getAttribute('content');
    }
    // Strategy 3: HTML <time> element
    if (!listedDate) {
      const te = document.querySelector('time');
      if (te) listedDate = te.getAttribute('datetime') || te.textContent;
    }
    // Strategy 4: Body text date pattern
    if (!listedDate) {
      const dm = document.body.innerText.match(/(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/);
      if (dm) listedDate = dm[1];
    }
    ```

14. **`run_at` timing for SPA content scripts** — For heavy SPAs (Mercado Libre, 1688, etc.), `document_end` may fire before dynamic content renders. Use `document_idle` instead, which waits until the page is "fully loaded" (after subresources finish). In MV3:
    ```json
    "content_scripts": [{
      "matches": ["https://*.mercadolibre.com.mx/*"],
      "js": ["scripts/inject_scraper.js"],
      "run_at": "document_idle"
    }]
    ```
    Additionally, the content script itself should poll for content rather than relying on a single timeout:
    ```javascript
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      const data = scrapeData();
      if (data.title && data.price > 0) {
        clearInterval(iv);
        showPanel(data);
      } else if (attempts > 20) { // 10 second max wait at 500ms intervals
        clearInterval(iv);
        showPanel(data); // show whatever we got
      }
    }, 500);
    ```
    This handles the case where product data renders asynchronously after the initial page load.

15. **Content script host_permissions for local API** — If the content script directly fetches from a local backend (e.g., `http://127.0.0.1:8649`), the extension MUST include that URL in `host_permissions`:
    ```json
    "host_permissions": [
      "http://127.0.0.1:8649/*"
    ]
    ```
    Without this, content script fetch calls will silently fail due to CORS/protocol violations.

### Phase 6 — Integration Test

After individual component reviews, verify the data flow:

```
Content Script → Message → Background Worker → API Call → Backend → DB
                                  ↓
                         Sidepanel Display
```

Create test data at one end and verify it arrives at the other:
1. Use curl to POST test data to backend API
2. Use curl to GET the same data back via the dashboard's endpoints
3. Verify field values are preserved through the round trip
4. Check for truncation, encoding issues, type coercion

### Phase 7 — Report and Fix

Compile findings by component and severity:

| Severity | Meaning | Examples |
|----------|---------|---------|
| 🔴 **Critical** | Crashes, data corruption, core feature broken | KeyError crash, duplicate data destruction |
| 🟡 **Medium** | Wrong behavior, silent failures, poor UX | Wrong currency, no error feedback |
| 🔵 **Low** | Robustness, edge cases, code smell | Missing null checks, unused variables |

Before fixing: confirm with user. After fixing: re-test the affected endpoints with curl and confirm correct behavior.

**Verify fixes:** After applying each fix, curl the endpoint to confirm:
- Previously broken request now returns correct status code
- Error messages are user-friendly (not raw stack traces)
- Both happy path and error path work as expected

## Pitfalls

- **Timeout on curl tests** — v4/new models may be slow on some providers; increase timeout
- **Static review vs runtime** — code review finds potential bugs, curl tests confirm them
- **Extension can't be loaded in headless mode** — can only review code, not run it,
  unless using headed browser with `chrome://extensions`
- **manifest.json `content_scripts` accidentally removed during simplification** — When debugging or "simplifying" a Chrome extension, it's easy to remove the `content_scripts` entries from `manifest.json` (e.g., thinking they're unnecessary if using `scripting.executeScript`). But without `content_scripts`, the extension NEVER injects into target pages automatically — auto-popup panels, auto-scraping, and any "running in the page" features silently won't work. **Always verify that `content_scripts.js[].matches` includes all target domains** after any manifest edit. Cross-reference with `host_permissions` — both must cover the same domains.
- **Match pattern `*.domain.tld` does NOT match bare `domain.tld`** — In Chrome manifest.json, the pattern `"https://*.mercadolibre.com.mx/*"` matches `www.mercadolibre.com.mx` but NOT `mercadolibre.com.mx` (without a subdomain prefix). Some sites serve content without `www.` prefix. Always include BOTH patterns or use a more permissive match:
  ```json
  // ❌ Misses bare domain
  "matches": ["https://*.mercadolibre.com.mx/*"]
  // ✅ Covers both with and without www
  "matches": ["https://*.mercadolibre.com.mx/*", "https://mercadolibre.com.mx/*"]
  ```
- **delegate_task can't share context** — each reviewer gets fresh context; they may
  miss interdependencies between components (that's why Phase 6 exists)
- **delegate_task failures** — if a reviewer times out or returns garbage, retry with
  smaller scope
- **Database state matters** — some bugs only appear with data in the DB, or without it
- **Empty catch blocks** — the single most common bug pattern: `except: pass` or
  silent None returns that swallow every error

## Example: Testing a Full-Stack E-commerce App

```python
# Phase 2: Parallel review
result_backend = delegate_task("Test API endpoints at :8649...", ...)
result_dashboard = delegate_task("Review dashboard code at path...", ...)
result_extension = delegate_task("Review extension code at path...", ...)

# Phase 6: Integration
curl -X POST api/pricing/calculate  # create
curl -X GET  api/products/sourcing   # verify
```
