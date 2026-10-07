/** おとなも むちゅう：リアクション ボレー */
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/rng'
import { createRx, FOUL_MS, stepRx, tapRx, totals, TRIES as RX_TRIES } from './reaction/reaction'
import type { RxEvent } from './reaction/reaction'

const DT = 1 / 60
describe('リアクション ボレー', () => {
  it('球が見えてからタップまでの時間を5回はかる。早すぎたらフライング', () => {
    const rand = mulberry32(3)
    const s = createRx('kids', rand)
    const ev: RxEvent[] = []
    let i = 0
    while (s.phase !== 'over' && i++ < 100000) {
      ev.push(...stepRx(s, DT, rand))
      // 1回目はフライング、あとは球が見えて 0.25秒後
      if (s.results.length === 0 && s.phase === 'wait' && s.t > 0.5) tapRx(s, ev, rand)
      else if (s.phase === 'go' && s.t >= 0.25) tapRx(s, ev, rand)
    }
    expect(s.results).toHaveLength(RX_TRIES)
    expect(s.results[0]).toBe(FOUL_MS)
    expect(s.fouls).toBe(1)
    const t = totals(s)
    expect(t.score).toBe(t.avg + 100)
  })

  it('おとな・せんしゅにはフェイントがまざる', () => {
    let fakes = 0
    for (let seed = 1; seed < 40; seed++) {
      const rand = mulberry32(seed)
      const s = createRx('senshu', rand)
      for (let i = 0; i < 600; i++) for (const e of stepRx(s, DT, rand)) if (e.type === 'fake') fakes++
    }
    expect(fakes).toBeGreaterThan(3)
  })
})
