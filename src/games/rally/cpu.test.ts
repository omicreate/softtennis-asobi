import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../core/players'
import type { Level } from '../../core/players'
import { COURT } from './court'
import { Cpu, CPU_SKILL, planHit } from './cpu'
import { RallyEngine } from './engine'
import type { EngineEvent } from './engine'
import { launch } from './physics'
import type { RuleMode } from './rules'
import { SHOTS } from './targets'

/** いつも同じ結果になる乱数（mulberry32。続けて引いても偏りにくい） */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** ピクルくん同士で1ゲーム */
function cpuVsCpu(level: Level, mode: RuleMode, seed: number, seconds = 900) {
  const rand = rng(seed)
  const e = new RallyEngine({ kind: 'versus', mode, levels: [level, level], target: 5, scoring: 'sideout', rand, cpu: 1 })
  const a = new Cpu(0, CPU_SKILL[level], rand)
  const b = new Cpu(1, CPU_SKILL[level], rand)
  const events: EngineEvent[] = []
  for (let t = 0; t < seconds && e.phase !== 'over'; t += 1 / 60) {
    a.update(e, 1 / 60)
    b.update(e, 1 / 60)
    events.push(...e.step(1 / 60))
  }
  return { e, events }
}

describe('ピクルくん（コンピューター）', () => {
  it('どのレベルでも、ピクルくん同士で打ち合って1ゲーム終わる', () => {
    for (const lv of LEVELS) {
      const { e, events } = cpuVsCpu(lv, 'easy', 7)
      expect(e.phase, lv).toBe('over')
      // 返球もある（サーブだけで終わっていない）
      expect(events.filter((x) => x.type === 'hit').length, lv).toBeGreaterThan(events.filter((x) => x.type === 'point').length + 3)
    }
  })
  it('強いレベルほどラリーが続く', () => {
    const avg = (lv: Level) => {
      let hits = 0
      let points = 0
      for (const seed of [1, 2, 3]) {
        const { events } = cpuVsCpu(lv, 'easy', seed)
        hits += events.filter((x) => x.type === 'hit').length
        points += events.filter((x) => x.type === 'point').length
      }
      return hits / points
    }
    expect(avg('senshu')).toBeGreaterThan(avg('chibi'))
  })
  it('ほんかくルールで、2バウンドルール違反やキッチンでのボレーをしない', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { events } = cpuVsCpu('senshu', 'real', seed)
      for (const x of events) if (x.type === 'point') expect(['two-bounce', 'kitchen-volley']).not.toContain(x.fault.reason)
    }
  })
  it('アウトになる球は見送る（おとな・せんしゅ）', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['otona', 'senshu'], target: 5 })
    e.phase = 'play'
    e.ballVisible = true
    e.ball = { x: 3, y: COURT.NET_Y + 3, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    e.state = { lastHitter: 0, shot: 3, bounces: 0, serverX: 3 }
    // ベースラインより後ろに落ちる球
    launch(e.ball, { x: 3, y: -1.0 }, 1.2, 1)
    expect(planHit(e, 1, COURT.NET_Y - 4, true)).toBeNull()
    // 入る球なら打つ
    e.ball = { x: 3, y: COURT.NET_Y + 3, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    launch(e.ball, { x: 3, y: 2.0 }, 1.2, 1)
    expect(planHit(e, 1, COURT.NET_Y - 6.3, true)).not.toBeNull()
  })
})

describe('ねらってショット（ひとりで）', () => {
  /** 下の人を、球の x に合わせて少し振るボットにする */
  function practice(level: Level, swing: number, seed = 3) {
    const rand = rng(seed)
    const e = new RallyEngine({ kind: 'target', mode: 'easy', levels: [level, level], target: 0, rand })
    const events: EngineEvent[] = []
    let push = 0
    for (let t = 0; t < 120 && e.phase !== 'over'; t += 1 / 60) {
      const coming = e.phase === 'play' && e.state.lastHitter === 1
      push = coming && e.ball.y > COURT.L - 3.5 ? push + swing / 60 : 0
      e.setFinger(0, true, e.ball.x, COURT.L + 0.6 - push)
      events.push(...e.step(1 / 60))
    }
    return { e, events }
  }
  it(`${SHOTS}球打ったら終わり、1球ごとに結果が出る`, () => {
    const { e, events } = practice('kids', 4)
    expect(e.phase).toBe('over')
    expect(events.filter((x) => x.type === 'feed').length).toBe(SHOTS)
    expect(events.filter((x) => x.type === 'shot').length).toBe(SHOTS)
    expect(e.hits).toBe(events.filter((x) => x.type === 'shot' && x.ok).length)
  })
  it('ちびっこは、返せばほとんど入る（むこうのコート全部が的）', () => {
    const { e } = practice('chibi', 2)
    expect(e.hits).toBeGreaterThanOrEqual(7)
  })
  it('せんしゅの3球目ドロップは、跳ねる前に打つと2バウンドルール違反', () => {
    const e = new RallyEngine({ kind: 'target', mode: 'easy', levels: ['senshu', 'senshu'], target: 0, rand: rng(1) })
    const events: EngineEvent[] = []
    // ネット際に詰めて、跳ねる前に打つ
    for (let t = 0; t < 8 && !events.some((x) => x.type === 'shot'); t += 1 / 60) {
      e.setFinger(0, true, e.ball.x, COURT.NET_Y + 1.6)
      events.push(...e.step(1 / 60))
    }
    expect(e.zone?.thirdShot).toBe(true)
    expect(events.find((x) => x.type === 'shot')).toMatchObject({ ok: false, reason: 'two-bounce' })
  })
})
