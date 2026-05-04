---
name: ML-pricing-table
description: "Mercado Libre 跨境核价表管理：Excel 核价表操作、利润计算、公式维护"
version: 1.0.0
author: 靓仔
tags: [cross-border, ecommerce, mercadolibre, pricing, excel, profit-calculation, openpyxl]
---

# ML 跨境核价表管理

管理靓仔的 Mercado Libre 跨境核价表 Excel 文件。

## 文件位置

```
~/.hermes/ML跨境核价表.xlsx
```

## Sheet 结构

| Sheet | 作用 |
|-------|------|
| 核价表 | 主表：产品价格/利润/利润率计算 |
| 汇率参考 | 各国货币对人民币实时汇率 |
| ML佣金参考 | ML 各站点各品类佣金率 |
| 使用说明 | 操作指南 |

## 常见操作

### 查看核价表内容
```python
import openpyxl
wb = openpyxl.load_workbook('~/.hermes/ML跨境核价表.xlsx')
ws = wb['核价表']
for row in ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=False):
    print([cell.value for cell in row])
```

### 添加新产品
1. 在新行输入：产品名、1688 价格、运费、ML 售价
2. 利润 = 售价 - 佣金 - 运费 - 成本
3. 利润率 = 利润 / 售价
4. 确认条件格式（利润率<20%红色，>50%绿色）

### 更新汇率
```python
import openpyxl
wb = openpyxl.load_workbook('~/.hermes/ML跨境核价表.xlsx')
ws = wb['汇率参考']
# 更新各国汇率
ws['B2'] = new_mxn_rate  # Mexico
ws['B3'] = new_brl_rate  # Brazil
ws['B4'] = new_clp_rate  # Chile
ws['B5'] = new_cop_rate  # Colombia
ws['B6'] = new_ars_rate  # Argentina
ws['B7'] = new_uyu_rate  # Uruguay
wb.save('~/.hermes/ML跨境核价表.xlsx')
```

## 自动计算公式

核价表应包含以下自动公式：
```
利润 = (ML售价 × 汇率) - (1688采购价 × 数量) - 国内运费 - 国际运费 - (ML售价 × 佣金率) - 广告费
利润率 = 利润 / (ML售价 × 汇率)
```

## ML 各站点佣金参考

| 站点 | 佣金率 | 备注 |
|------|--------|------|
| Mexico (MLM) | 15-20% | 品类不同有差异 |
| Brazil (MLB) | 16-22% | 电子类更高 |
| Colombia (MLC) | 14-18% | |
| Chile (MLC) | 14-18% | |
| Argentina (MLA) | 15-20% | 通胀期可能调整 |
| Uruguay (MLU) | 14-18% | |

## 注意事项

- 核价表有颜色条件格式（红黄绿色阶），编辑时不要破坏
- 建议每次更新汇率前备份原文件
- 涉及大量修改时，用 openpyxl 而非手动 Excel 操作
- 公式更新后确认自动计算结果正确

## 依赖

```bash
pip install openpyxl
```
