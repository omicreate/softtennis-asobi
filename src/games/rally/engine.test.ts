import { describe, expect, it } from 'vitest'
import { LEVEL_INFO } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { COURT, toNet } from './court'
import { FINGER_LEAD, RallyEngine } from './engine'
import { launch } from './physics'
import type { EngineEvent, Kind } from './engine'
import type { RuleMode } from './rules'

/** いつも同じ結果になる乱数（テストを安定させる） */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

interface Bot {
  /** パドルを置く深さ（ネットからの距離 m） */
  depth: [number, number]
  /** 狙いのズレ（パドル幅に対する割合）。大きいほど空振りする */
  miss: number
  /** 打つときに振る強さの最大（下の人・上の人） */
  swing: [number, number]
}

/** 2人のボットに遊ばせる。球に指を合わせ（少しズレる）、ときどき振る。サーブは上へ振る */
function play(kind: Kind, mode: RuleMode, levels: [Level, Level], seconds: number, bot: Partial<Bot> = {}, seed = 1) {
  const b: Bot = { depth: [6.5, 6.5], miss: 0.7, swing: [10, 10], ...bot }
  const rand = rng(seed)
  const e = new RallyEngine({ kind, mode, levels, target: 5 })
  const events: EngineEvent[] = []
  const dt = 1 / 60
  const err: [number, number] = [0, 0]
  const power: [number, number] = [0, 0]
  const serveY: [number | null, number | null] = [null, null]
  let lastShot = -1
  for (let t = 0; t < seconds; t += dt) {
    // 新しい球が来るたびに、ねらいのズレと振る強さを決め直す
    if (e.state.shot !== lastShot || e.phase === 'serve') {
      lastShot = e.state.shot
      for (const side of [0, 1] as Side[]) {
        err[side] = (rand() * 2 - 1) * b.miss * LEVEL_INFO[levels[side]].paddleWidth
        power[side] = rand() * b.swing[side]
      }
    }
    for (const side of [0, 1] as Side[]) {
      const s = toNet(side)
      const paddleY = COURT.NET_Y - s * b.depth[side]
      let fy = paddleY - s * FINGER_LEAD
      let fx = e.ball.x + err[side]
      if (e.phase === 'serve' && e.server === side) {
        serveY[side] = (serveY[side] ?? fy) + s * 0.15
        fy = serveY[side]!
        fx = side === 0 ? 4.5 : 1.6
      } else {
        serveY[side] = null
        // 球が近づいたら、決めた強さでネットへ向けて振る
        const coming = e.ball.vy * s < 0 && Math.abs(e.ball.y - paddleY) < 1.2
        if (coming) fy += s * power[side] * (1 / 60) * 6 * (1.2 - Math.abs(e.ball.y - paddleY))
      }
      e.setFinger(side, true, fx, fy)
    }
    events.push(...e.step(dt))
    if (e.phase === 'over') break
  }
  return { e, events }
}

const count = (events: EngineEvent[], type: EngineEvent['type']) => events.filter((x) => x.type === type).length
const reasons = (events: EngineEvent[]) => events.flatMap((x) => (x.type === 'point' ? [x.fault.reason] : []))

describe('ラリーたいけつ（かんたん）', () => {
  it('打ち合いが続き、どちらかが5点とって終わる', () => {
    const { e, events } = play('versus', 'easy', ['kids', 'otona'], 600)
    expect(count(events, 'hit')).toBeGreaterThan(10)
    expect(e.phase).toBe('over')
    expect(Math.max(...e.score)).toBe(5)
  })
  it('失点の理由は「2回はねた」「アウト」だけ', () => {
    for (const seed of [1, 2, 3]) {
      const { events } = play('versus', 'easy', ['otona', 'otona'], 300, {}, seed)
      for (const r of reasons(events)) expect(['double-bounce', 'out']).toContain(r)
    }
  })
  it('小さい子どうしは、強く振ってもアウトにならない', () => {
    for (const seed of [4, 5, 6]) {
      const { events } = play('versus', 'easy', ['chibi', 'kids'], 300, { swing: [30, 30] }, seed)
      expect(reasons(events)).not.toContain('out')
    }
  })
  it('カウントダウンは 3・2・1', () => {
    const { events } = play('versus', 'easy', ['kids', 'kids'], 4)
    expect(events.flatMap((x) => (x.type === 'countdown' ? [x.n] : []))).toEqual([3, 2, 1])
  })
  it('小さい子は、振らなくても自動でサーブが出る', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['chibi', 'chibi'], target: 5 })
    const evs: EngineEvent[] = []
    for (let t = 0; t < 8; t += 1 / 60) evs.push(...e.step(1 / 60))
    expect(count(evs, 'hit')).toBeGreaterThan(0)
  })
})

