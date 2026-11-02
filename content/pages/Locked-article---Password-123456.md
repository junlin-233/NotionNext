---
title: "Locked article - Password: 123456"
slug: "example-2"
notionId: 6f414124-3a8f-4878-b07e-5d1a9fcdd703
---

# 一、模板使用说明

Notion页面中，每篇文章都有几个属性字段🤔，其说明如下：

| 属性 | 必填 | 说明 | 备注 |
| --- | --- | --- | --- |
| `title` |  是 |  文章标题 |
| `status` | 是 | 发布状态 | （仅当状态为`Published` 时会被 展示） |
| `date` | 是 | 发布日期 | 2021/11/05 |
| `type` | 是 | 页面类型 (博文`Post` / 单页(`Page`) | 单页不会在博文列表显示 。 |
| `summary` | 否 | 内容摘要 | 搜索和简略显示会用到 |
| `category` | 否 | 文章分类 | 可以自定义 |
| `tags` | 否 | 文章标签 | 可多个，建议不要太多 |
| `slug` | 否 | 文章短路径 |  (每篇文章唯一，请勿 重复） |
| `icon` | 否 | 菜单栏图标(仅当`Page`类型有效) | 可以参考：[图标库地址](https://fontawesome.com/v5/search) |
| `password` | 否 | 文章加锁 | 需要输入密码访问 |

# 二、加锁说明

[NotionNext: 基于Next.js 的Notion博客站点生成器](https://docs.tangly1024.com/zh/features/articleLock)
