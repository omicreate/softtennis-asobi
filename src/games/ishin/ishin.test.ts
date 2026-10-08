import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { I_COUNTS, isMatch, pairScores, pairsFor, passOrder, pickQuestions, rating } from './ishin'
import { I_DECKS, I_QUESTIONS, questionsFor } from './questions'

describe('いしんでんしん ダブルスの しつもん', () => {
  it('id は重ならない。どのしつもんも選択肢が2つ以上で、同じ選択肢はない', () => {
    expect(new Set(I_QUESTIONS.map((q) => q.id)).size).toBe(I_QUESTIONS.length)
    for (const q of I_QUESTIONS) {
      expect(q.choices.length, q.id).toBeGreaterThanOrEqual(2)
      expect(new Set(q.choices.map((c) => c.text)).size, q.id).toBe(q.choices.length)
    }
  })

  it('どの山も、いちばん多い問題数（10もん）より多い', () => {
    for (const d of I_DECKS) expect(questionsFor(d).length, d).toBeGreaterThanOrEqual(Math.max(...I_COUNTS))
  })

  it('「え」の選択肢は どれも絵か色がある（字が読めない子のため）', () => {
    for (const q of questionsFor('e')) for (const c of q.choices) expect(c.pic || c.qpic || c.swatch, `${q.id}/${c.text}`).toBeTruthy()
  })

  it('まめちしきには根拠（ルールブックの条番号）がある。作戦の正解は書かない', () => {
    for (const q of I_QUESTIONS) if (q.tip) expect(q.tip, q.id).toMatch(/第\d+条/)
    expect(questionsFor('doubles').length).toBeGreaterThanOrEqual(10)
  })
})

describe('いしんでんしん ダブルスの 進めかた', () => {
  it('1回の中では同じしつもんが出ない。続けて遊んでも、出し切るまで出ない', () => {
    const rand = mulberry32(9)
    const used = new Set<string>()
    const a = pickQuestions('doubles', 5, rand, used)
    const b = pickQuestions('doubles', 5, rand, used)
    expect(new Set([...a, ...b].map((q) => q.id)).size).toBe(10)
    // 選択肢は並べかえるだけ（中身は同じ）
    const orig = I_QUESTIONS.find((q) => q.id === a[0].id)!
    expect([...a[0].choices.map((c) => c.text)].sort()).toEqual([...orig.choices.map((c) => c.text)].sort())
    // 出し切ったら また出る（同じ回の中では重ならない）
    const c = pickQuestions('doubles', 10, rand, used)
    expect(new Set(c.map((q) => q.id)).size).toBe(10)
  })

  it('ペアと、てわたしの順（同じペアが続かない）', () => {
    expect(pairsFor(2)).toEqual([[0, 1]])
    expect(pairsFor(4)).toEqual([
      [0, 1],
      [2, 3],
    ])
    expect(passOrder(4)).toEqual([0, 2, 1, 3])
    expect(passOrder(2)).toEqual([0, 1])
  })

  it('そろったか・ペアごとの点・なかよし度', () => {
    expect(isMatch([1, 1], [0, 1])).toBe(true)
    expect(isMatch([1, 2], [0, 1])).toBe(false)
    expect(isMatch([undefined, undefined], [0, 1])).toBe(false)
    const h = [
      [0, 0, 1, 2],
      [2, 1, 3, 3],
      [1, 1, 0, 0],
    ]
    expect(pairScores(h, 4)).toEqual([2, 2])
    expect(pairScores([[0, 0], [1, 2]], 2)).toEqual([1])
    expect(rating(5, 5)).toBe('いしんでんしん！')
    expect(rating(3, 5)).toBe('さいこうの あいぼう')
    expect(rating(2, 5)).toBe('なかよし ペア')
    expect(rating(0, 5)).toBe('これから なかよし')
  })
})
