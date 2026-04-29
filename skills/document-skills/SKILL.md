---
name: document-skills
description: AI文档操作工具集 — 自动填表、写Docs、批量处理Excel、一键生成PPT、智能阅读PDF
tags: [document, excel, pdf, ppt, automation]
---

# Document Skills

官方出品AI文档操作套件，提升文档处理效率。

## 功能

| 功能 | 说明 |
|------|------|
| 自动填表 | 从数据源自动填充表单字段 |
| 写Google Docs | 按照模板或大纲生成文档内容 |
| 批量处理Excel | 读取/写入/转换Excel数据，支持公式 |
| 一键生成PPT | 根据大纲或数据生成演示文稿 |
| 智能阅读PDF | 提取文本、表格、元数据 |

## 使用方式

加载skill后，用自然语言描述你要处理的文档任务：

```
请帮我生成一个Excel表格，包含6国运费对比数据
列：国家、货币、阈值、运费低/高
```

## 示例

### 生成 Excel
```
帮我把下面的数据做成Excel：
墨西哥 MX$299 1.7/4.0
巴西 R$79 1.7/5.1
...
```

### 读取 PDF
```
读取 ~/documents/report.pdf 中的表格数据
```

### 生成 PPT
```
基于以下大纲生成5页PPT：1.市场概况 2.各国对比 3.推荐策略
```

## 依赖

- Python: openpyxl (Excel), python-pptx (PPT), PyMuPDF (PDF)
- Google API: Google Docs/Sheets (可选)
