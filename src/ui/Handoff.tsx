/**
 * 手わたしの間の幕：画面いっぱいに次の人の色を出す。前の人の画面（お題・選んだ所）は、この幕で隠れる。
 * じゅんばんモード・にせピクルくん・ジェスチャー・よみあい サーブ（てわたし）で使う。
 */
import '../shell/party/party.css'

export function Handoff({
  name,
  color,
  sub,
  note,
  go = 'じゅんびが できたら タッチ！',
  onGo,
  testId = 'handoff-go',
}: {
  name: string
  color: string
  sub?: string
  /** 小さな注意書き（ほかの人は見ないでね など） */
  note?: string
  go?: string
  onGo: () => void
  testId?: string
}) {
  return (
    <button className="party-handoff" style={{ background: color }} onClick={onGo} data-testid={testId}>
      <span className="party-handoff-name">{name}の ばん！</span>
      {sub && <span className="party-handoff-sub">{sub}</span>}
      {note && <span className="party-handoff-note">{note}</span>}
      <span className="party-handoff-go">{go}</span>
    </button>
  )
}
