import { describe, expect, it } from 'vitest'
import { decide } from './buzzer'
import { LEVEL_INFO, LEVELS } from './players'

describe('早押しの判定', () => {
  it('先に正しく押した人の勝ち', () => {
    expect(decide([{ side: 0, at: 300, correct: true }], 300, [0, 0], 5000)).toEqual({ done: false, winner: null })
    expect(decide([{ side: 0, at: 300, correct: true }], 301, [0, 0], 5000)).toEqual({ done: true, winner: 0 })
  })
  it('遅れ（手加減）を足して比べる：おとなが先に押しても、子どもが間に合えば子どもの勝ち', () => {
    // 下＝ちびっこ（0ms）、上＝せんしゅ（400ms）
    const delays: [number, number] = [0, 400]
    const presses = [
      { side: 1 as const, at: 300, correct: true },
      { side: 0 as const, at: 600, correct: true },
    ]
    expect(decide(presses.slice(0, 1), 500, delays, 5000).done).toBe(false)
    expect(decide(presses, 600, delays, 5000)).toEqual({ done: true, winner: 0 })
  })
  it('まちがえた人は、そのラウンドは押せない（相手が正解すれば相手の勝ち）', () => {
    const presses = [
      { side: 0 as const, at: 200, correct: false },
      { side: 1 as const, at: 900, correct: true },
    ]
    expect(decide(presses.slice(0, 1), 300, [0, 0], 5000).done).toBe(false)
    expect(decide(presses, 900, [0, 0], 5000)).toEqual({ done: true, winner: 1 })
  })
  it('2人ともまちがえたら、どちらの点にもならない', () => {
    const presses = [
      { side: 0 as const, at: 200, correct: false },
      { side: 1 as const, at: 300, correct: false },
    ]
    expect(decide(presses, 300, [0, 0], 5000)).toEqual({ done: true, winner: null })
  })
  it('時間切れ', () => {
    expect(decide([], 5000, [0, 0], 5000)).toEqual({ done: true, winner: null })
  })
})

describe('レベルの表', () => {
  it('すべてのレベルに手加減の値がある', () => {
    for (const lv of LEVELS) {
      const info = LEVEL_INFO[lv]
      expect(info.paddleWidth).toBeGreaterThan(0)
      expect(info.ballSpeed).toBeGreaterThan(0)
      expect(info.pressDelay).toBeGreaterThanOrEqual(0)
    }
  })
  it('小さい子ほど、ラケットが大きく、球がゆっくりで、早押しの遅れが少ない', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = LEVEL_INFO[LEVELS[i - 1]]
      const b = LEVEL_INFO[LEVELS[i]]
      expect(a.paddleWidth).toBeGreaterThan(b.paddleWidth)
      expect(a.ballSpeed).toBeLessThan(b.ballSpeed)
      expect(a.pressDelay).toBeLessThan(b.pressDelay)
    }
  })
})
