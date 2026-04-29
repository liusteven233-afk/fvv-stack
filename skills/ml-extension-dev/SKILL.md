---
name: ml-extension-dev
description: 哈基咪FVV计算器 / 大帅比专用 v5 Chrome扩展开发维护
---

# ML跨境Chrome扩展开发

## 两个扩展路径

| 扩展 | Git路径 | 加载路径 |
|------|---------|---------|
| 哈基咪(FVV计算器) | `extensions/hermes_hajimi_extension/` | `/mnt/c/U/Administrator/Desktop/hermes_hajimi_extension/` |
| 大帅比专用 v5 | `extensions/hermes_extension_v4/` | `/mnt/d/mzls233/hermes_extension_v4/` |

**同步规则**：改完立刻 `cp` 到对应的加载路径 + `git add && git commit -m "msg" && git push`

## 核心数据结构

### COUNTRIES (6国)
`MX`(墨西哥), `BR`(巴西), `CO`(哥伦比亚), `CL`(智利), `AR`(阿根廷), `UY`(乌拉圭)

### 运费表 `SHIP_RAW` / `SHIPPING_RAW`
`[weight_limit_kg, high_threshold_fee(USD), low_threshold_fee(USD)]`
阈值判断：售价<阈值→低运费，否则高运费

### 通用常量
- `ML_CUT = 0.80` (ML抽20%佣金)
- `BUFFER = 0.5` (缓冲USD)
- 6国阈值及汇率

## 利润模式 (4种)

| key | 名称 | 公式 | 各国到账 |
|-----|------|------|---------|
| `profit_value` | 利润值¥ | sale=(cost+profit+ship)/(1-comm) | 一样 |
| `net_margin` | 目标毛利率% | sale=(cost/(1-m)+ship)/(1-comm) | 一样 |
| `sale_margin` | **售价利润率%** | sale=(cost+ship)/(1-comm-m) | **不同✅** |
| `cost_margin` | 成本利润率% | sale=(actualCost*(1+m)/rate+ship)/(1-comm) | 一样 |

**核心认知**：只有`sale_margin`模式到账各国不同，其余模式的运费和佣金在公式中互相抵消。原因如下：

```
profit_value / net_margin / cost_margin:
  netUsd = saleUsd * (1-commRate) - shipUsd
  代入公式后 shipUsd 抵消 → netUsd 与各国运费无关 → 一样

sale_margin:
  netUsd = saleUsd * (1-commRate) - shipUsd
  saleUsd = (cost+ship)/(1-commRate-m)
  → shipUsd 不抵消 → 各国不同 ✅
```

**🚫 不要添加任何"新公式模式"期望到账各国不同** — 只有sale_margin能做到，数学必然。

## 通用公式 (所有模式通用)

```
costUsd = actualCost / rateCny  // actualCost含采购+打包+货损+国内运费
commRate = 佣金% / 100

case 'profit_value':
  saleUsd = (costUsd + profitUsd + shipUsd) / (1 - commRate)
  profitUsd = 目标利润 / rateCny

case 'net_margin':
  saleUsd = (costUsd / (1 - m) + shipUsd) / (1 - commRate)
  m = 目标毛利率% / 100

case 'sale_margin':
  saleUsd = (costUsd + shipUsd) / (1 - commRate - m)
  m = 售价利润率% / 100

case 'cost_margin':
  saleUsd = (actualCost * (1 + m) / rateCny + shipUsd) / (1 - commRate)
  m = 成本利润率% / 100

// 所有模式最终
listPrice = saleUsd / (1 - 折扣% / 100)
netUsd = saleUsd * (1 - commRate) - shipUsd
```

## 阈值处理 (重要)
```
// 先假设用高阈值运费计算
用高阈值(shipAbove)算出saleUsd → 换算成当地币
if 当地币售价 < 该站阈值金额:
    改用低阈值(shipBelow)重算
```

## getShipRates (大帅比专用)
```javascript
// 返回 { above, below, limit, ck }
// 注意：返回的是对象，解构用 { above: shipAbove, below: shipBelow }
```

## 大帅比专用 5个Tab

| Tab | 功能 |
|-----|------|
| 💰 核价 | 输入ML售价+重量+货源价 → 算利润 |
| 🎯 反向 | 输入重量+货源价+选利润率% → 算售价+到账 |
| 🌍 对比 | 统一USD售价 → 6国排名 |
| 📊 跨境 | 净利润模式(ML跨境店不可改售价) |
| 📈 多模式 | 4种利润模式 + 6国同步计算卡片 |

### 多模式Tab结构 (大帅比专用)
- 下拉选利润模式（4种）
- 采购成本、毛重、尺寸、国内运费、打包费、货损率、折扣
- 点计算 → 6张卡片显示各国到账 + 详细列表

## 到账各国相同的数学原因 (靓仔已确认)

```
profit_value:
  saleUsd = (costUsd + profitUsd + shipUsd) / (1 - commRate)
  netUsd  = saleUsd * (1 - commRate) - shipUsd
          = costUsd + profitUsd + shipUsd - shipUsd
          = costUsd + profitUsd  ← shipUsd抵消！

sale_margin:
  netUsd  = saleUsd * (1 - commRate) - shipUsd
          = (costUsd + shipUsd) / (1 - commRate - m) * (1 - commRate) - shipUsd
          shipUsd不抵消 → 各国到账不同 ✅
```

## 反向(按售价)Tab

当前保留单一模式：**目标利润率模式**
- 选利润率% → 点"反向定价"
- 结果：需要卖多少钱(当地币) + **到账(净利润/USD)** 绿色小字

## 同步规范

1. 改 `sidepanel.html` + `sidepanel.js`
2. `cp` 到加载路径（不是源码路径）
3. `git add -A && git commit -m "简短中文描述" && git push`
4. 告诉靓仔"刷新扩展试试"
5. 如果用户反馈不行，先在加载路径确认文件内容

## 新增一个利润模式的步骤

1. `sidepanel.html` — `select` 加 `<option>`
2. `sidepanel.js` — 在 `switch(profitMode)` 加 `case`
3. `sidepanel.js` — 在 `onProfitModeChange` 加对应label
4. 同步+推送

## 坑

- `getShipRates` 返回 `{ above, below, limit }` 对象，不是数组。解构：`{ above: shipAbove, below: shipBelow }`，不是 `[shipAbove, shipBelow]`
- 大帅比专用加载路径是D盘，Hajimi是Windows桌面，不要混拷
