---
title: "我的工作流推荐—oh my openagent"
slug: "oh-my-openagent-recommend"
notionId: 3fe5c572-e7e9-8125-beaa-d53951617ef0
---

🛫

无论LLM发展的如何,subagent注定是现在乃至未来的开发主流，下文就带你了解我的开发工作流，subagent的最佳实践（个人看法）—oh my openagent（下文简称omo）

## Oh My OpenAgent 是什么

**omo** 是 OpenCode 生态下的一个第三方 plugin，GitHub Star 52k+，累计下载 2M+，作者是 [code-yeongyu](https://github.com/code-yeongyu)。它的优势在于——**不绑定任何一家模型厂商，**Claude、GPT、Gemini、Kimi、GLM、MiniMax等等全部能接，按**任务挑模型**，让每个模型在自己擅长的领域发挥最大潜力。同时它还有内置专业化agent、MCP、LSP等等，开箱即用，你只需要导入你的订阅，为每个角色配置模型（如果你懒让agent自己配置也可以），就可以开始omo之旅。

之前我在agent入门一文讲到，agent开发应该遵循最简原则避免过度复杂设计，这在我们开发工作流的选择也是适用的，我并不推荐所有人都使用omo，它的设计太“重”了，如果你日常的开发并不只局限于单个功能的迭代实现或者你的任务更倾向于一人即一个部门的模式（这听起来其实有些悲观），那么**omo基本就是为你量身定制的**。

---

## 核心理念：不同模型，不同脑回路

这是我觉得 omo 最有洞见的地方。

> **你不能用同一套提示词去驱动所有模型。**

作者观察到，Claude / GPT / Gemini 这三大家族的思考方式其实差异很大。

| 模型家族 | 擅长 | 个性标签 | 喜欢的 prompt |
| --- | --- | --- | --- |
| **Claude 系**（含 Kimi、GLM） | 长指令链、高遵循度任务 | 清单工匠 | 机制驱动、分步 SOP、规则越细越好 |
| **GPT 系**（5.2+） | 自主探索、硬逻辑推理 | 原则派 | 简洁 XML、给标准不给菜谱 |
| **Gemini 系** | 前端、UI、创意、视觉理解 | 视觉型选手 | 混合输入、多模态描述 |

所以 omo 的做法是：**同一个agent角色，在不同模型下用完全不同的系统提示词**。

举个例，规划 **agent** **Prometheus**：

- Claude 版： **约 1100 行**，流程拆解到牢，SOP 一步一步把你牵着走
- GPT 版： **约 121 行**，只给原则和决策标准，剩下的交给模型自己发挥
运行时用 `isGptModel()` 自动判断并切换，**用户完全无感**。

---

## 架构总览

可以把 omo 理解成**一家小型 AI 公司**：

---

## Subagent 规划

作者把所有 agent 按**模型家族 + 角色功能**分成了四组。

### Group 1：Communicators（编排层）

面对用户的一线角色，默认跑 Claude Opus / Kimi K2.5 / GLM-5.1(实际体验下来GPT-5.4也能胜任，模型型号请以你现在的情况为准)。

- **Sisyphus**：CTO。**约 1100 行的提示词**，负责总体规划和最终验证。
- **Metis**：搭档。**高温度**采样，鼓励发散，专门在计划定稿前问一句：「我们还漏了什么？」
### Group 2：Dual-Prompt（规划层）

同一个 agent，为不同模型家族写了两套提示词。

- **Prometheus**：战略规划师。像真工程师一样跟你做访谈——范围、约束、验收标准、不能碰的红线，一条条对齐。这是我最喜欢的角色，AI时代，你应该在文档上多花费工夫，而不是在代码上。
- **Atlas**：执行指挥。接过 Prometheus 的计划，拆成 todo 并行分派给各路 agent，逐项打勾。跨任务累积「经验值」，之前学到的约定下次不用再教。
### Group 3：GPT-Native（深度执行层）

为 GPT 系列量身打造。

- **Hephaestus**：独立深度工匠（强烈推荐codex系列），**给目标不给菜谱**风格。封闭流程：**EXPLORE → PLAN → DECIDE → EXECUTE → VERIFY**，开工前先派 2–5 个并行 explore 摸地形。无 fallback，没 GPT 权限直接用不了。
- **Oracle**：只读的架构顾问。不动代码，只在关键决策、反复失败、安全性问题时提问。
- **Momus**：毒舌评审。针对**Prometheus的计划**只给「**通过**」或「**打回**」两种分，工具权限被砍到只剩 review。
### Group 4：Utility Runners（工具层）

打工仔小队，**务必选速度快、成本低**的模型。

- **Explore**：代码搜索
- **Librarian**：外部文档与 [Grep.app](https://grep.app) 检索
- **Multimodal Looker**：截图 / PDF 视觉分享
### Dynamic：Sisyphus-Junior

动态生成的子包工队队长。当 Sisyphus 遇到需要专科能力的子任务时，会“招幕”一个 Junior（专业模型由Category决定），把该任务包给它去带小分队搞定。

---

## Category 路由：把模型选择藏起来

这是 omo 最值得抄的抽象。**你给它一个任务类别，它给你最适合的模型**。

| 默认模型 | 适用场景 | 类别 |
| --- | --- | --- |
| Gemini 3.1 Pro | 前端 / UI / CSS / 视觉设计 | `visual-engineering` |
| Gemini / Claude Opus | 创意方案、探索性设计 | `artistry` |
| GPT-5.4 xhigh | 架构决策、硬逻辑 | `ultrabrain` |
| GPT-5.3 Codex | 多文件复杂编码 | `deep` |
| Claude Haiku / Gemini Flash | 单文件、简单任务 | `quick` |
| Gemini Flash / Claude Sonnet | 文档 / 文案 | `writing` |
| 默认级联模型 | 一般任务兼底 | `unspecified-low` / `-high` |

配置文件（`oh-my-openagent.json`）示例：

---

## 提示词艺术

作者在 prompt 工程上下了远比普通 agent 框架多的功夫。下面的每个细节我都尽量贴上**官方仓库里的原文片段**。

### 模型家族适配：同一角色，两套灵魂

前面说过了：同一个 agent，帮不同家族写不同版本的 prompt。**这是整个 omo 的前提假设**。这一点在代码里体现得非常直接——以 Prometheus 为例，源文件 [`src/agents/prometheus/system-prompt.ts`](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/omo-opencode/src/agents/prometheus/system-prompt.ts) 中根据模型动态选 prompt：

### 模块化组装：Prometheus 的「六段式」

Prometheus 把一份战略规划 prompt 拆成**六个互相独立的模块**拼起来：

这种写法的好处是**单点可改**：嫌计划模板太啰嗦，就只动 `plan-template.ts`；想给 Interview 加一条「必须确认数据库迁移策略」，就只动 `interview-mode.ts`。不会一碰牵动整个 prompt。

### Hephaestus 的「给目标不给菜谱」

GPT 系模型喜欢**原则驱动**——你给它标准，它自己想办法。Hephaestus 的 prompt 风格就是这样，下面这段是 [`src/agents/hephaestus/gpt.ts`](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/omo-opencode/src/agents/hephaestus/gpt.ts) 的原文开头：

然后它用一段非常硬核的「**Do NOT Ask - Just Do**」把 GPT 的摇摆倾向直接摁死：

最关键的执行闭环写得非常干脆：

### Intent Gate：让意图先行

在所有执行层之上加一层**意图分类器**，避免 agent 解错题。你说「看一下这段代码」，它不会直接给你改代码。在 Hephaestus 的 prompt 里，这一段叫 **Phase 0**：

Sisyphus 作为总调度也有对应的四阶段：**Intent Gate → Codebase Assessment → Smart Delegation → Independent Verification（受限于篇幅这里就不介绍了）**。两层 Intent Gate 叠加，基本能把误解的概率压到很低。

### 纪律 hooks：用程序替 AI 自律

prompt 再严，也顶不住模型自己「走神」。omo 干脆用外部程序兜底：

- **Todo 强制器**：走神的 agent 被拉回待办队列；Hephaestus 的 prompt 里直接放了一整段 `${todoDiscipline}` 占位符，运行时注入待办纪律规则
- **Comment Checker**：AI 生成的废话注释自动删除
- **Ralph Loop**：任务不到 100% 完成不让收工，对应 prompt 原文是那句 **"100% OR NOTHING"**
- **Prometheus md-only hook**：Prometheus 只能写 `.md` 计划文件，写代码直接被 hook 拦截——保证规划师**只规划不动手**
🧩

想看更多原文？直接读：src/agents/prometheus/system-prompt.ts 和 src/agents/hephaestus/gpt.ts。每个 agent 文件夹下都有 `system-prompt.ts` + 若干模块文件，结构非常清晰。

---

## 工作流：两种方式，满足你绝大多数开发需求

### Ultrawork（`ulw`） — 一键闭环

键入三个字母 `ulw`，输入你的需求，去泡杯咖啡就行。

**适用场景**：任务边界清晰、但代码要改一堆地方。

### Prometheus 模式 — 严谨版

按 **Tab** 进入面谈模式：

1. **Prometheus** 与你讨论需求、范围、验收标准
1. **Metis** 问：漏了什么？
1. **Momus** 审计划：通过 or 打回
1. 输入 `/start-work`
1. **Atlas** 接手拆 todo 并分派
1. **Boulder 系统**把进度写到 `boulder.json`，**中间崩溃可以从原地续跑**
**适用场景**：多天才能搞完的项目、架构调整、生产变更、或希望留下决策记录的改动。由于实际模型效果受限于目前的上下文（超过200k效果会大打折扣），所以这种方式在我写下这段话的时候还不是很适用，有时候光计划写完就用掉100k了，需要新开一个窗口再按照计划进行，希望你读到这段话的时候模型已经不局限于200k上下文以下的最佳效果。

---

## 与正常开发模式的优劣

### 优势：

- **天生并行**。主流的agent开发基本还是串行，omo 可以同时起好几个 background agent，一个写代码、一个查文档、一个跑验证。大改动场景体感差别巨大。
- **任务↔模型 自动匹配**。前端自动走 Gemini、架构自动走 GPT、琐事自动走 Haiku，用户不用管。
- **Hashline 的编辑稳定性**。弱模型也能稳稳改代码，edit 失败率断崖下降。
- **IDE 级能力**。LSP + AST 内置，workspace rename、go-to-definition、find-references、构建前诊断全部可用，原生 Claude Code 做不到。
- **不绑厂商**。Anthropic 下架、OpenAI 限流、Gemini 涨价？换底层就行，workflow 一行代码不用改。
- **Boulder 断点续跑**。会话崩了、电脑重启了、大动作做到一半注意力断了？没关系，`boulder.json`为你记着。
### 劣势：

- **学习曲线陡**。agent / category / skill / hook 这些概念得先理解一波，虽然不理解也能使用，作者已经把门槛降到最低。
- **默认成本不低**。尽管subagent的理想设计下token的消耗是比正常效果低的，但是正如我所说—omo太“重”了，在同等任务下它的花费比正常高30%左右（体感上），至于效果？因人而异了，所以我并不推荐每个人都去使用它。
- **Hephaestus 与 GPT 强绑定**。没 OpenAI / GitHub Copilot 就用不了，本地模型目前顶不上。
- **prompt 与模型家族高度耦合**。不要随手乱换模型，换错了质量会断崖下降，先尊重默认配置再谈定制。
---

## 总结

对我而言，尽管omo在有些情况下太“重”，甚至token的花销也不小，但是我已经无法再抛下它，subagent的优雅只有用过的人才能真切体会。同时 **omo** 给我带来的最大冲击不是某个具体功能，而是它让我重新思考了 **AI coding 的未来形态：**

> 一个人 + 一个超强模型搞定一切？或许不是。

> 一支各有所长、互相 review、自我纠错的 agent 团队？可能更接近工程团队本来的样子。

omo 在这条路上已经走得挺远。如果你在用 OpenCode，**强烈建议花 10 分钟装一下试试**——不喜欢也能随时卸。下面贴一段作者的原话，或许有些嚣张，但我很喜欢：

---

## 📎 参考资料

- 📂 项目仓库：[code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
- 🌐 官方站点：[ohmyopenagent.com](https://ohmyopenagent.com)
- 📖 官方文档：[Oh My OpenAgent Docs](https://ohmyopenagent.com/docs)
- 📜 Overview 源文档：[docs/guide/overview.md](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/overview.md)
- 🔬 深度评测：[Rost Glukhov – Oh My Opencode Specialised Agents Deep Dive](https://www.glukhov.org/ai-devtools/opencode/oh-my-opencode-agents/)
