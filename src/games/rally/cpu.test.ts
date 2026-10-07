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

/** ホークアイ先生どうしで1試合 */
function cpuVsCpu(level: Level, mode: RuleMode, seed: number, seconds = 900) {
  const rand = rng(seed)
  const e = new RallyEngine({ kind: 'versus', mode, levels: [level, level], target: 5, games: 1, rand, cpu: 1 })
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

describe('ホークアイ先生（コンピューター）', () => {
  it('どのレベルでも、先生どうしで打ち合って1試合終わる', () => {
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
  it('ほんかくルールで、サービスをダイレクトで返さない（第32条(2)）', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { events } = cpuVsCpu('senshu', 'real', seed)
      for (const x of events) if (x.type === 'point') expect(x.fault.reason).not.toBe('direct')
    }
  })
  it('アウトになる球は見送る（おとな・せんしゅ）', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['otona', 'senshu'], target: 5 })
    e.phase = 'play'
    e.ballVisible = true
    e.ball = { x: 4, y: COURT.NET_Y + 5, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    e.state = { lastHitter: 0, shot: 3, bounces: 0, serverX: 4 }
    // ベースラインより後ろに落ちる球
    launch(e.ball, { x: 4, y: -1.5 }, 1.5, 1)
    expect(planHit(e, 1, COURT.NET_Y - 7, true)).toBeNull()
    // 入る球なら打つ
    e.ball = { x: 4, y: COURT.NET_Y + 5, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    launch(e.ball, { x: 4, y: 3.0 }, 1.5, 1)
    expect(planHit(e, 1, COURT.NET_Y - 11, true)).not.toBeNull()
  })
})

describe('ねらって ストローク（ひとりで）', () => {
  /** 下の人を、球の x に合わせて少し振るボットにする */
  function practice(level: Level, swing: number, seed = 3) {
    const rand = rng(seed)
    const e = new RallyEngine({ kind: 'target', mode: 'easy', levels: [level, level], target: 0, rand })
    const events: EngineEvent[] = []
    let push = 0
    for (let t = 0; t < 120 && e.phase !== 'over'; t += 1 / 60) {
      const coming = e.phase === 'play' && e.state.lastHitter === 1
      push = coming && e.ball.y > COURT.L - 5 ? push + swing / 60 : 0
      e.setFinger(0, true, e.ball.x, COURT.L + 1.0 - push)
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
  it('おとな・せんしゅの的は、ソフトテニスのコースの名前（正クロス・逆クロス・右ストレート・左ストレート）', () => {
    const e = new RallyEngine({ kind: 'target', mode: 'easy', levels: ['senshu', 'senshu'], target: 0, rand: rng(2) })
    const labels = new Set<string>()
    for (let t = 0; t < 120 && e.phase !== 'over'; t += 1 / 60) {
      if (e.zone) labels.add(e.zone.label.split('：')[0].split('（')[0])
      e.setFinger(0, true, e.ball.x, COURT.L + 1.0)
      e.step(1 / 60)
    }
    for (const l of labels) expect(['正クロスへ', '逆クロスへ', '右ストレートへ', '左ストレートへ']).toContain(l)
    expect(labels.size).toBeGreaterThanOrEqual(2)
  })
})
