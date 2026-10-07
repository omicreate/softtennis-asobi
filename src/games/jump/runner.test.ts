import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../core/players'
import { BODY, createRunner, GRAVITY, hits, jump, JUMP_V, makeObstacle, MAX_JUMPS, RUNNER_LEVEL, stepRunner } from './runner'
import type { REvent } from './runner'

const rnd = () => 0.5

describe('ジャンプ', () => {
  it('空中で3段まで跳べる。4回目は跳べない', () => {
    const s = createRunner('kids')
    expect(jump(s)).toBe(true)
    stepRunner(s, 0.1, rnd)
    expect(jump(s)).toBe(true)
    stepRunner(s, 0.1, rnd)
    expect(jump(s)).toBe(true)
    stepRunner(s, 0.1, rnd)
    expect(s.jumps).toBe(MAX_JUMPS)
    expect(jump(s)).toBe(false)
  })
  it('地面に着くと、また3段跳べる', () => {
    const s = createRunner('kids')
    jump(s)
    jump(s)
    const ev: REvent[] = []
    for (let i = 0; i < 300 && s.y >= 0 && !ev.some((e) => e.type === 'land'); i++) ev.push(...stepRunner(s, 1 / 60, rnd))
    expect(ev.some((e) => e.type === 'land')).toBe(true)
    expect(s.jumps).toBe(0)
    expect(jump(s)).toBe(true)
  })
  it('1段ではふつうのネットをこえられ、高いネットは2段以上いる', () => {
    const one = (JUMP_V[0] * JUMP_V[0]) / (2 * GRAVITY)
    expect(one).toBeGreaterThan(makeObstacle('net', 5, rnd).h)
    expect(one).toBeLessThan(makeObstacle('net-tall', 5, rnd).h)
    const two = one + (JUMP_V[1] * JUMP_V[1]) / (2 * GRAVITY)
    expect(two).toBeGreaterThan(makeObstacle('net-tall', 5, rnd).h)
  })
})

describe('当たり判定', () => {
  it('地面を転がる球は、走ったままだと当たり、跳べば当たらない', () => {
    const s = createRunner('kids')
    const o = { ...makeObstacle('roll', 5, rnd), x: 0 }
    expect(hits(s, o)).toBe(true)
    s.y = 1.0
    expect(hits(s, o)).toBe(false)
  })
  it('高く飛んでくる球は、走ったままならくぐれて、跳ぶと当たる', () => {
    const s = createRunner('otona')
    const o = { ...makeObstacle('fly-high', 5, rnd), x: 0 }
    expect(hits(s, o)).toBe(false)
    s.y = 0.8
    expect(hits(s, o)).toBe(true)
  })
  it('ぶつかるとライフがへり、しばらくは当たらない。0になったら終わり', () => {
    const s = createRunner('senshu')
    const lives = s.lives
    s.obstacles.push({ ...makeObstacle('roll', 5, rnd), x: 0.05 })
    const ev = stepRunner(s, 1 / 60, rnd)
    expect(ev.find((e) => e.type === 'hit')).toEqual({ type: 'hit', livesLeft: lives - 1 })
    expect(s.safe).toBeGreaterThan(0)
    // 当たらない時間のあいだは、もう1つ来てもへらない
    s.obstacles.push({ ...makeObstacle('roll', 5, rnd), x: 0.05 })
    stepRunner(s, 1 / 60, rnd)
    expect(s.lives).toBe(lives - 1)
    s.safe = 0
    s.obstacles = [{ ...makeObstacle('roll', 5, rnd), x: 0.05 }]
    const ev2 = stepRunner(s, 1 / 60, rnd)
    expect(s.phase).toBe('over')
    expect(ev2.some((e) => e.type === 'over')).toBe(true)
  })
  it('通りすぎた障害は「よけた」に数える', () => {
    const s = createRunner('kids')
    s.y = 2
    s.vy = 5
    s.obstacles.push({ ...makeObstacle('roll', 5, rnd), x: -BODY.w + 0.01 })
    const ev = stepRunner(s, 1 / 60, rnd)
    expect(ev.some((e) => e.type === 'dodge')).toBe(true)
    expect(s.dodged).toBe(1)
  })
})

describe('レベル', () => {
  it('小さい子ほど、ゆっくりで、ライフが多い', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = RUNNER_LEVEL[LEVELS[i - 1]]
      const b = RUNNER_LEVEL[LEVELS[i]]
      expect(a.speed).toBeLessThan(b.speed)
      expect(a.lives).toBeGreaterThanOrEqual(b.lives)
    }
  })
  it('そのレベルに出ない障害は出てこない（ちびっこに高いネットは出ない）', () => {
    const s = createRunner('chibi')
    s.lives = 999
    for (let t = 0; t < 120; t += 1 / 30) stepRunner(s, 1 / 30)
    expect(s.dodged + (999 - s.lives)).toBeGreaterThan(20)
    for (const o of s.obstacles) expect(RUNNER_LEVEL.chibi.kinds).toContain(o.kind)
  })
  it('ジャンプしつづけるボットなら、ちびっこはしばらく走れる', () => {
    const s = createRunner('chibi')
    for (let t = 0; t < 30 && s.phase === 'play'; t += 1 / 60) {
      // 球が近づいたら跳ぶ
      if (s.y === 0 && s.obstacles.some((o) => o.x > 0.3 && o.x < 1.4 && o.y < 1.0)) jump(s)
      stepRunner(s, 1 / 60, rnd)
    }
    expect(s.dist).toBeGreaterThan(80)
  })
})
