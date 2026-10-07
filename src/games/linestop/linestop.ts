/**
 * ラインぎわ ストップ（ふたり）。React に依存しない純粋な計算。
 * ネットの方から、自分のベースラインに向かってボールが転がってくる。タップでその場に止める。
 * ラインに近いほど勝ち。ラインをこえたらアウト。タップしなければ、ボールが自然に止まった所。
 *
 * 判定は本物のルールにそろえる：ラインに触れた球はイン（PBK-0029）。ラインの幅は5.08cm（3.A.4.e）。
 * 「触れた」は、ボールが地面に触れている点（ボールの真下＝中心）で見る。上から見てボールがラインに
 * 重なって見えても、真下がラインの外ならアウト（ラインぎわの見まちがいを覚える）。
 * 2人には同じ転がり方のボールが来る。レベルで、ボールの動く速さ（時間の進み）だけが変わる。
 */
import type { Level, Side } from '../../core/players'

/** 見えている長さ（cm）：ネット側の はじめの位置から、ベースラインの少し先まで */
export const LANE = 420
/** ラインの内側のふち（cm）と幅 */
export const LINE = 360
export const LINE_W = 5.08
export const BALL_R = 3.7
/** 地面に触れている部分の大きさ（半径 cm）。この分だけ、ラインに触れたとみなす */
export const CONTACT = 0.8
export const ROUNDS_TO_WIN = 3

/** レベルごとの時間の進み（小さい子はボールがゆっくり） */
export const TIME_SCALE: Record<Level, number> = { chibi: 0.55, kids: 0.72, otona: 1, senshu: 1.15 }

export interface Roll {
  /** はじめの速さ（cm/秒）と、減っていく速さ（cm/秒²） */
  v0: number
  decel: number
}

export interface Lane {
  /** ボールの中心の位置（cm） */
  pos: number
  /** その人の時計（秒） */
  t: number
  /** 止めた（タップ）か、自然に止まった */
  stopped: boolean
  byTap: boolean
}

export type Call = { kind: 'in'; gap: number } | { kind: 'line' } | { kind: 'out'; over: number }

export type LsPhase = 'ready' | 'roll' | 'result' | 'over'

export interface LsState {
  levels: [Level, Level]
  phase: LsPhase
  /** いまの場面になってからの時間（秒） */
  wait: number
  round: number
  wins: [number, number]
  roll: Roll
  lanes: [Lane, Lane]
  calls: [Call | null, Call | null]
  roundWinner: Side | null
}

export type LsEvent = { type: 'go' } | { type: 'stop'; side: Side; call: Call } | { type: 'round'; winner: Side | null; calls: [Call, Call]; wins: [number, number] } | { type: 'over'; winner: Side }

/** 自然に止まる位置 */
export const restPos = (r: Roll) => (r.v0 * r.v0) / (2 * r.decel)

/** その時刻の位置（止まるまで） */
export function posAt(r: Roll, t: number): number {
  const tStop = r.v0 / r.decel
  const u = Math.min(t, tStop)
  return r.v0 * u - 0.5 * r.decel * u * u
}

/**
 * ころがり方を決める。たいていはラインをこえてしまう強さ（止めないとアウト）。
 * ときどき、ラインの手前やライン上で自然に止まる球もある（待つ勇気が勝つ）。
 */
export function makeRoll(rand: () => number): Roll {
  const r = rand()
  let rest: number
  if (r < 0.2) rest = LINE - 30 + rand() * 34 // 手前〜ライン上で止まる
  else rest = LINE + LINE_W + 8 + rand() * 120 // アウトまで行く
  // 転がる時間は 1.6〜3.0 秒（速い球・遅い球）
  const T = 1.6 + rand() * 1.4
  const v0 = (2 * rest) / T
  return { v0, decel: v0 / T }
}

