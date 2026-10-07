/**
 * 失点の判定（純粋関数）。
 * かんたん：2回跳ねた・外に出た だけ。
 * ほんかく：それに加えて、2バウンドルール・キッチンでのボレー・サーブの入る場所。
 * 根拠は USA Pickleball 公式ルールブック 2026（知識カード PBK）。
 */
import type { Side } from '../../core/players'
import { inCourt, inKitchen, inServiceCourt, sideOf } from './court'

export type RuleMode = 'easy' | 'real'

export type FaultReason =
  | 'out' // 外に落ちた（PBK-0029）
  | 'double-bounce' // 2回跳ねた（PBK-0013）
  | 'two-bounce' // サーブ・リターンを跳ねる前に打った（PBK-0012）
  | 'kitchen-volley' // キッチンの中でボレーした（PBK-0015）
  | 'serve-kitchen' // サーブがキッチン（ライン含む）に落ちた（PBK-0010・0021）
  | 'serve-wrong-court' // サーブが対角のサービスコートに入らなかった（PBK-0010）

export interface Fault {
  loser: Side
  reason: FaultReason
}

export interface RallyState {
  /** 最後に打った人 */
  lastHitter: Side
  /** 最後の打球が何球目か（0＝サーブ、1＝リターン、2＝3球目…） */
  shot: number
  /** 最後に打ってから跳ねた回数（この跳ねを含む） */
  bounces: number
  /** サーブを打った位置の x（対角の判定に使う） */
  serverX: number
}

export const REASON_TEXT: Record<FaultReason, { kids: string; rule: string }> = {
  out: { kids: 'アウト！', rule: 'ラインにさわればイン。そとはアウト' },
  'double-bounce': { kids: '2かい はねた！', rule: '2かい はねるまえに かえそう' },
  'two-bounce': { kids: '2バウンドルール！', rule: 'サーブとリターンは 1かい はねてから うつ' },
  'kitchen-volley': { kids: 'キッチンで ボレー！', rule: 'ボレーは キッチンの そとから' },
  'serve-kitchen': { kids: 'サーブが キッチンに！', rule: 'サーブは キッチン（ラインも）を こえて' },
  'serve-wrong-court': { kids: 'サーブは ななめへ！', rule: 'サーブは ななめむこうの サービスコートへ' },
}

/** 球が跳ねたときの判定。bounces は今の跳ねを数えた後の値 */
export function judgeBounce(state: RallyState, at: { x: number; y: number }, mode: RuleMode): Fault | null {
  const where = sideOf(at.y)
  if (state.bounces >= 2) {
    // 2回目の跳ね：その陣地の人が返せなかった
    return { loser: where, reason: 'double-bounce' }
  }
  // 1回目の跳ね：打った人の球が入ったか
  if (where === state.lastHitter || !inCourt(at.x, at.y)) {
    return { loser: state.lastHitter, reason: 'out' }
  }
  if (mode === 'real' && state.shot === 0) {
    if (inKitchen(at.y)) return { loser: state.lastHitter, reason: 'serve-kitchen' }
    if (!inServiceCourt(state.lastHitter, state.serverX, at.x, at.y)) return { loser: state.lastHitter, reason: 'serve-wrong-court' }
  }
  return null
}

/**
 * 打ったときの判定（ほんかくルールだけ）。
 * state は打つ前の状態。hitterY は打った人（パドル）の位置。
 */
export function judgeHit(state: RallyState, hitter: Side, hitterY: number, mode: RuleMode): Fault | null {
  if (mode !== 'real') return null
  const volley = state.bounces === 0
  if (!volley) return null
  const nextShot = state.shot + 1
  // 2バウンドルール：リターン（1）と3球目（2）は1回跳ねてから
  if (nextShot <= 2) return { loser: hitter, reason: 'two-bounce' }
  if (inKitchen(hitterY)) return { loser: hitter, reason: 'kitchen-volley' }
  return null
}
