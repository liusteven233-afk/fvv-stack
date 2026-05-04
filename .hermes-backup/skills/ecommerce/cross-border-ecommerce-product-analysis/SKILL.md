---
name: cross-border-ecommerce-product-analysis
description: "跨境电商选品分析：1688 → Mercado Libre 跨平台定价、利润、竞争分析"
version: 1.0.0
author: 靓仔
tags: [cross-border, ecommerce, product-analysis, mercadolibre, 1688, sourcing, dropshipping]
---

# 跨境电商选品分析 (Product Analysis)

从 1688 货源到 Mercado Libre 销售的完整选品分析流程。

## 适用场景

- 用户在 1688 找到产品，想评估 ML 可做性
- 用户想对比多个产品的利润率和竞争情况
- 用户需要做品类调研和趋势判断
- 用户有货源链接，需要快速出分析报告

## 分析维度

### 1. 产品可行性检查清单
```
□ 不带电（无电池/电子元件）
□ 无液体/膏状/凝胶
□ 无粉末
□ 不侵权（无品牌 LOGO/卡通形象/专利设计）
□ 体积小（<30x30x30cm）
□ 重量轻（<500g，理想 <200g）
□ 非管控品（非食品/药品/化妆品/喷雾）
```

### 2. 成本核算

| 项目 | 说明 |
|------|------|
| 1688 单价 | 产品采购价（¥） |
| 运费（国内） | 1688 → 转运仓（¥5-15/单） |
| 国际运费 | 专线小包（¥30-80/kg），按实际重量/体积重取大 |
| 平台佣金 | ML 佣金：墨西哥 15-20%，巴西 16-22%，智利 14-18% |
| 广告费 | 预估 CPC 点击费用（占销售额 5-15%） |
| 退货损耗 | 预估 3-10%（按品类） |
| 汇率 | 实时汇率换算 |

### 3. 利润计算
```
销售价 (MXN/BRL/CLP)
- ML 佣金 (comisión)
- 运费 (costo de envío)
- 产品成本 (costo del producto)
- 国际物流 (logística internacional)
- 广告费 (publicidad)
- 退货损耗 (devoluciones)
= 净利润 (margen neto)
```

**健康指标：**
- 毛利率 > 50%
- 净利润率 > 20%
- ROI > 3 个月回本
- 售价/成本比 > 4x

### 4. 竞争分析

| 维度 | 数据来源 |
|------|---------|
| 在售卖家数 | ML 搜索结果 |
| Top Seller 价格区间 | 销量排序前 20 |
| 评分/评论数 | 竞品 Listing 分析 |
| 是否有中国卖家 | 看发货地/品牌名 |
| FBA/FBM | 看 Full/No Full 标识 |

### 5. 趋势判断
- AMZ123 热词排名（周更新）
- ML 搜索量趋势（可用 ML API）
- 季节性强弱（如泳装夏季、万圣节服装 Q3）
- 生命周期阶段（导入期/成长期/成熟期/衰退期）

## 选品分析模板

```
产品： [名称]
1688链接： [URL]
1688价格： ¥XX
目标站点： ML [国家]

【可行性检查】
- 带电？ □ 是 □ 否
- 液体/膏状？ □ 是 □ 否
- 粉末？ □ 是 □ 否
- 侵权？ □ 是 □ 否
- 体积/重量： XX cm x XX cm, XX g
结果： ✅ 可行 / ❌ 不可行

【成本核算】
1688采购价： ¥XX
国内运费： ¥XX
国际运费： ¥XX (约XXXg × ¥XX/kg)
总成本： ¥XX (≈ $XXX MXN)

【定价建议】
建议售价： $XXX MXN
- ML佣金 (XX%)： -$XXX
- 运费补贴： -$XXX
- 广告费 (10%)： -$XXX
净利润： $XXX MXN (≈ ¥XX)
利润率： XX%

【竞争分析】
搜索结果数： XXXX
Top Seller价格区间： $XX - $XX
平均评分： X.X / 5
中国卖家占比： ~XX%

【建议】
✅ 推荐 / ⚠️ 谨慎 / ❌ 不推荐
理由： ...
```

## ML页面数据抽取模式（扩展/爬虫常用）

常见 ML Chrome 扩展解析产品数据的方式，适用于选品分析时的数据理解与自定义爬虫开发。

### 搜索结果页（列表页）

