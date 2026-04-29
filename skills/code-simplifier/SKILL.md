---
name: code-simplifier
description: 屎山代码终结者 — 自动简化复杂逻辑、消除冗余代码、优化代码结构、提升可读性
tags: [code, refactoring, cleanup, readability, optimization]
---

# Code Simplifier

被称为"屎山代码终结者"，专治复杂、冗余、难维护的代码。

## 功能

- **简化复杂逻辑**: 将嵌套条件/循环拆解为清晰结构
- **消除冗余代码**: 删除死代码、重复代码、无用变量
- **优化代码结构**: 提取函数、合并重复逻辑、改进命名
- **提升可读性**: 加必要注释、统一格式、拆分长函数

## 使用方式

加载skill后，直接描述要清理的代码：

```
请简化这段代码，有重复逻辑需要合并
文件路径: ~/project/main.py
```

或在代码review时自动触发简化建议。

## 简化原则

| 问题 | 处理方法 |
|------|---------|
| 超过20行的函数 | 拆分为多个小函数 |
| 嵌套超过3层 | 提前return，减少缩进 |
| 重复代码块 | 提取为公共函数 |
| 魔法数字 | 定义为常量 |
| 变量名模糊 | 重命名为有意义的名称 |
| 大段if-else | 改用策略模式或字典映射 |

## 示例

### 简化前
```javascript
function calc(a,b,c) {
  if (a > 0) {
    if (b > 0) {
      return a * b;
    } else {
      return a * c;
    }
  } else {
    return 0;
  }
}
```

### 简化后
```javascript
function calc(a, b, c) {
  if (a <= 0) return 0;
  return b > 0 ? a * b : a * c;
}
```

## 注意事项

- 简化前先确保有测试覆盖
- 不变更对外接口签名
- 保持原有功能不变
- 每次改完跑测试验证