/** ボールの中心の位置から、判定 */
export function judge(pos: number): Call {
  const outer = LINE + LINE_W
  if (pos > outer + CONTACT) return { kind: 'out', over: pos - outer - CONTACT }
  if (pos >= LINE - CONTACT) return { kind: 'line' }
  return { kind: 'in', gap: LINE - CONTACT - pos }
}

/** 判定の良さ（小さいほど良い）。アウトは いちばん悪い */
export function badness(c: Call): number {
  if (c.kind === 'line') return 0
  if (c.kind === 'in') return c.gap
  return 1e6 + c.over
}

const lane = (): Lane => ({ pos: 0, t: 0, stopped: false, byTap: false })

export function createLs(levels: [Level, Level], rand: () => number = Math.random): LsState {
  return { levels, phase: 'ready', wait: 1.8, round: 1, wins: [0, 0], roll: makeRoll(rand), lanes: [lane(), lane()], calls: [null, null], roundWinner: null }
}

/** タップ：自分のボールをその場に止める */
export function stopBall(s: LsState, side: Side, ev: LsEvent[] = []): boolean {
  const l = s.lanes[side]
  if (s.phase !== 'roll' || l.stopped) return false
  l.stopped = true
  l.byTap = true
  const call = judge(l.pos)
  s.calls[side] = call
  ev.push({ type: 'stop', side, call })
  return true
}

export function stepLs(s: LsState, dt: number, rand: () => number = Math.random): LsEvent[] {
  const ev: LsEvent[] = []
  if (s.phase === 'over') return ev
  s.wait -= dt
  if (s.phase === 'ready') {
    if (s.wait <= 0) {
      s.phase = 'roll'
      ev.push({ type: 'go' })
    }
    return ev
  }
  if (s.phase === 'roll') {
    const tStop = s.roll.v0 / s.roll.decel
    for (const side of [0, 1] as Side[]) {
      const l = s.lanes[side]
      if (l.stopped) continue
      l.t += dt * TIME_SCALE[s.levels[side]]
      l.pos = posAt(s.roll, l.t)
      if (l.t >= tStop) {
        l.stopped = true
        const call = judge(l.pos)
        s.calls[side] = call
        ev.push({ type: 'stop', side, call })
      }
    }
    if (s.lanes[0].stopped && s.lanes[1].stopped) {
      const c: [Call, Call] = [s.calls[0]!, s.calls[1]!]
      const b0 = badness(c[0])
      const b1 = badness(c[1])
      let winner: Side | null = null
      // 2人ともアウトなら ひきわけ。差が 0.5cm より小さいときも ひきわけ
      if (!(c[0].kind === 'out' && c[1].kind === 'out') && Math.abs(b0 - b1) >= 0.5) winner = b0 < b1 ? 0 : 1
      if (winner !== null) s.wins[winner] += 1
      s.roundWinner = winner
      s.phase = 'result'
      s.wait = 2.6
      ev.push({ type: 'round', winner, calls: c, wins: [s.wins[0], s.wins[1]] })
    }
    return ev
  }
  // result
  if (s.wait <= 0) {
    // ひきわけのラウンドは数えないので、どちらかが3本とるまで続ける
    const champ = s.wins[0] >= ROUNDS_TO_WIN ? 0 : s.wins[1] >= ROUNDS_TO_WIN ? 1 : null
    if (champ !== null) {
      s.phase = 'over'
      ev.push({ type: 'over', winner: champ })
      return ev
    }
    s.round += 1
    s.roll = makeRoll(rand)
    s.lanes = [lane(), lane()]
    s.calls = [null, null]
    s.roundWinner = null
    s.phase = 'ready'
    s.wait = 1.4
  }
  return ev
}

/** 判定を こども向けの文にする */
export function callText(c: Call): string {
  if (c.kind === 'line') return 'ライン！ イン'
  if (c.kind === 'in') return `あと ${c.gap < 1 ? c.gap.toFixed(1) : Math.round(c.gap)}cm`
  return `アウト（${c.over < 1 ? c.over.toFixed(1) : Math.round(c.over)}cm）`
}
