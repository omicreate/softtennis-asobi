/**
 * おうちの人の確認（ペアレンタルゲート）。SNS への共有・おうちの方へ のページの前に出す。
 * 小さい子が読めない漢字の説明と、2けた×1けたの かけ算で、子どもだけでは進めないようにする。
 */
import { useState } from 'react'

function question() {
  const a = 11 + Math.floor(Math.random() * 9)
  const b = 3 + Math.floor(Math.random() * 7)
  const answer = a * b
  const set = new Set<number>([answer])
  for (const d of [a, -a, b, -b, 10, -10, 1, -1]) {
    if (set.size >= 4) break
    if (answer + d > 0) set.add(answer + d)
  }
  const choices = [...set].sort(() => Math.random() - 0.5)
  return { a, b, answer, choices }
}

export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const [q, setQ] = useState(question)
  const [wrong, setWrong] = useState(false)

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" data-testid="parent-gate">
      <h2 id="gate-title" className="gate-title">
        保護者の方へ
      </h2>
      <p className="gate-text">続けるには、次の計算の答えを選んでください。</p>
      <div className="gate-q" aria-live="polite">
        {q.a} × {q.b} = ？
      </div>
      <div className="gate-choices">
        {q.choices.map((c) => (
          <button
            key={c}
            className="btn"
            data-answer={c === q.answer || undefined}
            onClick={() => {
              if (c === q.answer) onPass()
              else {
                setWrong(true)
                setQ(question())
              }
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {wrong && <p className="gate-wrong">答えがちがいます。もう一度どうぞ。</p>}
      <button className="btn btn-quiet" onClick={onCancel}>
        もどる
      </button>
    </div>
  )
}
