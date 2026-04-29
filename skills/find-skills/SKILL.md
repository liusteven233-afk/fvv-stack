---
name: find-skills
description: 从数万个skill中精准找到适合的 — 需求匹配、高分筛选、相似对比、最佳推荐
tags: [skills, search, discovery, recommendation]
---

# Find Skills

可从skills hub的数万个skill中精准找到适合的工具。

## 功能

- **需求匹配**: 输入任务描述，自动匹配最相关的skill
- **高分筛选**: 按安装量、评分、信任级别排序
- **相似对比**: 对比多个候选skill的差异
- **最佳推荐**: 针对复杂任务推荐skill组合

## 使用方式

### 搜索技能
```
hermes skills search "关键词"
```

### 浏览所有技能
```
hermes skills browse
```

### 预览后安装
```
hermes skills inspect <identifier>
hermes skills install <identifier>
```

## 推荐做法

1. 复杂任务前先搜一下有没有现成skill
2. 多个结果时优先选 trust=official 或 trusted 的
3. 安装量高 + 评分好的优先级高
4. 对比类似skill时用 `inspect` 预览内容
5. 找不到合适的skill → 用skill-creator自己创建
