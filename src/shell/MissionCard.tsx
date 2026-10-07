/** ホームの「きょうの ミッション」とスタンプ（遊んだ日）。読めない子のために読み上げボタンをつける */
import { ITEMS } from '../core/items'
import { BONUS_STARS, dayKey } from '../core/missions'
import { todayMissions, useProgress } from '../core/progress'
import { unlockAudio } from '../core/sound'
import { speak } from '../core/speak'
import { PHRASES } from '../core/voiceLines'

const WEEK = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど']

export function MissionCard() {
  const p = useProgress()
  const { defs, state } = todayMissions(p)
  const today = new Date()
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay() + i)
    return { label: WEEK[i], key: dayKey(d), today: i === today.getDay() }
  })
  // 次の とくべつな ごほうび（スタンプ）
  const next = [
    { n: 7, item: ITEMS.find((i) => i.special === 'stamps7') },
    { n: 14, item: ITEMS.find((i) => i.special === 'stamps14') },
  ].find((x) => p.days.length < x.n)

  return (
    <section className="mission-card" aria-labelledby="mission-title" data-testid="missions">
      <div className="mission-head">
        <h2 id="mission-title">きょうの ミッション</h2>
        <button
          className="btn btn-small mission-speak"
          aria-label="ミッションを よみあげる"
          onClick={() => {
            unlockAudio()
            speak([PHRASES.missions, ...defs.map((d) => d.text)])
          }}
        >
          🗣️
        </button>
        <a className="star-pill" href="#/collection" aria-label={`ほし ${p.stars}こ（きせかえへ）`} data-testid="home-stars">
          ⭐ {p.stars}
        </a>
      </div>
      <ul className="mission-list">
        {defs.map((d, i) => {
          const done = state.done[i]
          const v = Math.min(state.progress[i], d.need)
          return (
            <li key={d.id} data-done={done || undefined}>
              <span className="mission-check" aria-hidden>
                {done ? '✓' : ''}
              </span>
              <span className="mission-text">{d.text}</span>
              <span className="mission-prog">{done ? '⭐+1' : d.need > 1 ? `${v}/${d.need}` : ''}</span>
            </li>
          )
        })}
      </ul>
      <p className="mission-bonus">{state.bonus ? `ぜんぶ クリア！ ⭐+${BONUS_STARS} もらったよ` : `3つ ぜんぶ クリアで ⭐+${BONUS_STARS}`}</p>
      <div className="stamps" aria-label={`スタンプ ${p.days.length}こ`}>
        {week.map((w) => (
          <span
            key={w.key}
            className="stamp"
            data-on={p.days.includes(w.key) || undefined}
            data-today={w.today || undefined}
            style={p.days.includes(w.key) ? { backgroundImage: `url(${import.meta.env.BASE_URL}pikuru/ok.png)` } : undefined}
          >
            <i aria-hidden>{p.days.includes(w.key) ? '' : w.label}</i>
          </span>
        ))}
        <span className="stamp-total">
          スタンプ {p.days.length}こ
          {next?.item && (
            <small>
              あと {next.n - p.days.length}こで「{next.item.label}」
            </small>
          )}
        </span>
      </div>
    </section>
  )
}
