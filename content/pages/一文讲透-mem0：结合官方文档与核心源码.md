---
title: "一文讲透 mem0：结合官方文档与核心源码"
slug: "mem0-analysis"
notionId: 3fe5c572-e7e9-81ea-bbe1-feefa98cd10a
---

在agent领域，特别是针对agent的应用，memory是不可或缺的一环，有些时候memory带给用户的体验甚至大于llm本身，下面就让我们来了解一下mem0这个项目：

---

## 1. 整体架构

分析mem0的源码，可以得出以下架构：

这个分层最重要的理解是：

- `configs/` 负责说明“怎么配”
- `utils/factory.py` 负责“按配置造对象”
- `memory/main.py` 负责“把对象串成 add/search 的业务流水线”
- `llms/embeddings/vector_stores/reranker` 只是被插拔的能力模块
---

## 2. 顶层目录怎么理解

![notion image](/images/notion/bd501d1938db60c25664.webp)

### 2.1 `embeddings/`

本质上就是把不同厂商的 embedding 能力统一成一套标准接口。

你可以把它理解成一个“统一插座”——上层不关心底层是 OpenAI、Gemini、HuggingFace 还是 Ollama，只关心有没有 `embed()`。

### 2.2 `llms/`

和 `embeddings/` 是同样的思路，只不过负责的是模型推理。

在 mem0 里，LLM 不是可有可无的装饰，它直接参与：

- fact extraction
- memory update decision
- graph relation extraction
所以 `llms/` 的地位其实很高。

### 2.3 `vector_stores/`

负责统一不同向量库的 CRUD 与 search 接口。对上层来说，Qdrant、PgVector、Chroma、Pinecone 的区别应该被尽量屏蔽。

### 2.4 `reranker/`

只负责检索后的精排，不负责写入。

rerank 主要不在 `add()` 里，而在正式 `search()` 里。

### 2.5 `utils/`

这个目录最容易被低估。

它其实有两类职责：

第一类：装配工

最关键的是 `factory.py`。它根据配置创建：

- LLM
- embedder
- vector store
- reranker
如果 `configs/` 是说明书，那 `factory.py` 就是总装车间。

第二类：算法和共享工具

比如：

- `entity_extraction.py`
- `lemmatization.py`
- `scoring.py`
- `spacy_models.py`
这些东西不属于某一个 provider，但会被主链路反复调用。

### 2.6 `client/`

它不是 memory engine 本体，而是平台 API 的 SDK。

- `Memory`：本地发动机
- `MemoryClient`：远程遥控器
---

## 3. `memory/` 目录：真正的精华

如果只允许挑一个目录深入分析，那一定是 `memory/`。

![notion image](/images/notion/7e6606e2396b3c29021b.webp)

### 3.1 文件职责

`main.py`

核心 orchestrator（协调者）

负责：

- 初始化 LLM / embedding / vector store / SQLite / reranker / graph
- 对外暴露 `add / search / get / update / delete / history / reset`
- 串联 vector memory 和 graph memory 两条链
`storage.py`

SQLite 本地状态层。

负责两张表：

- `history`：memory 的增删改轨迹
- `messages`：某个 scope 最近的消息缓存
这意味着 mem0 不是只有长期记忆，还显式维护了短期上下文和审计轨迹。

`base.py`

抽象接口层。

`utils.py`

注意这是 `memory/` 内部的 utils，不是顶层 `utils/`。

主要负责：

- prompt 组装
- message 解析
- JSON 清洗
- fact normalization
`telemetry.py`

埋点。

`setup.py`

本地初始化脚手架。

`graph_memory.py / kuzu_memory.py / memgraph_memory.py / apache_age_memory.py`

不同图后端的实现。

---

## 4. `Memory` ：整个系统的大脑

最值得看的是 `memory/main.py` 里的 `Memory`。

原因很简单：它不是一个数据类，而是一个 runtime orchestrator。

初始化的时候，它会把：

- embedding model
- vector store
- llm
- SQLiteManager
- 可选 reranker
- 可选 graph store
都装进同一个对象里。

这意味着 mem0 的 memory 不是某一张表，也不是某一个集合，而是一条由多个组件共同驱动的流水线。

