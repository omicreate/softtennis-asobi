import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { airTime, createLift, FIELD_H, FIELD_W, GRAVITY, LIFT_LEVEL, movePaddle, onFace, stepLift } from './lift'
import type { LiftEvent, LiftState } from './lift'

const DT = 1 / 60

/** ラケットをいつもボールの影の下に置く「うまい人」 */
function perfect(s: LiftState) {
  // 落ちる場所を予想してそこへ
  const b = s.ball
  if (b.vz < 0 || b.z > 0) {
    const t = (b.vz + Math.sqrt(Math.max(0, b.vz * b.vz + 2 * GRAVITY * b.z))) / GRAVITY
    movePaddle(s, b.x + b.vx * t, b.y + b.vy * t)
  }
}

function run(s: LiftState, seconds: number, each?: (s: LiftState) => void, rand = mulberry32(1)): LiftEvent[] {
  const out: LiftEvent[] = []
  for (let t = 0; t < seconds; t += DT) {
    each?.(s)
    out.push(...stepLift(s, DT, rand))
  }
  return out
}

describe('ポンポン リフティング', () => {
  it('1回目はラケットの真上から落ちるので、動かさなくても はねる', () => {
    const s = createLift('chibi')
    const ev = run(s, 2.6)
    expect(ev.filter((e) => e.type === 'pon').length).toBeGreaterThanOrEqual(1)
  })

  it('影の下で受け続けると、回数がふえる', () => {
    const s = createLift('otona')
    const ev = run(s, 30, perfect)
    const pons = ev.filter((e) => e.type === 'pon').length
    expect(pons).toBeGreaterThan(15)
    expect(ev.some((e) => e.type === 'drop')).toBe(false)
  })

  it('ラケットの外に落ちたら おしまい', () => {
    const s = createLift('kids')
    run(s, 2.6)
    // ラケットを遠くへ
    const ev = run(s, 4, (st) => movePaddle(st, st.ball.x > FIELD_W / 2 ? 5 : FIELD_W - 5, FIELD_H - 5))
    expect(ev.some((e) => e.type === 'drop')).toBe(true)
    expect(ev.find((e) => e.type === 'over')).toBeTruthy()
    expect(s.phase).toBe('over')
  })

  it('はねるたびに少しずつ速くなる（でも速くなりすぎない）', () => {
    const s = createLift('otona')
    const t0 = airTime(s)
    s.count = 30
    expect(airTime(s)).toBeLessThan(t0)
    s.count = 500
    expect(airTime(s)).toBeGreaterThanOrEqual(LIFT_LEVEL.otona.air * 0.68 - 1e-9)
  })

  it('面の判定は原画の比率の縦長（横は せまい）', () => {
    const s = createLift('otona')
    movePaddle(s, 50, 80)
    s.ball.x = 50
    s.ball.y = 80 + s.paddle.len / 2 - 1
    expect(onFace(s)).toBe(true)
    s.ball.y = 80
    s.ball.x = 50 + s.paddle.len / 2 - 1
    expect(onFace(s)).toBe(false)
  })

  it('同じ乱数なら、同じ所に飛ぶ（じゅんばんモードで公平）', () => {
    const a = createLift('kids')
    const b = createLift('kids')
    run(a, 10, perfect, mulberry32(7))
    run(b, 10, perfect, mulberry32(7))
    expect(a.ball.x).toBeCloseTo(b.ball.x, 6)
    expect(a.count).toBe(b.count)
  })
})
