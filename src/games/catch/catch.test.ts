import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { BASKET_Y, CATCH_LEVEL, createCatch, GOOD, inBasket, moveBasket, stepCatch } from './catch'
import type { CatchEvent, CatchState } from './catch'

const DT = 1 / 60

function run(s: CatchState, seconds: number, each?: (s: CatchState) => void, rand = mulberry32(3)): CatchEvent[] {
  const out: CatchEvent[] = []
  for (let t = 0; t < seconds && s.phase !== 'over'; t += DT) {
    each?.(s)
    out.push(...stepCatch(s, DT, rand))
  }
  return out
}

/** いちばん近い「ピックルボール」の下へ かごを動かし、ほかのボールからは よける人 */
function smart(s: CatchState) {
  const good = s.items.filter((i) => !i.done && GOOD.includes(i.kind) && i.y < BASKET_Y).sort((a, b) => b.y - a.y)[0]
  if (good) moveBasket(s, good.x)
}

describe('ボールキャッチ', () => {
  it('ちびっこには テニスボールが出ない（見た目がちがうボールだけ）', () => {
    expect(CATCH_LEVEL.chibi.mix.some(([k]) => k === 'tennis')).toBe(false)
    expect(CATCH_LEVEL.kids.mix.some(([k]) => k === 'tennis')).toBe(true)
    // 大きいレベルほど テニスボールが多い
    const share = (lv: keyof typeof CATCH_LEVEL) => {
      const mix = CATCH_LEVEL[lv].mix
      const total = mix.reduce((a, [, w]) => a + w, 0)
      return (mix.find(([k]) => k === 'tennis')?.[1] ?? 0) / total
    }
    expect(share('senshu')).toBeGreaterThan(share('kids'))
  })

  it('かごの下で受けると点。ほかのボールを受けるとライフがへる', () => {
    const s = createCatch('otona')
    s.phase = 'play'
    s.next = 99
    s.items.push({ id: 1, kind: 'pickle', x: 30, y: BASKET_Y - 1, vy: 60, spin: 0, done: false })
    s.items.push({ id: 2, kind: 'tennis', x: 30, y: BASKET_Y - 2, vy: 60, spin: 0, done: false })
    moveBasket(s, 30)
    const ev = run(s, 0.1)
    expect(ev.find((e) => e.type === 'good')).toMatchObject({ kind: 'pickle', score: 1 })
    expect(ev.find((e) => e.type === 'bad')).toMatchObject({ kind: 'tennis', lives: CATCH_LEVEL.otona.lives - 1 })
  })

  it('きんの ボールは3点', () => {
    const s = createCatch('kids')
    s.phase = 'play'
    s.next = 99
    s.items.push({ id: 1, kind: 'gold', x: 70, y: BASKET_Y - 1, vy: 60, spin: 0, done: false })
    moveBasket(s, 70)
    run(s, 0.1)
    expect(s.score).toBe(3)
  })

  it('時間が来たら終わり。上手に動かすと点がたまる', () => {
    const s = createCatch('kids', 20)
    const ev = run(s, 25, smart)
    expect(ev.find((e) => e.type === 'over')).toBeTruthy()
    expect(s.score).toBeGreaterThan(8)
  })

  it('かごの幅の外は受けない', () => {
    const s = createCatch('senshu')
    moveBasket(s, 50)
    expect(inBasket(s, 50 + CATCH_LEVEL.senshu.basket / 2)).toBe(true)
    expect(inBasket(s, 50 + CATCH_LEVEL.senshu.basket / 2 + 4)).toBe(false)
  })

  it('同じ乱数なら、同じボールが同じ所に落ちる（じゅんばんモードで公平）', () => {
    const a = createCatch('otona', 10)
    const b = createCatch('otona', 10)
    run(a, 5, undefined, mulberry32(9))
    run(b, 5, undefined, mulberry32(9))
    expect(a.items.map((i) => [i.kind, i.x.toFixed(3)])).toEqual(b.items.map((i) => [i.kind, i.x.toFixed(3)]))
  })
})