---

## 5. 关键源码：`_add_to_vector_store()`

`_add_to_vector_store()`，基本就是 mem0 的灵魂所在。

### 5.1 总流程图

---

## 6. 第一条分支：`infer=False` 是“原样写入模式”

我们先看源码第一段：

这一段非常直白：

- 消息必须是合法 dict
- 跳过 `system` 消息
- 把 `role`、`actor_id` 写进 metadata
- 对原始 `content` 做 embedding
- 然后直接 `_create_memory()`
它的本质是：

> **不做理解，只做存储。**

适合这几类场景：

- 审计日志
- 原始转录保存
- 法务/医疗等不希望被 LLM 改写的高风险文本
缺点也很明显：

- 冗余高
- 容易重复
- 不会自动处理冲突
所以 `infer=False` 更像 **raw ingest**。

---

## 7. 第二条分支：`infer=True` 才是 mem0 的真正价值

### 7.1 第一阶段：先从消息里抽 facts

源码这一段是：

这段代码有三个关键点。

关键点 1：`custom_instructions` ：抽取规则覆盖层

一旦配置了 `custom_instructions`，默认的 `get_fact_retrieval_messages(...)` 就不会再走。

也就是说：

> `custom_instructions` 本质上是在定义“哪些内容值得被记住”。

这正是业务定制最重要的抓手。

例如：

- 客服：只抽订单、地址、售后诉求
- IDE Agent：只抽 repo 约定、工具偏好、失败经验
- 医疗：只抽过敏史、既往病史、诊疗偏好
关键点 2：agent memory 和 user memory 的分流发生在“抽取阶段”

如果没有 `custom_instructions`，源码会先判断：

这意味着 agent memory 与 user memory 的区别，首先不是底层存储，而是：

- 抽取 prompt 不同
- 抽取视角不同
关键点 3：这里是第一轮 LLM，不是最终写入决策

这次 `generate_response()` 的目标只有一个：

> **从当前对话里抽取 facts**

不是直接返回增删改动作。

---

### 7.2 清洗 LLM 输出：这一步体现了很强的工程意识

接下来是解析响应：

这里可以看出 mem0 处理 LLM 输出的三个策略：

1. 先去掉代码块
1. 先尝试直接解析 JSON
1. 失败后再做 JSON 提取
1. 最后统一做 facts 归一化
这说明作者非常清楚：

> LLM 即使被要求输出 JSON，也并不总是干净可靠。

所以这段代码不是“锦上添花”，而是 LLM 系统工程里非常必要的一层容错。

---

### 7.3 如果没抽出 facts，后面还会继续吗？

源码这里有一句很关键：

这句话意味着：

- 整个函数不会报错退出
- 但第二轮 memory update LLM 会被跳过
- 最终大概率不会产生新的 memory action
所以更准确地说：

> 如果 `custom_instructions` 或默认抽取规则判断“这段内容没有值得记住的 facts”，那后续的 memory lifecycle 决策基本不会发生。

这正是 mem0 的实用价值之一：

**把“不相关内容”挡在长期记忆之外。**

---

## 8. 最关键的一步：不是抽完就存，而是先搜旧 memory

这部分是 mem0 和“普通向量库存文本”的根本分界线。

源码如下：

这段代码说明了三件事。

### 8.1 memory write 不是 append-only，而是 retrieval-assisted

新的 fact 不是抽出来就写，而是先去搜旧 memories。

这个设计特别重要，因为现实里的长期记忆一定会遇到：

- 偏好变化
- 地址更新
- 以前的说法被推翻
- 同一事实被不同表达重复提到
所以 mem0 的设计思路是：

> **先检索旧记忆，再决定这条新信息到底是新增、覆盖、删除还是忽略。**

### 8.2 作用域控制靠 `user_id / agent_id / run_id`

这里的 `search_filters` 明确把：

- `user_id`
- `agent_id`
- `run_id`
都作为检索范围条件。

这说明 mem0 不是两套独立的 user memory / agent memory 系统，而是：

> 同一个 memory engine，用 metadata 和 filters 做多维 scope 管理。

### 8.3 user memory 和 agent memory

底层存储几乎一样：

