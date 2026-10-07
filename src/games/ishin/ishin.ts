/**
 * いしんでんしん ダブルス。React に依存しない純粋な計算。
 * 同じ しつもんに、ペアの2人が こっそり答えを選ぶ。同じなら「いしんでんしん！」で1点。
 * - 2人：ペアで協力。何問そろうか（じこベスト）
 * - 4人：2ペアで対戦（オレンジ・あお ／ ピンク・みどり）。そろった数の多いペアの勝ち
 * てわたしの順は、ペアが続かないように交互（4人なら 0→2→1→3）。
 */
import { questionsFor } from './questions'
import type { IDeck, IQuestion } from './questions'

export type ISize = 2 | 4
export const I_SIZES: ISize[] = [2, 4]
export const I_COUNTS = [5, 10]

/** ペア（人の番号の組） */
export const pairsFor = (size: ISize): [number, number][] => (size === 2 ? [[0, 1]] : [[0, 1], [2, 3]])

/** てわたしの順（同じペアが続かない） */
export const passOrder = (size: ISize): number[] => (size === 2 ? [0, 1] : [0, 2, 1, 3])

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** しつもんを n こ選ぶ。同じ遊びの間は、出し切るまで同じしつもんを出さない。選択肢の並びも毎回かえる（2人とも同じ並び） */
export function pickQuestions(deck: IDeck, n: number, rand: () => number = Math.random, used: Set<string> = new Set()): IQuestion[] {
  const pool = questionsFor(deck)
  const out: IQuestion[] = []
  for (let k = 0; k < n; k++) {
    let fresh = pool.filter((x) => !used.has(x.id) && !out.some((o) => o.id === x.id))
    if (fresh.length === 0) {
      for (const x of pool) used.delete(x.id)
      fresh = pool.filter((x) => !out.some((o) => o.id === x.id))
      if (fresh.length === 0) fresh = pool
    }
    const pick = fresh[Math.floor(rand() * fresh.length)]
    used.add(pick.id)
    out.push({ ...pick, choices: shuffle(pick.choices, rand) })
  }
  return out
}

/** そのペアの2人が同じ答えか（選んでいなければ そろっていない） */
export function isMatch(picks: (number | undefined)[], pair: [number, number]): boolean {
  const [a, b] = pair
  return picks[a] !== undefined && picks[a] === picks[b]
}

/** ペアごとの そろった数。history は しつもんごとの [人] の答え */
export function pairScores(history: (number | undefined)[][], size: ISize): number[] {
  return pairsFor(size).map((pr) => history.filter((h) => isMatch(h, pr)).length)
}

/** ペアの なかよし度（そろった割合で） */
export function rating(matches: number, total: number): string {
  const r = total > 0 ? matches / total : 0
  if (r >= 1) return 'いしんでんしん！'
  if (r >= 0.6) return 'さいこうの あいぼう'
  if (r >= 0.3) return 'なかよし ペア'
  return 'これから なかよし'
}
