/**
 * 早押しの勝ち負け（はやタッチ・クイズで共通）。
 * 押した時刻にレベルごとの遅れ（pressDelay）を足して比べる。
 * まだ押していない人が、今すぐ押しても追いつけなくなった時点で決める。
 */
import type { Side } from './players'

export interface Press {
  side: Side
  /** 合図（GO）からの経過 ms */
  at: number
  correct: boolean
  /** クイズで選んだ選択肢 */
  choiceId?: string
}

export interface Decision {
  done: boolean
  winner: Side | null
}

export function decide(presses: Press[], elapsed: number, delays: [number, number], timeout: number): Decision {
  const first: [Press | undefined, Press | undefined] = [presses.find((p) => p.side === 0), presses.find((p) => p.side === 1)]
  const eff = (p: Press) => p.at + delays[p.side]
  const correct = first.filter((p): p is Press => !!p && p.correct).sort((a, b) => eff(a) - eff(b) || a.at - b.at)
  const best = correct[0]
  if (best) {
    const o: Side = best.side === 0 ? 1 : 0
    // 相手がもう押した（まちがい・遅い正解）か、今押しても間に合わない
    if (first[o] || elapsed + delays[o] > eff(best)) return { done: true, winner: best.side }
    return { done: false, winner: null }
  }
  if (first[0] && first[1]) return { done: true, winner: null }
  if (elapsed >= timeout) return { done: true, winner: null }
  return { done: false, winner: null }
}