- 同一个 vector store
- 同一个 SQLite history/messages
- 同一套 create/update/delete 逻辑
真正的区别主要体现在：

- 写入时 metadata 不同
- 检索时 filters 不同
- 抽取时 prompt 视角不同
一句话概括：

> user memory 是“记住这个人”，agent memory 是“记住这个 agent”，run memory 是“记住这次任务”。

---

## 9. 一个特别好的工程细节：为什么要把 UUID 映射成整数

源码这一段我非常喜欢：

作者在注释里已经把原因写出来了：

> 为了处理 UUID hallucination。

意思非常直接：

- 如果把真实 UUID 给 LLM
- LLM 很容易记错、拼错、瞎编
- 所以先给旧 memories 编成 `0/1/2/...`
- LLM 返回动作时只引用这些短编号
- 最后再映射回真实 id
这件事虽然小，但特别能体现系统工程意识：

> 不要让 LLM 直接处理长而脆弱的主键。

这是很典型的“不是算法多先进，而是工程经验很到位”。

---

## 10. 第二轮 LLM：真正的 memory lifecycle

在拿到：

- 新 facts
- 旧 memories
- 可选的 custom update memory prompt
之后，代码会再次调用 LLM：

这一轮和第一轮的区别一定要讲清楚：

- 第一轮：抽 facts
- 第二轮：决定动作
也就是说，mem0 把“理解内容”和“更新状态”拆成了两次 LLM 调用。

这是个很聪明的设计，因为：

- 先抽事实，更容易控制 recall
- 再做动作，更容易处理冲突和覆盖
- 两步拆开后，prompt 更清晰，可调性也更强
---

## 11. `ADD / UPDATE / DELETE / NONE` 四种动作到底意味着什么

源码里对四种动作分别做了处理。

### 11.1 `ADD`

含义很简单：

> 这是一条新的长期记忆，应该新增。

### 11.2 `UPDATE`

这里不是 delete+add，而是显式 `update`。

这个设计特别适合：

- 地址变更
- 偏好变化
- 配置覆盖
- 用户画像更新
### 11.3 `DELETE`

说明 mem0 接受这样一种事实：

> 新信息可能让旧记忆失效。

这也是长期记忆和聊天日志最大的不同之一。

### 11.4 `NONE`

这一支最有意思。

如果内容不需要更新，但有新的 `agent_id` 或 `run_id`，源码仍然会更新 metadata，而不改文本和 embedding。

这意味着：

> 在 mem0 的设计里，“记忆内容”和“记忆归属范围”是两个独立维度。

---

## 12. 代码到底体现了哪些设计思想

基于 `_add_to_vector_store()`，可以把 mem0 的 memory write 设计总结成 5 个关键词。

### 12.1 Retrieval-assisted writing

不是抽出来就存，而是：

- 先抽 facts
- 再搜旧 memories
- 再决定动作
### 12.2 Stateful memory

记忆不是一条条孤立文本，而是有状态、有冲突、有演化的对象。

### 12.3 Scope-aware

旧 memory 检索总是带着：

- `user_id`
- `agent_id`
- `run_id`
这使得 mem0 天然支持多用户、多 agent、多任务隔离。

### 12.4 Prompt-driven

`custom_instructions` 和 `custom_update_memory_prompt` 让“记什么”“怎么更新”都变成可配置规则，而不是硬编码。

### 12.5 LLM-aware engineering

像 UUID 映射成整数这种细节，说明源码非常了解 LLM 的脆弱点，并且为此做了工程优化。

---

## 13. Graph memory：和 vector memory 是什么关系

这一节不只停留在 `main.py` 的 `_add_to_graph()` 包装层，而是要继续下钻到 `graph_memory.py`。因为真正的 graph 逻辑，不是在 orchestrator 里，而是在 graph backend 的 `add()` 里。

### 13.1 直接看 `graph_memory.py`：`add()` 怎么做 graph 写入

官方仓库里，`graph_memory.py` 的 `add()` 主体调用链可以概括成下面这段：

这段代码非常关键，因为它直接暴露了 graph memory 的完整写入流程。它不是“收到一段文本就落图”，而是分成了五步：

