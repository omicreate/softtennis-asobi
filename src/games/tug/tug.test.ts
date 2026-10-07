import { describe, expect, it } from 'vitest'
import { COUNTDOWN, createTug, MAX_RATE, POINT_TIME, ROUND_TIME, stepTug, tap, TUG_POWER } from './tug'
import type { TugEvent, TugState } from './tug'

const DT = 1 / 60

function run(s: TugState, seconds: number, each?: (s: TugState) => void): TugEvent[] {
  const out: TugEvent[] = []
  for (let t = 0; t < seconds; t += DT) {
    each?.(s)
    out.push(...stepTug(s, DT))
  }
  return out
}

describe('れんだ つなひき', () => {
  it('3・2・1 のあいだのタップは数えない', () => {
    const s = createTug(['otona', 'otona'])
    expect(tap(s, 0)).toBe(false)
    const ev = run(s, COUNTDOWN + 0.1)
    expect(ev.filter((e) => e.type === 'count').map((e) => (e as { n: number }).n)).toEqual([2, 1])
    expect(ev.some((e) => e.type === 'go')).toBe(true)
    expect(s.phase).toBe('pull')
  })

  it('1秒に数えるのは上限まで（指を何本使っても）', () => {
    const s = createTug(['otona', 'otona'])
    run(s, COUNTDOWN + 0.05)
    let counted = 0
    // 1秒間、毎フレーム3回ずつタップ（180回）
    run(s, 1, (st) => {
      for (let i = 0; i < 3; i++) if (tap(st, 0)) counted++
    })
    expect(counted).toBeLessThanOrEqual(MAX_RATE + 1)
    expect(counted).toBeGreaterThanOrEqual(MAX_RATE - 2)
  })

  it('押しこんだ人がラウンドの勝ち。先に2回勝ったら終わり', () => {
    const s = createTug(['otona', 'otona'])
    const ev: TugEvent[] = []
    for (let r = 0; r < 2; r++) {
      ev.push(...run(s, COUNTDOWN + 0.05))
      ev.push(...run(s, 5, (st) => tap(st, 0)))
      ev.push(...run(s, POINT_TIME + 0.1))
    }
    const rounds = ev.filter((e) => e.type === 'round')
    expect(rounds).toHaveLength(2)
    expect(ev.find((e) => e.type === 'over')).toEqual({ type: 'over', winner: 0 })
  })

  it('同じ速さで連打すると、小さい子のレベルの方が押せる（手加減）', () => {
    expect(TUG_POWER.chibi).toBeGreaterThan(TUG_POWER.kids)
    expect(TUG_POWER.kids).toBeGreaterThan(TUG_POWER.otona)
    const s = createTug(['chibi', 'otona'])
    run(s, COUNTDOWN + 0.05)
    // 2人とも 1秒に7回
    let k = 0
    run(s, 3, (st) => {
      if (k++ % 9 === 0) {
        tap(st, 0)
        tap(st, 1)
      }
    })
    expect(s.pos).toBeGreaterThan(0.3)
  })

  it('時間切れは、ボールが相手側にある人の勝ち。まんなかなら ひきわけでやり直し', () => {
    const s = createTug(['otona', 'otona'])
    run(s, COUNTDOWN + 0.05)
    tap(s, 1)
    const ev = run(s, ROUND_TIME + 0.1)
    expect(ev.find((e) => e.type === 'round')).toMatchObject({ winner: 1 })

    const d = createTug(['otona', 'otona'])
    run(d, COUNTDOWN + 0.05)
    const ev2 = run(d, ROUND_TIME + 0.1)
    expect(ev2.find((e) => e.type === 'round')).toMatchObject({ winner: null })
    run(d, POINT_TIME + 0.1)
    expect(d.phase).toBe('ready')
    expect(d.wins).toEqual([0, 0])
  })
})

describe('れんだ つなひき（2たい2）', () => {
  it('チーム戦は1秒に数えるタップが2人ぶん', () => {
    const s = createTug(['otona', 'otona'], true)
    run(s, COUNTDOWN + 0.05)
    let counted = 0
    run(s, 1, (st) => {
      for (let i = 0; i < 3; i++) if (tap(st, 0)) counted++
    })
    expect(counted).toBeGreaterThan(MAX_RATE + 5)
  })
})
