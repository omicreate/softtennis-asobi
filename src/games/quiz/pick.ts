/** クイズの出題（純粋関数）。同じカテゴリの2人には同じ問題、ちがえばそれぞれの問題を出す */
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { poolFor } from './questions'
import type { QChoice, Question } from './questions'

export interface Asked {
  q: Question
  /** 並べかえた選択肢 */
  choices: QChoice[]
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** まだ出していない問題から1つ。出し切ったら使った記録を消して最初から */
function pickOne(pool: Question[], used: Set<string>, rand: () => number): Question {
  let fresh = pool.filter((q) => !used.has(q.id))
  if (fresh.length === 0) {
    for (const q of pool) used.delete(q.id)
    fresh = pool
  }
  const q = fresh[Math.floor(rand() * fresh.length)]
  used.add(q.id)
  return q
}

const ask = (q: Question, rand: () => number): Asked => ({ q, choices: shuffle(q.choices, rand) })

export function pickRound(levels: [Level, Level], used: Set<string>, rand: () => number = Math.random): [Asked, Asked] {
  const [a, b] = levels.map((l) => LEVEL_INFO[l])
  if (a.quiz === b.quiz) {
    // 同じカテゴリ：やさしい方に合わせて同じ問題（選択肢の並びは別々）
    const q = pickOne(poolFor(a.quiz, Math.min(a.quizMax, b.quizMax)), used, rand)
    return [ask(q, rand), ask(q, rand)]
  }
  return [ask(pickOne(poolFor(a.quiz, a.quizMax), used, rand), rand), ask(pickOne(poolFor(b.quiz, b.quizMax), used, rand), rand)]
}
