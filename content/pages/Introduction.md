---
title: "Introduction"
slug: "guide"
notionId: 5127215a-3051-4513-aec0-a678e0073a76
---

# **How to Write Articles Using Notion**

Please visit the tutorial for assistance.

[如何在Notion中开始写作 | NotionNext文档](https://docs.tangly1024.com/article/start-to-write)

[Notion快捷键 | NotionNext文档](https://docs.tangly1024.com/article/notion-short-key)

# **Template Usage Instructions**

The NotionNext project must be linked to a Notion database in order to be used. Please visit the tutorial for assistance.

[Vercel云部署 | NotionNext文档](https://docs.tangly1024.com/article/vercel-deploy-notion-next#3df829414795492bb41ec351eb6da84e)

## **Explanation of Notion Template Fields**

In the Notion database, each entry will have the following properties: 🤔

| Attributes | Required | Description | Remark |
| --- | --- | --- | --- |
| `title` | Yes | Article Title |
| `status` | Yes | Publication Status | Will only be displayed when the status is `Published` |
| `type` | Yes | Page Type (`Post `/ `Page`) | Pages won't appear in the blog post list. |
| `summary` | Optional | Content Summary | Used for search and brief display, will be shown in the article list |
| `date` | Optional | 发布日期 | Prior to version V3.3.9, this field was required. |
| `category` | Optional | Article Category | Customizable |
| `tags` | Optional | Article Tags | Multiple tags allowed, but it's recommended not to have too many. |
| `slug` | Optional | Article Short Path | Unique for each article, please do not repeat. |
| `icon` | Optional | Menu Bar Icon (Only valid for Page/Menu type) | You can refer to: [Icon Library](https://fontawesome.com/v6/search) |
| `password` | Optional | Article Password | Password required for access." |

Each column in the database serves a different purpose;

**type**: Indicates the type of data, which can be notice (公告), post (文章), page (单页), menu (菜单), submenu (子菜单), among others.

**slug**: Depending on the data type, it serves different functions: in menus, it indicates the page to which it links; in articles, it represents the access address of the article within the blog. For instance, if the data is a page with the slug "test", it can be accessed via https://domain/test; whereas if it's a post with the slug "example", it can be accessed via https://domain/article/example, and it will also appear in your homepage list.
