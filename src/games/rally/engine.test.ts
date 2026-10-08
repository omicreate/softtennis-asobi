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
  /** ラケットを置く深さ（ネットからの距離 m） */
  depth: [number, number]
  /** 狙いのズレ（ラケット幅に対する割合）。大きいほど空振りする */
  miss: number
  /** 打つときに振る強さの最大（下の人・上の人） */
  swing: [number, number]
}

/** 2人のボットに遊ばせる。球に指を合わせ（少しズレる）、ときどき振る。サーブは上へ振る */
function play(kind: Kind, mode: RuleMode, levels: [Level, Level], seconds: number, bot: Partial<Bot> = {}, seed = 1) {
  const b: Bot = { depth: [10.8, 10.8], miss: 0.7, swing: [10, 10], ...bot }
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
        fx = side === 0 ? 6 : 2.2
      } else {
        serveY[side] = null
        // 球が近づいたら、決めた強さでネットへ向けて振る
        const coming = e.ball.vy * s < 0 && Math.abs(e.ball.y - paddleY) < 1.6
        if (coming) fy += s * power[side] * (1 / 60) * 6 * (1.6 - Math.abs(e.ball.y - paddleY))
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
  it('失ポイントの理由は「ツーバウンズ」「アウト」だけ', () => {
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
  it('小さい子は、振らなくても自動でサービスが出る', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['chibi', 'chibi'], target: 5 })
    const evs: EngineEvent[] = []
    for (let t = 0; t < 8; t += 1 / 60) evs.push(...e.step(1 / 60))
    expect(count(evs, 'hit')).toBeGreaterThan(0)
  })
})

describe('ラリーたいけつ（ほんかく：ソフトテニスの数え方）', () => {
  /** hitter の打った球が、相手の陣地で2回はねる（相手の失ポイント）。2人とも球に触れない場所に立つ */
  function rallyEnd(e: RallyEngine, hitter: Side) {
    e.phase = 'play'
    e.ballVisible = true
    e.setFinger(0, true, -1.3, 26)
    e.setFinger(1, true, 9.5, -2.8)
    const s = toNet(hitter)
    e.ball = { x: 4, y: COURT.NET_Y - s * 7, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    e.state = { lastHitter: hitter, shot: 5, bounces: 0, serverX: 4 }
    launch(e.ball, { x: 4, y: COURT.NET_Y + s * 5 }, 1.4, 1)
    for (let t = 0; t < 10; t += 1 / 60) {
      const ev = e.step(1 / 60).find((x) => x.type === 'point')
      if (ev) return ev
    }
    return null
  }
  /** サービスを、lands の場所へ落とす（入らなければフォールト） */
  function serveTo(e: RallyEngine, lands: { x: number; y: number }) {
    e.phase = 'play'
    e.ballVisible = true
    e.setFinger(0, true, -1.3, 26)
    e.setFinger(1, true, 9.5, -2.8)
    const server = e.server
    e.ball = { x: 6, y: server === 0 ? COURT.L + 0.4 : -0.4, z: 0.8, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    e.state = { lastHitter: server, shot: 0, bounces: 0, serverX: 6 }
    launch(e.ball, lands, 1.4, 1)
    for (let t = 0; t < 10; t += 1 / 60) {
      const ev = e.step(1 / 60).find((x) => x.type === 'point' || x.type === 'fault')
      if (ev) return ev
    }
    return null
  }
  const make = (games: 1 | 3 = 1) => new RallyEngine({ kind: 'versus', mode: 'real', levels: ['senshu', 'senshu'], target: 5, games })

  it('ゲームは4ポイントの先取で勝ち（第20条）', () => {
    const e = make()
    e.score = [3, 1]
    expect(rallyEnd(e, 0)).toMatchObject({ winner: 0, game: true })
    expect(e.winner).toBe(0)
  })
  it('3-3はデュース。そこから2ポイント差で勝ち（第20条(1)(2)）', () => {
    const e = make()
    e.score = [3, 3]
    expect(rallyEnd(e, 0)).toMatchObject({ game: false })
    expect(rallyEnd(e, 1)).toMatchObject({ game: false })
    expect(e.score).toEqual([4, 4])
    rallyEnd(e, 1)
    expect(rallyEnd(e, 1)).toMatchObject({ winner: 1, game: true })
  })
  it('3ゲームマッチ：1ゲームずつ取ったらファイナルゲーム（7ポイント先取。第20条2）', () => {
    const e = make(3)
    e.gamesWon = [1, 1]
    expect(e.isFinal()).toBe(true)
    e.score = [3, 0]
    expect(rallyEnd(e, 0)).toMatchObject({ game: false })
    e.score = [6, 2]
    expect(rallyEnd(e, 0)).toMatchObject({ game: true })
    expect(e.winner).toBe(0)
  })
  it('ゲームを取ると、次のゲームは相手がサービス（シングルス 第4条）', () => {
    const e = make(3)
    expect(e.server).toBe(0)
    e.score = [3, 0]
    rallyEnd(e, 0)
    expect(e.gamesWon).toEqual([1, 0])
    expect(e.score).toEqual([0, 0])
    expect(e.server).toBe(1)
  })
  it('ファーストサービスのフォールトは点が動かず、セカンドサービス。2本ともフォールトで1ポイント（第27条2・第29条）', () => {
    const e = make()
    const out = { x: 6, y: COURT.NET_Y - 3 }
    expect(serveTo(e, out)).toMatchObject({ type: 'fault', server: 0 })
    expect(e.score).toEqual([0, 0])
    expect(e.serveNo).toBe(2)
    const ev = serveTo(e, out)
    expect(ev).toMatchObject({ type: 'point', winner: 1 })
    expect(ev && ev.type === 'point' ? ev.fault.reason : '').toBe('double-fault')
    expect(e.score).toEqual([0, 1])
    expect(e.serveNo).toBe(1)
  })
  it('サービスが対角のサービスコートに入れば続く', () => {
    const e = make()
    expect(serveTo(e, { x: 2, y: COURT.NET_Y - 3 })).toMatchObject({ type: 'point', winner: 0 })
  })
})

describe('ラリーたいけつ（かんたん）の数え方', () => {
  it('サービスは2ポイントずつ交代', () => {
    const e = new RallyEngine({ kind: 'versus', mode: 'easy', levels: ['kids', 'kids'], target: 5 })
    const servers: number[] = []
    for (let i = 0; i < 6; i++) {
      servers.push(e.server)
      e.score[i % 2] += 0
      e.score[0] += 1
      ;(e as unknown as { server: number }).server = Math.floor((e.score[0] + e.score[1]) / 2) % 2
    }
    expect(servers).toEqual([0, 0, 1, 1, 0, 0])
  })
})
