---
name: frontend-design
description: 前端美化神器 — 专业级UI设计、一键美化界面、响应式布局、避免AI审美疲劳
tags: [frontend, ui, design, css, responsive]
---

# Frontend Design

官方出品的前端美化工具，提供专业级UI设计能力。

## 功能

- **一键美化**: 给现有的HTML页面应用专业UI样式
- **响应式布局**: 适配手机/平板/桌面
- **暗色主题**: 默认暗色主题设计，适合侧边栏扩展
- **组件库**: 卡片、按钮、输入框、表格、弹窗等预制样式
- **避免审美疲劳**: 提供多样化的设计风格选项

## 设计原则

1. **高对比度**: 深色背景 + 亮色文字，可读性优先
2. **卡片式UI**: 信息分组清晰，视觉层次分明
3. **渐变点缀**: 适量使用渐变色（如黄黑主题 #FFE600）
4. **微动效**: 淡入动画、悬停效果，提升交互感
5. **间距统一**: 一致的padding/margin系统

## 常用颜色方案

```
主色: #FFE600 (亮黄)
背景: #0b0c0f / #0f1117 (深色)
卡片: rgba(255,255,255,0.02-0.05)
文字: #e4e6ef (主), #7a7f8c (次要)
成功: #10b981 / #34d399
错误: #fb7185
链接: #3b82f6 / #60a5fa
```

## 典型CSS模式

### 卡片
```css
.card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 8px;
}
.card:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.11);
}
```

### 按钮主色
```css
.btn-p {
  background: linear-gradient(135deg,#FFE600,#e0c800);
  color: #0b0c0f;
  font-weight: 600;
}
```

### 输入框
```css
.inp {
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: #e4e6ef;
  border-radius: 5px;
}
.inp:focus {
  border-color: #FFE600;
}
```
