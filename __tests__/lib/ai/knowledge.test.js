import { searchKnowledgeByText, isKnowledgeReady } from '@/lib/ai/knowledge'

describe('lib/ai/knowledge 文本检索模式', () => {
  test('知识库就绪（content/index.json 存在）', () => {
    expect(isKnowledgeReady()).toBe(true)
  })

  test('中文问题能召回相关段落并带元数据', () => {
    const results = searchKnowledgeByText('agent 是什么，什么时候该用 agent', 5)
    expect(results.length).toBeGreaterThan(0)
    const top = results[0]
    expect(top.title).toBeTruthy()
    expect(top.text).toBeTruthy()
    expect(top.score).toBeGreaterThan(0)
    // 命中的应该与 agent 相关
    const combined = `${top.title}${top.heading}${top.text}`
    expect(combined.toLowerCase()).toMatch(/agent/)
  })

  test('无关问题返回空或低分', () => {
    const results = searchKnowledgeByText('量子纠缠的薛定谔方程推导', 5)
    // 站内没写这个话题，不应给出高分召回
    expect(results.every(r => r.score < 0.5)).toBe(true)
  })

  test('topK 生效', () => {
    expect(searchKnowledgeByText('mem0 记忆', 2).length).toBeLessThanOrEqual(2)
  })
})

describe('lib/ai/knowledge 混合检索', () => {
  const fs = require('fs')
  const path = require('path')
  const file = path.join(process.cwd(), 'content', '.embeddings.json')

  test('用已生成向量自查询能命中对应段落', () => {
    if (!fs.existsSync(file)) return // 没生成向量时跳过（CI 会在同步后生成）
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const sample = raw.chunks.find(c => Array.isArray(c.vector))
    const { searchKnowledgeHybrid } = require('@/lib/ai/knowledge')
    const hits = searchKnowledgeHybrid(sample.vector, sample.title, 3)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].file).toBe(sample.file)
  })
})
