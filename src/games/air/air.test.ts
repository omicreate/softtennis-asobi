import { describe, expect, it } from 'vitest'
import { AIR_LEVEL, aim, BALL_R, createAir, FIELD_H, FIELD_W, paddleBounds, stepAir, TARGET } from './air'
import type { AirEvent, AirState } from './air'

const DT = 1 / 60

function run(s: AirState, seconds: number, each?: (s: AirState) => void): AirEvent[] {
  const out: AirEvent[] = []
  for (let t = 0; t < seconds; t += DT) {
    each?.(s)
    out.push(...stepAir(s, DT))
  }
  return out
}

function started(levels: AirState['levels'] = ['otona', 'otona']) {
  const s = createAir(levels)
  run(s, 3.1)
  expect(s.phase).toBe('play')
  return s
}

describe('エアピックル', () => {
  it('パドルは自分の半分から出ない', () => {
    const s = createAir(['otona', 'otona'])
    aim(s, 0, 50, 10)
    run(s, 0.5)
    const b0 = paddleBounds(s.paddles[0], 0)
    expect(s.paddles[0].y).toBeCloseTo(b0.y0, 3)
    expect(s.paddles[0].y - s.paddles[0].len / 2).toBeGreaterThan(FIELD_H / 2)
    aim(s, 1, -20, 200)
    run(s, 0.5)
    expect(s.paddles[1].y + s.paddles[1].len / 2).toBeLessThan(FIELD_H / 2)
    expect(s.paddles[1].x).toBeGreaterThanOrEqual(s.paddles[1].wid / 2 - 1e-9)
  })

  it('下の人がパドルを上へ動かして当てると、球は上へ飛ぶ', () => {
    const s = started()
    // 球を下の半分に置いて、真下からパドルを当てる
    s.ball = { x: 50, y: 110, vx: 0, vy: 0 }
    s.paddles[0].x = s.paddles[0].tx = 50
    s.paddles[0].y = s.paddles[0].ty = 140
    const ev: AirEvent[] = []
    for (let i = 0; i < 30; i++) {
      aim(s, 0, 50, 140 - i * 3)
      ev.push(...stepAir(s, DT))
    }
    expect(ev.some((e) => e.type === 'hit' && e.side === 0)).toBe(true)
    expect(s.ball.vy).toBeLessThan(0)
  })

  it('ゴールの口に入ると点。口の外の壁では はね返る', () => {
    const s = started()
    s.ball = { x: FIELD_W / 2, y: 10, vx: 0, vy: -80 }
    s.hit = true
    const ev = run(s, 0.5)
    expect(ev.find((e) => e.type === 'goal')).toMatchObject({ scorer: 0 })
    expect(s.score).toEqual([1, 0])

    const t = started()
    t.ball = { x: 6, y: 10, vx: 0, vy: -80 }
    t.hit = true
    const ev2 = run(t, 0.2)
    expect(ev2.some((e) => e.type === 'goal')).toBe(false)
    expect(t.ball.vy).toBeGreaterThan(0)
    expect(t.ball.y).toBeGreaterThanOrEqual(BALL_R - 1e-9)
  })

  it(`${TARGET}点とったら終わり`, () => {
    const s = started()
    s.score = [TARGET - 1, 0]
    s.ball = { x: FIELD_W / 2, y: 8, vx: 0, vy: -80 }
    s.hit = true
    const ev = run(s, 0.4)
    expect(ev.find((e) => e.type === 'over')).toEqual({ type: 'over', winner: 0 })
    expect(s.phase).toBe('over')
  })

  it('小さい子の方へ向かう球は遅い（手加減）', () => {
    expect(AIR_LEVEL.chibi.maxSpeed).toBeLessThan(AIR_LEVEL.senshu.maxSpeed)
    const s = started(['chibi', 'senshu'])
    s.hit = true
    s.ball = { x: 50, y: 60, vx: 0, vy: 400 }
    run(s, DT * 2)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeLessThanOrEqual(AIR_LEVEL.chibi.maxSpeed + 1e-6)
    s.ball = { x: 50, y: 110, vx: 0, vy: -400 }
    run(s, DT * 2)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeGreaterThan(AIR_LEVEL.chibi.maxSpeed)
  })

  it('打ったあとの球は止まらない（取れなくならない）', () => {
    const s = started()
    s.hit = true
    s.ball = { x: 30, y: 85, vx: 0.5, vy: 0 }
    run(s, 3)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeGreaterThan(5)
  })
})

describe('エアピックル（時間のずれ）', () => {
  it('経過時間が0やマイナスでも、パドルの位置がこわれない', () => {
    const s = createAir(['otona', 'otona'])
    aim(s, 0, 20, 120)
    stepAir(s, 0)
    stepAir(s, -0.002)
    stepAir(s, 1 / 60)
    for (const p of s.paddles) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})