1. `_retrieve_nodes_from_data(...)`：先从文本里抽实体，并建立 `entity_type_map`
1. `_establish_nodes_relations_from_data(...)`：再基于实体去抽关系，形成待新增关系集合
1. `_search_graph_db(...)`：去现有图里搜索这些实体相关的旧关系
1. `_get_delete_entities_from_search_output(...)`：判断旧关系里哪些应该被删除
1. `_delete_entities(...)` + `_add_entities(...)`：最后真正执行图里的删除和新增
所以从这段 `add()` 本身就能看出来：

> graph memory 不是简单存储，而是一个“抽实体 → 抽关系 → 对齐旧图 → 删除旧关系 → 新增新关系”的图生命周期管理流程。

### 13.2 graph 里 LLM 到底参与在什么地方

答案就在 `graph_memory.py` 的内部函数里。

1. 抽实体：`_retrieve_nodes_from_data()` 里直接调用了 LLM

源码里，实体抽取函数会直接调用：

这一步的目标不是聊天，而是：

- 从原始文本里抽取实体
- 给每个实体分配类型
- 最后形成 `entity_type_map`
后面它还会解析 tool call，把实体结果整理成映射表。也就是说：

> graph memory 的第一步不是存文本，而是先让 LLM 把文本理解成“实体集合”。

2. 抽关系：`_establish_nodes_relations_from_data()` 再调用一次 LLM

接下来 graph 不是直接把实体写成节点就结束了，而是还要继续抽关系。对应逻辑会再次调用：

这一步不是抽实体，而是：

- 基于已经抽出来的实体集合
- 再结合原始文本
- 让模型建立实体之间的关系
- 最后形成待写入图数据库的关系三元组
所以 graph memory 的写入至少包含两轮语义抽取：

- 第一轮：抽实体
- 第二轮：抽关系
3. 删除旧关系：graph 里连“删什么”都交给 LLM 决策

还有一个特别容易被忽略的点：graph memory 不只是抽实体和关系，它连“哪些旧关系该删”也会让 LLM 参与决策。

对应函数 `_get_delete_entities_from_search_output(...)` 里也会调用：

这一步的目标是：

- 先拿到旧图里的关系
- 再结合当前输入文本
- 让模型判断哪些旧关系已经过时或冲突
- 然后再执行删除
所以 graph memory 的完整生命周期其实很清晰：

- 抽实体
- 抽关系
- 查旧图
- 判定删除
- 新增新关系
换句话说：

> graph memory 不是 append-only，而是一个由 LLM 驱动的关系图重写流程。

### 13.3 所以 graph memory 和 vector memory 到底哪里像，哪里不像

相似点：都不是“原文直接入库”

不管是 vector memory 还是 graph memory，它们都不是简单把原始文本塞进存储层。

- vector memory：抽 facts，再做 `ADD / UPDATE / DELETE / NONE`
- graph memory：抽 entities，再抽 relations，再决定删什么、加什么
从系统设计角度看，这两者都属于“语义先行，再持久化”的 memory pipeline。

不同点：两者处理的对象完全不同

vector memory 处理的是 **fact / memory item**

vector 更关心的是：

- 这句话里有什么事实值得记住
- 这条事实是新增、覆盖、删除还是忽略
graph memory 处理的是 **entity / relation / node / edge**

graph 更关心的是：

- 这段文本里出现了哪些实体
- 实体之间是什么关系
- 旧关系哪些需要失效
- 新关系哪些需要写入
所以一句话概括：

> vector memory 更像“记住一句有用的话”，graph memory 更像“把这句话拆成实体和关系网络”。

### 13.4 graph 的 CRUD 怎么理解

从 `graph_memory.py` 这套实现来看，graph memory 至少有比较清晰的生命周期：

- Create：`_add_entities(...)` 新增 node / edge
- Read：`search()` 返回 relations 相关结果
- Delete：`_delete_entities(...)` 删除或失效旧关系
- Update：更像通过一次新的 `add()` 流程触发“旧关系删除 + 新关系新增”来完成重写，而不是暴露一个单独的 `graph.update()` 公共接口
这一点和 vector memory 的区别也很明显：

