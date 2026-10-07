/**
 * れんだ つなひき（ふたり）。React に依存しない純粋な計算。
 * まんなかのボールを、タップの連打で相手の側へ押しこむ。相手のゴールラインまで押しこめば そのラウンドの勝ち。
 * 先に2ラウンド勝った人の勝ち。
 * 手加減：レベルで1回のタップの強さが変わる（小さい子は連打がおそいので、1回で多く進む）。
 * 指を何本使ってもよいが、1秒に数えるのは14回まで（ずるい速さにならないように）。
 */
import type { Level, Side } from '../../core/players'

/** 1回のタップの強さ（ふつう＝1） */
export const TUG_POWER: Record<Level, number> = { chibi: 1.8, kids: 1.35, otona: 1, senshu: 0.8 }
/** 強さ1のタップで進む量（まんなか0から ゴール1まで） */
export const STEP = 1 / 34
/** 1秒に数えるタップの上限 */
export const MAX_RATE = 14
export const ROUND_TIME = 15
export const WINS = 2
/** はじめの「3・2・1」 */
export const COUNTDOWN = 3
/** ラウンドの勝ち負けを見せる時間 */
export const POINT_TIME = 2.2

export type TugPhase = 'ready' | 'pull' | 'point' | 'over'

export interface TugState {
  levels: [Level, Level]
  /** ボールの位置。+1 で上の人（1）のゴール＝下の人（0）の勝ち、-1 で上の人の勝ち */
  pos: number
  wins: [number, number]
  round: number
  phase: TugPhase
  /** いまの場面になってからの時間（秒） */
  t: number
  /** 最後に数えたタップの時刻（秒） */
  lastTap: [number, number]
  /** このラウンドのタップの数 */
  taps: [number, number]
  /** いまのラウンドの勝ち（ひきわけは null） */
  roundWinner: Side | null
  /** 全体の時間（タップの間かくを測る） */
  clock: number
  /** 1秒に数えるタップの上限（チーム戦は人数ぶん） */
  maxRate: number
}

export type TugEvent =
  | { type: 'count'; n: number }
  | { type: 'go' }
  | { type: 'round'; winner: Side | null; wins: [number, number] }
  | { type: 'over'; winner: Side }

/** team：2人ずつのチーム戦（1秒に数えるタップを2人ぶんにする） */
export function createTug(levels: [Level, Level], team = false): TugState {
  return { levels, pos: 0, wins: [0, 0], round: 1, phase: 'ready', t: 0, lastTap: [-1, -1], taps: [0, 0], roundWinner: null, clock: 0, maxRate: team ? MAX_RATE * 2 : MAX_RATE }
}

/** タップ。数えたら true（はじまる前・速すぎるタップは数えない） */
export function tap(s: TugState, side: Side): boolean {
  if (s.phase !== 'pull') return false
  if (s.clock - s.lastTap[side] < 1 / s.maxRate) return false
  s.lastTap[side] = s.clock
  s.taps[side] += 1
  const d = STEP * TUG_POWER[s.levels[side]]
  s.pos = Math.max(-1, Math.min(1, s.pos + (side === 0 ? d : -d)))
  return true
}

function endRound(s: TugState, winner: Side | null, ev: TugEvent[]) {
  s.phase = 'point'
  s.t = 0
  s.roundWinner = winner
  if (winner !== null) s.wins[winner] += 1
  ev.push({ type: 'round', winner, wins: [s.wins[0], s.wins[1]] })
}

export function stepTug(s: TugState, dt: number): TugEvent[] {
  const ev: TugEvent[] = []
  s.clock += dt
  if (s.phase === 'over') return ev
  const before = s.t
  s.t += dt
  switch (s.phase) {
    case 'ready': {
      // 3・2・1 の数が変わったときに知らせる
      const n = Math.ceil(COUNTDOWN - s.t)
      if (n !== Math.ceil(COUNTDOWN - before) && n > 0) ev.push({ type: 'count', n })
      if (s.t >= COUNTDOWN) {
        s.phase = 'pull'
        s.t = 0
        ev.push({ type: 'go' })
      }
      break
    }
    case 'pull':
      if (s.pos >= 1) endRound(s, 0, ev)
      else if (s.pos <= -1) endRound(s, 1, ev)
      else if (s.t >= ROUND_TIME) endRound(s, Math.abs(s.pos) < 0.02 ? null : s.pos > 0 ? 0 : 1, ev)
      break
    case 'point':
      if (s.t >= POINT_TIME) {
        const champ = s.wins[0] >= WINS ? 0 : s.wins[1] >= WINS ? 1 : null
        if (champ !== null) {
          s.phase = 'over'
          ev.push({ type: 'over', winner: champ })
        } else {
          s.round += 1
          s.pos = 0
          s.taps = [0, 0]
          s.roundWinner = null
          s.phase = 'ready'
          s.t = 0
        }
      }
      break
  }
  return ev
}
