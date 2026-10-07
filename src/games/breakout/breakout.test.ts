import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../core/players'
import type { Side } from '../../core/players'
import { BALL_R, BREAKOUT_LEVEL, createBreakout, faceH, FIELD_W, launch, makeBricks, movePaddle, stepBreakout, STAGES } from './breakout'
import type { BEvent, BreakoutState } from './breakout'

/** パドルを球の下に置き続けるボット（ずれ＝パドルの中心からずらす量） */
function autoplay(s: BreakoutState, seconds: number, offset = 0) {
  const ev: BEvent[] = []
  for (let t = 0; t < seconds && s.phase !== 'over'; t += 1 / 60) {
    for (const side of (s.two ? [0, 1] : [0]) as Side[]) {
      const mine = s.balls.filter((b) => (side === 0 ? b.vy >= 0 : b.vy <= 0))
      const b = mine.sort((a, c) => (side === 0 ? c.y - a.y : a.y - c.y))[0]
      // 人のように、当てる場所を少しずつ変える
      if (b) movePaddle(s, side, b.x + offset * Math.sin(t * 1.3 + side))
    }
    ev.push(...stepBreakout(s, 1 / 60))
  }
  return ev
}

describe('ピクルくずし（ひとり）', () => {
  it('球はパドルにのって始まり、少し待つと自動で打ち出す', () => {
    const s = createBreakout(['kids', 'kids'], false)
    expect(s.balls[0].stuck).toBe(true)
    stepBreakout(s, 2)
    expect(s.balls[0].stuck).toBe(false)
    expect(s.balls[0].vy).toBeLessThan(0)
  })
  it('パドルの端で打つほど、斜めに飛ぶ', () => {
    const angleAt = (off: number) => {
      const s = createBreakout(['otona', 'otona'], false)
      const p = s.paddles[0]
      launch(s, 0)
      const b = s.balls[0]
      b.x = p.x + off * (p.w / 2)
      b.y = p.y - faceH(p) / 2 - BALL_R + 0.5
      b.vx = 0
      b.vy = 50
      stepBreakout(s, 1 / 240)
      return Math.abs(b.vx / b.vy)
    }
    expect(angleAt(0.9)).toBeGreaterThan(angleAt(0.1))
  })
  it('ブロックに当たると跳ね返って点が入る。ピクルスは2回当てるとくずれて2点', () => {
    const s = createBreakout(['otona', 'otona'], false)
    s.bricks = [{ x: 40, y: 50, w: 20, h: 5, hp: 2, kind: 'pickle' }]
    s.balls = [{ x: 50, y: 60, vx: 0, vy: -100, owner: 0, stuck: false, wait: 0 }]
    const ev = stepBreakout(s, 0.1)
    expect(ev.find((e) => e.type === 'brick')).toEqual({ type: 'brick', owner: 0, broke: false })
    expect(s.balls[0].vy).toBeGreaterThan(0)
    s.balls[0].y = 60
    s.balls[0].vy = -100
    stepBreakout(s, 0.1)
    expect(s.bricks.length).toBe(0)
    expect(s.score[0]).toBe(2)
  })
  it('球を落とすとライフがへり、0で終わる', () => {
    const s = createBreakout(['senshu', 'senshu'], false)
    s.lives = 1
    s.balls = [{ x: 50, y: s.H - 1, vx: 0, vy: 100, owner: 0, stuck: false, wait: 0 }]
    movePaddle(s, 0, 5)
    const ev = stepBreakout(s, 0.2)
    expect(ev.some((e) => e.type === 'miss')).toBe(true)
    expect(s.phase).toBe('over')
  })
  it('パドルで追い続けると、3ステージぜんぶクリアできる', () => {
    const s = createBreakout(['kids', 'kids'], false)
    const ev = autoplay(s, 900, 8)
    expect(ev.filter((e) => e.type === 'clear').length).toBe(STAGES)
    expect(ev.find((e) => e.type === 'over')).toEqual({ type: 'over', winner: 0 })
  })
  it('球が真横に近い角度で行き来しつづけない', () => {
    const s = createBreakout(['otona', 'otona'], false)
    s.bricks = []
    s.balls = [{ x: 50, y: 80, vx: 100, vy: -1, owner: 0, stuck: false, wait: 0 }]
    s.bricks = makeBricks(['oooooooo'], 22)
    stepBreakout(s, 1 / 60)
    const b = s.balls[0]
    for (let i = 0; i < 120; i++) stepBreakout(s, 1 / 60)
    expect(Math.abs(b.vy)).toBeGreaterThan(Math.hypot(b.vx, b.vy) * 0.3)
  })
})

