# ML扩展逆向分析实践

> 2026-05-04: 对"宇宙无敌超级爆炸牛逼之美客多插件"的完整剥析记录

## 扩展基本信息

- 名称：宇宙无敌超级爆炸牛逼之美客多插件 v1.1.0
- 类型：Chrome MV3 Extension
- 核心功能：ML全站点搜品增强 + 1688选品 + 利润计算 + 卖家后台工具

## 文件架构

```
manifest.json                MV3清单
my-auth-bootstrap.js         ⛔ 授权/远程控制系统（需删除）
custom-background.js         后台Service Worker（消息代理中枢）
├── core/                    空目录（占位）
├── vendor/                  第三方库（jquery-1.11.js）
├── assets/                  图标/图片资源
├── ui/                      沙盒计算器页面
├── hajimi/                  空目录
├── features/
│   ├── mercadolibre/
│   │   ├── inject/          ★ ML数据解析核心
│   │   │   ├── js/
│   │   │   │   ├── config.js           页面适配配置（pageA/pageB两种布局）
│   │   │   │   ├── utils.js            SKU提取、销量解析、国家判断
│   │   │   │   ├── template.js         UI模板渲染引擎
│   │   │   │   ├── productDataService.js  数据请求（调外部ERP API）
│   │   │   │   ├── productCardAppender.js  ★ 搜索结果页卡片增强
│   │   │   │   ├── productDetail.js        ★ 商品详情页数据注入
│   │   │   │   ├── stubs.js              兼容垫片（原插件依赖）
│   │   │   │   └── collectStatusManager.js 采集状态localStorage管理
│   │   │   └── css/styles.css
│   │   ├── batch-delete/        批量删除+图表增强
│   │   ├── order-assistant/     订单助手
│   │   ├── quick-reply/         快捷回复
│   │   ├── quick-case/          客服Case处理
│   │   └── sizes/               尺码管理
│   ├── 1688/
│   │   ├── card-enhancer/       ★ 1688搜索结果+详情页增强+6国利润矩阵
│   │   └── marketplace/alibaba-1688/ ⛔ 混淆版（125KB，含auth，可删）
│   └── mercadopago/deduction-stats/  MP扣费统计
├── unified-sidepanel.*        侧面板（含授权门 ⛔）
├── erp-popup.* / erp-tool.*   ERP工具弹窗
└── promotionDiscountModifier.js  折扣批量修改器
```

## 授权系统解析 (my-auth-bootstrap.js)

该授权系统用于控制插件使用权限，支持远程封禁：

### 核心机制
- **远程控制文档**：从 `gist.githubusercontent.com` 拉取 JSON 配置
- **Install ID 追踪**：`crypto.randomUUID()` + localStorage + chrome.storage 三重存储
- **SHA-256 哈希**：install ID 和 license key 都做哈希，用于远程匹配封禁
- **超级令牌**：硬编码 `SUPER_TOKEN` 写入 localStorage 作为解锁标记
- **多种封禁条件**：全局封禁、版本过低、install ID 封禁、哈希封禁、许可到期
- **模块解锁**：分别控制 `king_mkd_*` 和 `king_1688_*` 两组模块
- **自毁机制**：`king_*_self_destruct` 标志位
- **fetch 劫持**：patch 全局 fetch，拦截对 gist.github.com 的请求，伪造返回

### 需删除的代码
1. `my-auth-bootstrap.js` — 整个文件
2. 侧面板 HTML/JS 中的 `loginGate` 授权门
3. erp-popup.js/erp-tool.js 中的 auth 校验逻辑
4. `features/marketplace/alibaba-1688/content.js` — 125KB 混淆

## ML数据抽取模式

### 搜索结果页（列表页）

从 `__NORDIC_RENDERING_CTX__` 脚本标签提取所有商品 ID（SKU列表），然后批量向 ERP 后端请求完整数据。

### 商品详情页

从 `__PRELOADED_STATE__` 脚本 JSON 解析：
```
pageState.initialState.components.track.melidata_event.event_data
  → item_id (SKU)
pageState.initialState.components.seller_experiment.seller
  → id, name, reputation_level
pageState.initialState.components.header.subtitle
  → 销量文本
pageState.initialState.components.available_quantity.picker.description
  → 库存
```

### 页面布局适配（两种列表布局）

```javascript
config = {
  pageA: {
    // 现代列表：ui-search-layout > .ui-search-layout__item .andes-card
    pageIdentifier: ".ui-search-layout > .ui-search-layout__item .andes-card",
    strategy: { getElements, getCard, templateClass: "pageA-layout" }
  },
  pageB: {
    // 传统列表：ui-search-layout > .ui-search-layout__item > div
    pageIdentifier: ".ui-search-layout > .ui-search-layout__item > div",
    strategy: { getElements, getCard, templateClass: "pageB-layout" }
  }
}
```

## 外部依赖（需替换）

| 外部服务 | 端点 | 用途 | 替换方案 |
|----------|------|------|---------|
| erp.genzhemai.com/api | /spider/mercado/product/infos | 商品数据（销量/重量/佣金等） | 直调 ML API + 本地估算 |
| erp.genzhemai.com/api | /system/exchange/rate | 汇率 | 免费汇率 API 或固定配置 |
| api.mercadolibre.com | /items?ids= | 批量查询销量/状态 | 可保留（已直调） |

## 1688增强模块详情

`features/1688/card-enhancer/content.js` — 347行，独立运行，依赖少

### 搜索页
- 选择器：`.offer-item, .sm-offer-item, .item-info`
- 价格提取：`.price, .offer-price span, .value` 等
- 重量提取：文本匹配 `(\d+(?:\.\d+)?)\s*(?:kg|千克)`
- 默认重量：0.3kg
- 注入：每个卡下方显示"📊 利润"按钮 → 点击弹出6国利润表格

### 详情页
- 价格提取：7种选择器兜底
- 重量提取：从 attr-list li 中匹配"重量/weight"行
- 注入：右侧浮动面板，可编辑成本/重量/目标利润/汇率

### 内置算价引擎
```
公式：售价 = (目标利润USD + 运费) / (1 - 佣金率)
       净利润 = 售价 - 佣金 - 运费
       利润率 = 净利润 / 成本
运费补贴：ship_subsidy 参数（默认15%减扣）
免运费门槛：按国家（墨西哥299MXN、巴西79BRL等）
```

## 重建建议

### 保留的功能
- ✅ ML 搜+详页面 DOM 解析和卡片增强
- ✅ SKU 提取、销量解析、USD换算
- ✅ 1688 搜索结果/详情页增强 + 利润矩阵
- ✅ MutationObserver 页面变化监听
- ✅ 全部 UI 样式（渐变背景、卡片布局）
- ✅ 订单助手、快捷回复等卖家后台工具

### 需删除
- ❌ my-auth-bootstrap.js 整个文件
- ❌ 所有 `king_*` localStorage/chrome.storage 键
- ❌ 侧面板授权门（loginGate HTML+JS）
- ❌ 混淆版 alibaba-1688/content.js (125KB)
- ❌ erp.genzhemai.com 外部 API 调用

### 需替换
- 外部 ERP API → 直调 ML API 或本地逻辑
- 内置运费表 → cainiao-shipping-ml skill 的6国精确表
- 汇率获取 → 免费 API 或可配置固定值
