---
name: 1688-anti-scrape-strategy
description: "1688反爬策略记录及应对方案 — bypass anti-scraping for product search, detail pages, and data extraction"
version: 1.0.0
---

# 1688 反爬策略与应对方案

## 现状（2026年4月）

1688 采用多层反爬机制，以下为实测结论：

### 已确认的反爬手段

| 手段 | 表现 | 严重程度 |
|------|------|----------|
| JS动态渲染 | 产品列表、详情通过AJAX/SPA加载，HTML骨架无产品数据 | ⚠️ 高 |
| 事件委托点击 | 产品卡片无 `<a href>`，通过 `addEventListener` 拦截点击，需真实鼠标事件 | ⚠️ 高 |
| 跟踪URL跳转 | 图片链接经 `dj.1688.com/ci_bb` 跟踪后跳转，直接访问会被拦截 | ⚠️ 中 |
| IP风控 | 频繁请求或无登录态访问触发滑块验证 | ⚠️ 中 |
| 登录墙 | 部分详情、价格需登录才能查看 | ⚠️ 中 |
| 请求签名 | API接口需要 `_csrf_token`、时间戳签名等参数 | ⚠️ 中 |

## CDP连接方式

通过 `browser.cdp_url` 配置或运行时设置环境变量连接用户Windows Chrome：

```python
# 运行时设置（当前session生效）
import os
os.environ["BROWSER_CDP_URL"] = "http://127.0.0.1:9222"
```

```yaml
# config.yaml 持久化配置
browser:
  cdp_url: "http://127.0.0.1:9222"
```

### 已验证有效的方案

#### ✅ CDP + 真实Chrome（当前在用）

通过Chrome DevTools Protocol连接用户Windows Chrome：
- 继承用户登录态（cookies无缝可用）
- 使用用户真实IP，不触发IP风控
- 渲染完整的JS动态内容

**成功：搜索页加载、导航、读取文本内容、执行JS都正常**

**失败：browser_click 无法触发1688产品跳转** — 原因：
- CDP的Mouse.click API与1688的JS事件监听器不兼容（缺少trusted flag）
- 产品卡片用 `addEventListener` 而非 `onclick` 属性
- dispatchEvent(new MouseEvent('click', {bubbles: true})) 也被拦截

#### ✅ 搜索页数据提取（有丰富信息，无需进详情页）

从搜索结果页 `s.1688.com/selloffer/offer_search.htm?keywords=XXX` 可直接获取：
- 商品名称、价格（¥）、成交量
- 发货时间、店铺名称
- 标签信息（适用人群、风格、销售地区、下游平台）

使用 `document.querySelector('.search-offer-item')` 可获取每个产品的完整HTML：
```javascript
// 提取第一个产品的HTML
let card = document.querySelector('.search-offer-item');
card.outerHTML  // 含名称、价格、成交量、tags、店铺名
```

### 已验证失败或受限的方案

#### ❌ 方案A：直接构造详情页URL

```javascript
// 从页面scripts中提取的offerId
let scripts = document.querySelectorAll('script');
let all = '';
scripts.forEach(s => { if(s.textContent) all += s.textContent; });
let offerIds = all.match(/offerId["': ]+(\d{12,13})/g);
// ["offerId\":\"805073109517", "offerId\":\"696162070595", ...]
```

**结果：** 所有从页面脚本中提取的offerId访问 `detail.1688.com/offer/{id}.html` 均返回 **404**。这些ID可能是推荐模块的数据，不是搜索结果商品的真实offerId。

#### ❌ 方案B：JavaScript跳转

```javascript
// 在搜索页执行
window.location.href = 'https://detail.1688.com/offer/XXX.html';
// 或用 window.open
```

**结果：** 导航到的详情页返回404，即使加入了用户浏览器cookies。

#### ❌ 方案C：CDP鼠标事件模拟

通过 `Input.dispatchMouseEvent` 在CDP层面模拟真实点击→未能触发1688的JS事件链。

#### ⚠️ 方案D：从网络请求中提取（部分可行）

使用 `performance.getEntriesByType('resource')` 可以找到1688的API请求：
```javascript
let entries = performance.getEntriesByType('resource');
let urls = entries.map(p => p.name).filter(n => n.includes('offer') || n.includes('search'));
```

结果：找到的是埋点/统计请求（含offerId参数在query string），不是商品搜索结果API。

### 可用的数据获取策略

#### 策略1：从搜索页直接获取（快速，信息有限）

