---
name: skill-creator
description: 将跑通的工作流封装成可安装的skill — 自动分析流程、提取可复用模式、生成标准文档
tags: [skills, workflow, automation, packaging]
---

# Skill Creator

官方认证skill，可将跑通的工作流封装成可安装的skill。

## 功能

- 自动分析已完成的工作流步骤
- 提取可复用的模式和参数
- 生成标准SKILL.md文档（YAML frontmatter + markdown body）
- 支持一键安装到其他Hermes实例

## 使用场景

- 完成复杂任务（5+工具调用）后，将方法保存为skill
- 修复棘手的bug后，把排查-修复流程存下来
- 发现通用的工作流模式，分享给其他人

## 如何创建skill

使用 Hermes 的内置 skill_manage 工具：

```
skill_manage(action='create', name='my-skill', content='...', category='...')
```

## Skill 结构规范

```yaml
---
name: my-skill
description: 简短描述
tags: [tag1, tag2]
---
```

- 命名：小写+连字符，64字符以内
- 步骤需编号且可执行，包含具体命令
- 包含注意事项：踩过的坑、环境依赖
- 验证：如何确认任务完成
- 创建后及时推送到GitHub备份