ML 搜素结果页预渲染数据藏在 `__NORDIC_RENDERING_CTX__` 脚本标签中：

```javascript
// 从 <script id="__NORDIC_RENDERING_CTX__"> 提取
const el = document.getElementById("__NORDIC_RENDERING_CTX__");
const text = el ? el.textContent : "";
// 匹配: _n.ctx.r = {...};
const m = text.match(/_n\.ctx\.r\s*=\s*(\{[\s\S]*?\})(?=;\s*_n\.ctx\.r|;?\s*$)/);
const data = JSON.parse(m[1]);
const results = data?.appProps?.pageProps?.initialState?.results;
// results[].polycard.metadata.id → SKU (ML[A-Z]{3}\d+)
// results[].polycard.components[0].title.text → 标题
```

### 商品详情页

ML 详情页预渲染数据藏在 `__PRELOADED_STATE__` 脚本标签中：

```javascript
const m = document.documentElement.outerHTML.match(
  /<script[^>]*id="__PRELOADED_STATE__"[^>]*>([\s\S]*?)<\/script>/
);
const preloaded = JSON.parse(m[1]);
const trackData = preloaded?.pageState?.initialState?.components?.track?.melidata_event?.event_data;
const seller = preloaded?.pageState?.initialState?.components?.seller_experiment?.seller;
const header = preloaded?.pageState?.initialState?.components?.header;

// 提取字段：
trackData.item_id       → SKU
seller.id               → 卖家ID
seller.name             → 卖家名
seller.reputation_level → 信誉等级
header.subtitle         → 销量文本（需解析）
```

### SKU 提取（URL 正则）

ML 产品 ID 从 URL 中提取的三种常见模式：

```javascript
/wid=(ML[A-Z]{3}\d+)/i          → URL参数 wid=MLM1234567
/(ML[A-Z]{3}-\d+)/i            → 路径中的 MLA-1234567
/p/(ML[A-Z]{3}\d+)/i           → /p/MLM1234567
```

### 销量数解析（西班牙语）

支持 "vendidos" / "venta" / "unidades" / "sold" 等上下文：

```javascript
"1.5k vendidos" → 1500
"50+ vendidos"  → 50
"mas de 100"    → 100
"1M"            → 1000000
```

### 仓库类型判断

```javascript
// 自配送国际仓: COMPRA INTERNACIONAL → warehouseType=1 (自发货)
// 本地仓: 其他 → warehouseType=2 (本土仓)
```

### 美金换算

```javascript
// 从金额元素 meta[content] 取本地价
// 从 ProductDataService.getExchangeRate() 取汇率
// USD = localPrice / exchangeRate[localCurrency]
// 汇率格式: {USD: 1, USD_MXN: 17.5, USD_BRL: 5.0, ...}
```

## 扩展逆向分析 (Plugin Reversing)

分析第三方 ML Chrome 扩展的通用流程：

1. **读 manifest.json** → 域名覆盖、权限、content_scripts 入口
2. **追 auth 模块** → 凡涉及 `localStorage.getItem("king_*")`、`gist.githubusercontent.com` 远程配置、SHA-256 install hash 的都是授权系统
3. **定位数据源** → background.js 中 `chrome.runtime.onMessage` 的分发逻辑暴露所有外部 API 调用
4. **跟踪 API 依赖** → 是否依赖外部 ERP（如 `erp.genzhemai.com`）→ 决定自建还是替换
5. **确认数据覆盖** → content_scripts 的 inject js 文件揭示页面 DOM 解析逻辑
6. **剥离方案**：删 auth 引导文件 + 删侧面板/弹窗中的授权门 + 替换外部 API 调用为本地逻辑或直调 ML API

> 详细扩展逆向实践参考：`references/plugin-reversing-ml-extension.md`

## 数据源

- 1688.com — 批发价格
- mercadolibre.com — 销售数据（直接 API: `https://api.mercadolibre.com/items?ids=MLM1234567`）
- AMZ123 墨西哥热词排名 — 搜索趋势
- ML 类目 Top Seller — 竞品分析
- 物流报价 — 专线/邮政小包报价表

## 注意事项

- ML 各站点佣金率不同，务必确认最新标准
- 汇率波动影响利润，建议预留 5% 汇率 buffer
- 体积重（volumetric weight）可能比实际重更贵，必须计算
- 新品上架前 30 天有流量扶持，注意把握
- 侵权产品会被下架+罚分，务必确认