适合：初步筛选、比价、利润率估算

```python
browser_navigate(f"https://s.1688.com/selloffer/offer_search.htm?keywords={quote(keyword)}")
```

搜索页提供：名称、价格、成交量、店铺、发货时间、适用人群、销售地区

**不提供：** 重量、尺寸、规格参数、SKU选项、运费

#### 策略2：用户协助导航（推荐，能进详情页）

用户用Chrome手动打开产品详情页 → Hermes通过CDP读取：
```javascript
// 读取重量
document.querySelector('.unit-weight, .sku-weight, [class*="weight"]')?.textContent;
// 或
document.querySelector('.attributes-list, .mod-detail-attributes')?.textContent;
```

#### 策略3：备用平台查询

速卖通(AliExpress)、亚马逊等平台可能有同类产品，重量信息更容易获取。

#### 策略4：Selenium/Playwright直连（高级）

通过WSL安装Selenium，连接到Windows Chrome实例（用现有CDP端口）：
```bash
pip install selenium
python -c "
from selenium import webdriver
options = webdriver.ChromeOptions()
options.debugger_address = '127.0.0.1:9222'
driver = webdriver.Chrome(options=options)
print(driver.current_url)
"
```

## 具体操作流程

### 搜索商品

```python
# 1. 直接导航到搜索URL（URL编码关键词）
url = f"https://s.1688.com/selloffer/offer_search.htm?keywords={quote(keyword)}"
browser_navigate(url)
```

### 获取商品信息（无需进详情页）

从搜索页直接可获取：
- 商品名称、价格、成交量
- 发货时间、店铺名称
- 标签信息（适用人群、风格、销售地区）

### 进入商品详情页（获取重量、规格）

**方法1：直接编辑当前页面URL**
```
从搜索页URL → 通过JS重定向到详情页
```

**方法2：浏览器console执行**
```javascript
// 搜索页执行，跳转产品详情
window.location.href = 'https://detail.1688.com/offer/' + offerId + '.html'
```

### 获取重量信息

进入详情页后，重量通常在：
- 商品参数区（SKU选择区下方）
- 物流信息区（运费估算时显示）
- "规格与包装" Tab

```javascript
// 读取重量
document.querySelector('.unit-weight, .sku-weight, [class*="weight"]')?.textContent
```

## 已知限制

1. **browser_click无法触发1688产品跳转** — 原因：CDP的Mouse.click API与1688的JS事件监听器不兼容（缺少某些事件属性如screenX/screenY、trusted flag）
2. **重定向后需重新获取页面快照** — 使用browser_snapshot或browser_console读取
3. **登录态依赖用户当前Chrome** — 关闭Chrome后需重新用 `--remote-debugging-port=9222` 启动

## 更好的方案（下次优先尝试）

### 方案1：Playwright 连现有 Chrome（最推荐）
通过 CDP 连接用户正在用的 Chrome，Playwright 的 `page.click()` 比 Hermes browser_click 更底层，能触发 1688 的 JS 事件委托：
```bash
pip install playwright
playwright install chromium
# 连接已有CDP实例
python -c "
from playwright.sync_api import sync_playwright
p = sync_playwright().start()
browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222')
page = browser.contexts[0].pages[0]
# 直接点击产品卡片
page.locator('.search-offer-item').first.click()
"
```

### 方案2：调1688移动端API
搜索页背后调用 `h5api.m.1688.com`，移动端API反爬弱得多，可直接请求拿数据（含offerId、价格、重量等）：
```
https://h5api.m.1688.com/h5/mtop.taobao.shopcenter.search.searchOffer/1.0/?...
```
需要分析请求参数（appKey、sign、data），可从浏览器Performance API或Network面板抓取。

### 方案3：浏览器console注入JS跳转
搜索页加载后，通过 `browser_console` 执行：
```javascript
window.location.href = 'https://detail.1688.com/offer/' + offerId + '.html'
```
绕过点击事件，直接导航。

### 方案4：拦截网络请求获取商品数据
1688搜索页加载时会发API请求拿商品数据，拦截响应即可拿到offerId、SKU、价格等完整数据，无需进入详情页。
方法：在浏览器中通过 `performance.getEntriesByType('resource')` 筛选API请求URL，提取数据。

## 替代方案（优先级低）
- **1688开放平台API** — 注册开发者获取API权限（需企业资质）
- **爬虫工具** — 使用 EasySpider 等可视化采集工具
