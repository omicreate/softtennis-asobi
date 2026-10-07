import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { bestActors, CARDS, cardsFor, drawCard, teamTotal, turnScore } from './gesture'

describe('ジェスチャー ピックル', () => {
  it('お題の id は重ならない。どのお題にも、当てる ことばと まねの ヒントがある', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
    for (const c of CARDS) {
      expect(c.say.length, c.id).toBeGreaterThan(0)
      expect(c.act.length, c.id).toBeGreaterThan(0)
    }
    expect(cardsFor('kids').length).toBeGreaterThanOrEqual(12)
    expect(cardsFor('kids').every((c) => c.deck === 'kids')).toBe(true)
    expect(cardsFor('pickle').length).toBeGreaterThan(cardsFor('kids').length)
  })

  it('まめちしきには根拠（PBK）がある', () => {
    for (const c of CARDS) if (c.tip) expect(c.tip, c.id).toMatch(/PBK-\d{4}/)
  })

  it('出し切るまで同じお題は出ない', () => {
    const rand = mulberry32(5)
    const used = new Set<string>()
    const n = cardsFor('kids').length
    const ids = Array.from({ length: n }, () => drawCard('kids', used, rand).id)
    expect(new Set(ids).size).toBe(n)
    expect(drawCard('kids', used, rand).deck).toBe('kids')
  })

  it('みんなの合計と、いちばん伝えた人', () => {
    const [a, b, c] = CARDS
    const logs = [
      [
        { card: a, got: true },
        { card: b, got: false },
      ],
      [
        { card: b, got: true },
        { card: c, got: true },
      ],
      [],
    ]
    expect(turnScore(logs[0])).toBe(1)
    expect(teamTotal(logs)).toBe(3)
    expect(bestActors(logs)).toEqual([1])
    expect(bestActors([[], []])).toEqual([])
  })
})