describe('ラリーたいけつ（ほんかく）', () => {
  it('ネット際に詰めてボレーすると、2バウンドルールかキッチンの反則がとられる', () => {
    const { events } = play('versus', 'real', ['senshu', 'senshu'], 120, { depth: [0.8, 0.8], miss: 0.2 })
    expect(reasons(events).some((r) => r === 'two-bounce' || r === 'kitchen-volley')).toBe(true)
  })
  it('勝つには2点差が必要（PBK-0005）', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { e } = play('versus', 'real', ['senshu', 'otona'], 900, {}, seed)
      if (e.phase === 'over') expect(Math.abs(e.score[0] - e.score[1])).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('ラリーたいけつ（ほんかく・サイドアウト方式）', () => {
  /** サーブ側（server）の打った球が、相手（receiver）の陣地で2回はねる／その逆、を起こす */
  function rallyEnd(e: RallyEngine, hitter: Side) {
    e.phase = 'play'
    e.ballVisible = true
    // 2人とも球に触れない場所（コートの外の角）に立つ
    e.setFinger(0, true, -0.9, 15)
    e.setFinger(1, true, 7, -1.6)
    const s = toNet(hitter)
    e.ball = { x: 3, y: COURT.NET_Y - s * 4, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    e.state = { lastHitter: hitter, shot: 5, bounces: 0, serverX: 3 }
    launch(e.ball, { x: 3, y: COURT.NET_Y + s * 3 }, 1.2, 1)
    for (let t = 0; t < 8; t += 1 / 60) {
      const ev = e.step(1 / 60).find((x) => x.type === 'point')
      if (ev) return ev
    }
    return null
  }
  const make = () => new RallyEngine({ kind: 'versus', mode: 'real', levels: ['senshu', 'senshu'], target: 11, scoring: 'sideout' })

  it('サーブ側がラリーに勝てば1点（PBK-0004）', () => {
    const e = make()
    e.server = 0
    const ev = rallyEnd(e, 0)
    expect(ev).toMatchObject({ winner: 0, scored: true })
    expect(e.score).toEqual([1, 0])
    expect(e.server).toBe(0)
  })
  it('レシーブ側が勝っても点は入らず、サーブ権が移る（サイドアウト）', () => {
    const e = make()
    e.server = 0
    e.score = [3, 2]
    const ev = rallyEnd(e, 1)
    expect(ev).toMatchObject({ winner: 1, scored: false })
    expect(e.score).toEqual([3, 2])
    expect(e.server).toBe(1)
    // シングルスのコールは「サーバーの点－レシーバーの点」（PBK-0007）
    expect(e.scoreCall()).toBe('2-3')
  })
  it('点を取った人がゲームを取れるのはサーブのときだけ', () => {
    const e = make()
    e.server = 1
    e.score = [10, 3]
    // 10点の下の人が、レシーブで勝っても勝ちにはならない
    rallyEnd(e, 0)
    expect(e.winner).toBeNull()
    expect(e.score).toEqual([10, 3])
    // サーブで勝てば11点で勝ち
    e.phase = 'serve'
    rallyEnd(e, 0)
    expect(e.score).toEqual([11, 3])
    expect(e.winner).toBe(0)
  })
  it('ラリー・スコアリングを選べば、どちらが勝っても点が入る', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'real', levels: ['senshu', 'senshu'], target: 11, scoring: 'rally' })
    e.server = 0
    expect(rallyEnd(e, 1)).toMatchObject({ winner: 1, scored: true })
    expect(e.score).toEqual([0, 1])
  })
  it('かんたんルールでは、サイドアウトを選んでいても毎ラリー点が入る', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['kids', 'kids'], target: 5, scoring: 'sideout' })
    e.server = 0
    expect(rallyEnd(e, 1)).toMatchObject({ winner: 1, scored: true })
  })
})

describe('ディンクでつなごう', () => {
  it('2人ともキッチンラインで止めて当てると、ディンクが続く', () => {
    const k = COURT.KITCHEN + 0.3
    const { events } = play('dink', 'easy', ['kids', 'kids'], 60, { depth: [k, k], miss: 0.1, swing: [0, 0] })
    const best = Math.max(0, ...events.flatMap((x) => (x.type === 'dink' ? [x.count] : [])))
    expect(best).toBeGreaterThanOrEqual(5)
  })
  it('キッチンの外に落ちたら「つよすぎ」で0に戻り、キッチンに落ちたら1回', () => {
    const e = new RallyEngine({ kind: 'dink', mode: 'easy', levels: ['otona', 'otona'], target: 0 })
    e.dinkCount = 3
    e.phase = 'play'
    e.ballVisible = true
    // 上の人はベースラインの後ろにいて、球には触れない
    e.setFinger(1, true, 3, -1.5)
    const shoot = (depth: number) => {
      e.ball = { x: 3, y: COURT.NET_Y + 2.4, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
      e.state = { lastHitter: 0, shot: 3, bounces: 0, serverX: 3 }
      launch(e.ball, { x: 3, y: COURT.NET_Y - depth }, 1.4, 1)
      for (let t = 0; t < 5; t += 1 / 60) {
        const ev = e.step(1 / 60).find((x) => x.type === 'dink')
        if (ev) return ev
      }
      return null
    }
    expect(shoot(3.5)).toEqual({ type: 'dink', ok: false, count: 0 })
    expect(shoot(1.2)).toEqual({ type: 'dink', ok: true, count: 1 })
  })
  it('ディンクではアウトにならない（落とさない限り続く協力ゲーム）', () => {
    for (const seed of [1, 2, 3]) {
      const { events } = play('dink', 'easy', ['otona', 'senshu'], 120, { swing: [40, 40] }, seed)
      for (const x of events) if (x.type === 'dink-end') expect(x.fault.reason).not.toBe('out')
    }
  })
  it('落としたら終わり（dink-end）', () => {
    const { e, events } = play('dink', 'easy', ['otona', 'otona'], 120, { miss: 1.2 })
    expect(count(events, 'dink-end')).toBe(1)
    expect(e.phase).toBe('over')
  })
})