describe('ピクルくずし たいせん（ふたり）', () => {
  it('それぞれ自分の球を持って始まる', () => {
    const s = createBreakout(['kids', 'otona'], true)
    expect(s.balls.map((b) => b.owner).sort()).toEqual([0, 1])
    expect(s.paddles[0].w).toBe(BREAKOUT_LEVEL.kids.paddle)
    expect(s.paddles[1].w).toBe(BREAKOUT_LEVEL.otona.paddle)
  })
  it('最後に打った人の球が、くずしたブロックの点になる', () => {
    const s = createBreakout(['kids', 'kids'], true)
    s.bricks = [{ x: 40, y: 85, w: 20, h: 5, hp: 1, kind: 'ball' }]
    s.balls = [{ x: 50, y: 70, vx: 0, vy: 100, owner: 1, stuck: false, wait: 0 }]
    stepBreakout(s, 0.2)
    expect(s.score).toEqual([0, 1])
  })
  it('落とした人の手元に球が戻ってくる', () => {
    const s = createBreakout(['kids', 'kids'], true)
    s.balls = [{ x: 50, y: s.H - 1, vx: 0, vy: 100, owner: 1, stuck: false, wait: 0 }]
    movePaddle(s, 0, 5)
    stepBreakout(s, 0.2)
    expect(s.balls.some((b) => b.owner === 0 && b.stuck)).toBe(true)
  })
  it('時間切れで、点の多い方の勝ち', () => {
    const s = createBreakout(['kids', 'kids'], true)
    s.score = [3, 5]
    s.timeLeft = 0.01
    const ev = stepBreakout(s, 0.1)
    expect(ev.find((e) => e.type === 'over')).toEqual({ type: 'over', winner: 1 })
  })
  it('2人で打ち合うと、ブロックがくずれて点が入る', () => {
    const s = createBreakout(['otona', 'otona'], true)
    autoplay(s, 60, 6)
    expect(s.score[0] + s.score[1]).toBeGreaterThan(5)
  })
})

describe('パドルの形', () => {
  it('面の縦横の比率は本物どおり（幅20cm÷長さ28cm）で、どのレベルでもつぶさない', () => {
    for (const lv of LEVELS) {
      const s = createBreakout([lv, lv], true)
      for (const p of s.paddles) expect(faceH(p) / p.w).toBeCloseTo(20 / 28, 5)
    }
  })
})

describe('レベル', () => {
  it('小さい子ほどパドルが広く、球がゆっくり', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(BREAKOUT_LEVEL[LEVELS[i - 1]].paddle).toBeGreaterThan(BREAKOUT_LEVEL[LEVELS[i]].paddle)
      expect(BREAKOUT_LEVEL[LEVELS[i - 1]].speed).toBeLessThan(BREAKOUT_LEVEL[LEVELS[i]].speed)
    }
  })
  it('ブロックは場の中におさまる', () => {
    for (const k of makeBricks(['oooooooo'], 22)) {
      expect(k.x).toBeGreaterThanOrEqual(0)
      expect(k.x + k.w).toBeLessThanOrEqual(FIELD_W)
    }
  })
})
