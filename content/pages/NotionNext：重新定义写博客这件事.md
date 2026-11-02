---
title: "NotionNext：重新定义写博客这件事"
slug: "notionnext"
notionId: 3fe5c572-e7e9-815a-b24a-e56066216f28
---

💡

如果你厌倦了传统的md文件写博客，想要一种更简便更高效的办法，那么我强烈推荐使用这套NotionNext部署博客，在notion里写的文章无感同步到你的网站，即便不懂代码也能快速上手。

## 什么是 NotionNext

NotionNext 是一个基于 Next.js 的开源 Notion 建站工具，它会把你的 Notion 笔记实时渲染成一个静态博客站点。

核心特点：

- **写作在 Notion**：所有文章都在 Notion 数据库里编辑，发布即同步。
- **免费开源**：源码托管在 [GitHub](https://github.com/tangly1024/NotionNext)，可自行fork后修改。
- **无需服务器**：通常部署到 Vercel，免费额度足够个人博客使用。
- **多主题可选**：内置数十款主题，覆盖博客、文档、导航站、落地页、相册等场景。
- **SEO 友好**：基于 Next.js 服务端渲染，有利于被搜索引擎收录。
## 搭建博客的大致流程

由于官方的教程文档写的足够详细，所以本文就简要带过。

整体流程可以概括为下面这张图：

简要说明：

1. **准备账号**：Notion、GitHub、Vercel，最好再加一个自己的域名。
1. **复制模板 + 部署**：复制官方 Notion 模板拿到 Page ID，Fork NotionNext 仓库后在 Vercel 里导入，填入 `NOTION_PAGE_ID`，点 Deploy 即可拿到一个 `xxx.vercel.app` 的站点。
1. **配置 + 域名**：在 Notion 的 Config 页和代码里的 `blog.config.js` 改站点名、主题、菜单等；建议在 Vercel 里绑定自己的域名。
1. **开始写作**：在 Notion 文章数据库里新建页面，把 `type` 设为 `Post`、`status` 设为 `Published`，保存后站点会自动同步。
## 进阶方向

在过去，折腾博客主题基本是技术爱好者的专利——普通人想在模板上改点东西不仅费时费力，还可能直接把站点改崩。但在 LLM 时代，这些都不是问题。

### 个性化你的博客

步骤其实很简单：你只需要把fork的项目存到本地，无论用**codex桌面版**（对无代码基础的同学更友好，强烈推荐），**claude code**还是**opencode**，只需告诉AI你的需求（相信我，现在的LLM水平足够创建出你想要的博客），等它工作完再推送到github仓库，就这么简单，唯一比较烧脑的部分是你需要让AI明白你的需求（你在提示词花费的时间绝对物超所值）。

### 让 AI 帮你写文章

此外如果你像我一样连文章都懒得全部手打了，无论是用notion内置的LLM还是用notion mcp（**codex桌面版**完美适配）都可以帮助你快速构建文章，当然，核心部分还是需要你打，不然就没有意义了，不是吗？

## 小结

回过头看，NotionNext 做的事情其实只有一件：**把 Notion 变成你博客的后台，把发布、渲染、部署这些脏活累活全部抽象掉**。你要做的，只是打开 Notion，写下今天想说的话。

对我来说，它的价值不在于"又多了一个博客系统"，而在于**大幅降低了持续写作的门槛**：

- 不用切换编辑器，想到什么随手就能写；
- 不用操心构建和部署，保存即发布；
- 配合 AI 工具，连主题魔改和选题灵感都能被加速。
但是工具再顺手，也只是放大器。真正决定这个博客能走多远的，是你愿不愿意**持续地写下去**。NotionNext 帮你把路铺平了，剩下的那一步，只能靠你自己了。

## 📎 参考链接

- [NotionNext 官方文档](https://docs.tangly1024.com/about)
- [NotionNext GitHub 仓库](https://github.com/tangly1024/NotionNext)
- [Vercel 绑定自定义域名教程](https://docs.tangly1024.com/article/vercel-domain)
