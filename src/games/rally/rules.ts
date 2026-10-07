/**
 * 失ポイントの判定（純粋関数）。根拠はソフトテニスハンドブック 2026 競技規則。
 * かんたん：ツーバウンズ・アウト だけ。
 * ほんかく：それに加えて、サービスのフォールト（2本まで）と、サービスをノーバウンドで返したダイレクト。
 * ボレーはどこで打ってもよい（ソフトテニスにはボレーを禁じる場所はない）。
 */
import type { Side } from '../../core/players'
import { inCourt, inServiceCourt, sideOf } from './court'

export type RuleMode = 'easy' | 'real'

export type FaultReason =
  | 'out' // 打球が相手コートの外に落ちた（アウト。第37条(2)。ラインに触れたらイン 第36条2）
  | 'double-bounce' // ツーバウンドする前に返せなかった（ツーバウンズ。第37条(3)）
  | 'direct' // サービスをノーバウンドで返した（ダイレクト。第32条(2)・第30条）
  | 'fault' // サービスが正しいサービスコートに入らなかった（フォールト。第27条(1)）。1本目なら点は動かない
  | 'double-fault' // 2本ともフォールト（ダブルフォールト。第29条）

export interface Fault {
  loser: Side
  reason: FaultReason
}

export interface RallyState {
  /** 最後に打った人 */
  lastHitter: Side
  /** 最後の打球が何球目か（0＝サービス、1＝レシーブ、2＝3球目…） */
  shot: number
  /** 最後に打ってから跳ねた回数（この跳ねを含む） */
  bounces: number
  /** サービスを打った位置の x（対角の判定に使う） */
  serverX: number
}

export const REASON_TEXT: Record<FaultReason, { kids: string; rule: string }> = {
  out: { kids: 'アウト！', rule: 'ラインに ふれたら イン。そとに おちたら アウト' },
  'double-bounce': { kids: 'ツーバウンズ！', rule: '2かい はねる まえに かえそう' },
  direct: { kids: 'ダイレクト！', rule: 'サービスは 1かい はねてから レシーブ' },
  fault: { kids: 'フォールト！', rule: 'サービスは ななめ むこうの サービスコートへ。もう 1きゅう うてるよ' },
  'double-fault': { kids: 'ダブルフォールト！', rule: 'サービスは 2きゅうまで。2きゅうとも はいらないと 1てん' },
}

/** 球が跳ねたときの判定。bounces は今の跳ねを数えた後の値。サービスのフォールトは 'fault'（2本目かは進行側が決める） */
export function judgeBounce(state: RallyState, at: { x: number; y: number }, mode: RuleMode): Fault | null {
  const where = sideOf(at.y)
  if (state.bounces >= 2) {
    // 2回目の跳ね：その陣地の人が返せなかった
    return { loser: where, reason: 'double-bounce' }
  }
  if (mode === 'real' && state.shot === 0) {
    // サービスは対角線上のサービスコートへ（コートの外も、サービスコートの外もフォールト）
    if (!inServiceCourt(state.lastHitter, state.serverX, at.x, at.y)) return { loser: state.lastHitter, reason: 'fault' }
    return null
  }
  // 1回目の跳ね：打った人の球が相手のコートに入ったか
  if (where === state.lastHitter || !inCourt(at.x, at.y)) {
    return { loser: state.lastHitter, reason: 'out' }
  }
  return null
}

/**
 * 打ったときの判定（ほんかくルールだけ）。state は打つ前の状態。
 * サービスは1回跳ねてからレシーブする。跳ねる前に打つとダイレクト（第30条・第32条(2)）。
 */
export function judgeHit(state: RallyState, hitter: Side, mode: RuleMode): Fault | null {
  if (mode !== 'real') return null
  if (state.shot === 0 && state.bounces === 0 && hitter !== state.lastHitter) return { loser: hitter, reason: 'direct' }
  return null
}