- vector memory 强调单条 fact 的生命周期管理
- graph memory 更强调关系网络的维护与重构
也就是说，vector 更像“对象级记忆”，graph 更像“关系级记忆”。

---

## 14. Rerank 与业务设计：mem0 真正值钱的地方是什么

很多人会把 mem0 的价值理解成“能记住用户偏好”，但这其实只看到了表面。真正有业务价值的是，它把“长期记忆”拆成了几层可运营、可调规则的策略。

### 14.1 rerank 体现在哪里，为什么不放在 add 阶段

这个问题很容易被问到。

结论是：

> **rerank 主要体现在** `search()`**，而不是** `add()` **的旧 memory 搜索阶段。**

原因并不复杂。

add 阶段搜旧 memories，目标是“判断状态”

在 `_add_to_vector_store()` 里，旧 memory 搜索的目的是：

- 判断是否重复
- 判断是否冲突
- 判断应该 `ADD / UPDATE / DELETE / NONE`
这一步要求的是：

- 足够快
- 足够稳
- 能提供大致相关的旧 memory 即可
所以这里通常不需要再加一层昂贵的 rerank。

search 阶段面向的是“对外召回质量”

而正式的 `search()` 则完全不同。它的目标是：

- 给 agent 注入更高质量上下文
- 给用户返回更准确的 memory
- 把 semantic search、keyword search、entity boost 之后的结果再精排
所以 rerank 更适合放在这里。

这其实是个很合理的分层：

- `add()`：偏写入决策，关注状态判断
- `search()`：偏对外召回，关注结果质量
### 14.2 业务上真正值钱的是四层策略

如果站在业务设计视角看，mem0 真正有价值的不是“支持很多模型和很多库”，而是把长期记忆拆成了四层可运营策略。

第一层：写入策略——什么值得记

通过 `custom_instructions` 定义。

这决定了：

- 什么内容允许进入长期记忆
- 什么内容必须被过滤掉
这对真实业务特别重要。因为业务通常不需要“尽可能多地记忆”，而是需要“只记高价值信息”。

例如：

- 客服：只记订单、地址、售后诉求
- 医疗：只记过敏史、既往病史、诊疗偏好
- IDE Agent：只记 repo 约定、工具偏好、失败经验
第二层：更新策略——新旧事实冲突时怎么办

通过 `custom_update_memory_prompt` 定义。

这决定了：

- 什么情况应该新增
- 什么情况应该覆盖
- 什么情况应该删除
- 什么情况应该保持 `NONE`
这一步直接决定 memory system 是“日志堆积”，还是“有状态、可演化的长期记忆”。

第三层：作用域策略——这条 memory 属于谁

通过：

- `user_id`
- `agent_id`
- `run_id`
定义。

这意味着你可以把记忆清晰地分成：

- 属于某个用户的长期偏好
- 属于某个 agent 的经验或专属上下文
- 属于某次 run 的短期任务信息
这也是 mem0 可以支撑多用户、多 agent、多任务系统的核心原因。

第四层：检索质量策略——怎么把相关 memory 找准

这一层由多个模块共同决定：

- vector search
- keyword search
- entity boost
- rerank
- graph relations
从系统角度看，mem0 并不是简单的 ANN 检索，而是在逐步把 search 做成一套多路增强的召回与精排系统。

### 14.3 所以 mem0 真正值钱的地方到底是什么

如果只从“它能记住用户偏好”来看 mem0，其实低估它了。

我更倾向于把它总结成一句话：

> mem0 的真正价值，不是“它支持很多向量库”，而是“它把 memory 变成了一套可运营的业务系统”。

也就是说，mem0 最有价值的地方，不是某一个 provider，也不是某一个 graph backend，而是它把长期记忆拆成了：

- 可以控制写什么
- 可以控制怎么改
- 可以控制记给谁
- 可以控制怎么找
这四层策略。

这才是它和“自己手搓一个向量库 + embedding + search”最大的差别。

---

## 参考资料

[mem0ai/mem0: Universal memory layer for AI Agents](https://github.com/mem0ai/mem0)

[Mem0 源码解析系列（一）：记忆是如何被添加的 - 肥肥旭手记 - 博客园](https://www.cnblogs.com/wylrcx/p/19842964)
