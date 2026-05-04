---
name: ml-product-research-amz123
description: "Mercado Libre Mexico product research using AMZ123 hot keyword data. Find trending products on MLM and filter by shipping/logistics constraints (no electronics, no liquids, no powders, no IP, small size)."
version: 1.0.0
author: Hermes Agent
tags: [mercadolibre, amz123, cross-border, ecommerce, product-research, keyword-research, mlm]
---

# ML Product Research via AMZ123

Use AMZ123's Mercado Libre Mexico keyword ranking to find trending products and filter by cross-border shipping constraints.

## When to Use

- User asks for trending/hot products on Mercado Libre Mexico
- User wants product recommendations for ML cross-border business
- User needs keyword research for ML listing optimization
- User wants to check what categories are rising on MLM
- User has shipping restrictions (no electronics, no liquids/powders, small size)

## Sources

### Primary: AMZ123 墨西哥站TOP搜索词排名
- URL: `https://www.amz123.com/mxtopkeywords`
- Shows TOP 250K search keywords on ML Mexico
- URL params: `s=PAGE_NUMBER` (page), `o=SORT` (1=rank, 3=rise)
- Page 1 = TOP volume keywords (constant traffic)
- Page 3 with `o=1&s=3` = rising keywords (涨跌幅度) — most valuable for trend detection

### Secondary: Mercado Libre directly
- `https://www.mercadolibre.com.mx/mas-vendidos` — best sellers
- NOTE: ML blocks automated access (403) from proxy IPs. Use browser_navigate when possible, curl fails.

## Workflow

### Step 1: Load AMZ123 keyword data

```python
# Use browser_navigate to load pages:
browser_navigate("https://www.amz123.com/mxtopkeywords")             # Page 1 - TOP keywords by volume
browser_navigate("https://www.amz123.com/mxtopkeywords?o=1&s=3")     # Page 3 - Rising keywords
```

Parse the snapshot output. Keywords appear as `<link>` elements in a `LayoutTable`. Extract with:

```python
# From snapshot, extract all link text entries that are keywords
# Keywords are the link text directly under LayoutTable
# Ignore header links like "本周排名", "上周排名", "涨跌幅度"
```

### Step 2: Filter by restrictions

Common constraints for cross-border FBM from China to ML Mexico:
- ❌ **Electronics** (带电): audifonos, bocina, laptop, ventilador, celular, iphone, cafetera, aspiradora, power bank, airpods, nintendo, playstation, camara
- ❌ **Liquids/Creams** (液体/膏状): shampoo, perfume, crema, bloqueador solar, desodorante, tonico, autobronceador
- ❌ **Powders** (粉末): creatina, proteina, suplemento
- ❌ **IP infringement** (侵权): pokemon, marvel, disney, nintendo, monster high, lego (official)
- ❌ **Large/Bulky** (大件): escritorio, aire acondicionado, aspiradora, papel higiénico, pañales, sleeping bag (some)
- ✓ **Good candidates**: fundas (phone cases), disfraces (costumes), bisutería (jewelry), accesorios pelo (hair accessories), collares mascotas (pet collars), brasier transparente (lingerie), calcetines (socks), gorras (caps), bolsas pequeñas (small bags), mallas (tights)

### Step 3: Categorize and recommend

Group findings by:
- **Trending now** — from rising keywords page (o=1&s=3)
- **Consistent volume** — from top rank page
- **Seasonal** — note holiday relevance (Mother's Day, Children's Day, Halloween, Christmas, etc.)

### Step 4: Cross-reference with 1688 sourcing

For recommended categories, check 1688 for wholesale pricing:
- Focus on products under ¥20 cost (小体积轻量级)
- Check shipping weight (<200g ideal for small packet)
- Verify no battery/liquid/powder content

## Common Hot Categories (China FBM → ML Mexico)

| Category | Spanish Keywords | 1688 Cost | ML Price | Weight | Notes |
|----------|-----------------|-----------|----------|--------|-------|
| Phone Cases | funda para celular | ¥3-8 | $80-200 MXN | ~30g | Always hot, high competition |
| Hair Accessories | ligas, scrunchies, clips | ¥1-5 | $30-80 MXN | ~10g | Very light, good margins |
| Costume Jewelry | aretes, collares, pulseras | ¥3-15 | $50-200 MXN | ~20g | AKF/titanium steel trending |
| Pet Collars/Leashes | collares, correas | ¥5-20 | $80-250 MXN | ~50g | Growing category |
| Sunglasses | gafas de sol | ¥8-25 | $100-300 MXN | ~30g | Seasonal (summer peak) |
| Kids Costumes | disfraces niños | ¥15-40 | $150-400 MXN | ~100g | Rising trend, party season |
| Lingerie/Shapewear | brasier transparente, fajas | ¥3-15 | $50-200 MXN | ~30g | High repeat purchase |
| Small Bags/Purses | bolsas mujer pequeñas | ¥10-30 | $100-300 MXN | ~80g | Steady demand |
| Phone Accessories | soporte celular, anillo | ¥2-8 | $30-100 MXN | ~20g | Fits with phone cases |

## Pitfalls

- **ML blocks proxy IPs** — curl requests to ML return 403. Always use browser_navigate when you need to access ML directly.
- **AMZ123 data is weekly** — it shows current week ranking, not real-time sales. Best for trend direction, not exact numbers.
- **Check AMZ123 regularly** — the keyword list updates, so the "hot" categories change week to week.
- **No public Chinese seller database** — ML doesn't expose seller nationality. Use product listings and shipping origin to infer.
- **AMZ123 page is JavaScript-heavy** — browser_snapshot may miss some data. Scroll down to load more results.
