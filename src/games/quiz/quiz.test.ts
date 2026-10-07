import { describe, expect, it } from 'vitest'
import { LEVELS, LEVEL_INFO } from '../../core/players'
import { pickRound } from './pick'
import { PIC_IDS } from './pics'
import { poolFor, QUESTIONS } from './questions'

describe('クイズの問題', () => {
  it('IDが重ならない', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('正解が選択肢の中にあり、選択肢は2〜3つで重ならない', () => {
    for (const q of QUESTIONS) {
      expect(q.choices.map((c) => c.id)).toContain(q.answerId)
      expect(q.choices.length).toBeGreaterThanOrEqual(2)
      expect(q.choices.length).toBeLessThanOrEqual(3)
      expect(new Set(q.choices.map((c) => c.text)).size).toBe(q.choices.length)
    }
  })
  it('どの問題にも根拠（知識カード PBK か公式ルールブックの条文）がある', () => {
    for (const q of QUESTIONS) expect(q.source).toMatch(/PBK-\d{4}|公式ルールブック \d/)
  })
  it('こども向けの問題は、どの選択肢にも絵がある（文字が読めなくても選べる）', () => {
    for (const q of QUESTIONS.filter((x) => x.level === 'kids')) {
      for (const c of q.choices) {
        expect(c.pic, `${q.id} ${c.text}`).toBeDefined()
        expect(PIC_IDS).toContain(c.pic)
      }
    }
  })
  it('どのレベルにも、1回の対戦（最大10問）に足りる問題がある', () => {
    for (const lv of LEVELS) {
      const info = LEVEL_INFO[lv]
      expect(poolFor(info.quiz, info.quizMax).length).toBeGreaterThanOrEqual(7)
    }
  })
})

describe('出題', () => {
  it('同じカテゴリの2人には同じ問題（やさしい方に合わせる）', () => {
    const used = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const [a, b] = pickRound(['chibi', 'kids'], used)
      expect(a.q.id).toBe(b.q.id)
      expect(a.q.difficulty).toBe(1)
    }
  })
  it('こどもとおとなには、それぞれのレベルの問題', () => {
    const [a, b] = pickRound(['kids', 'senshu'], new Set())
    expect(a.q.level).toBe('kids')
    expect(b.q.level).toBe('player')
  })
  it('出し切るまで同じ問題は出ない', () => {
    const used = new Set<string>()
    const pool = poolFor('player', 2)
    const seen: string[] = []
    for (let i = 0; i < pool.length; i++) seen.push(pickRound(['otona', 'otona'], used)[0].q.id)
    expect(new Set(seen).size).toBe(pool.length)
  })
  it('選択肢は並べかえても、正解は同じ', () => {
    const [a] = pickRound(['otona', 'otona'], new Set(), () => 0.99)
    expect(a.choices.map((c) => c.id).sort()).toEqual(a.q.choices.map((c) => c.id).sort())
  })
})
