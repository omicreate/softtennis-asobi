/**
 * きろく と メダル。ゲームごとの じこベストと、どう・ぎん・きん の メダル、つぎの目標を見せる。
 * メダルを とると ほしが もらえる（どう・ぎん 1こ、きん 2こ）。
 */
import { medalCount, useProgress } from '../core/progress'
import { MEDAL_GAMES, MEDAL_MARK, MEDAL_NAME, MEDAL_RULES, MEDAL_STARS, nextGoal, recordText } from '../core/records'
import { GameIcon } from '../ui/GameIcon'
import { gameById } from './games'
import { href } from './route'
import './setup.css'
import './collection.css'
import './records.css'

export function Records() {
  const progress = useProgress()
  const total = medalCount(progress)
  return (
    <main className="records">
      <header className="col-head">
        <a className="btn btn-small" href="#/" aria-label="もどる">
          ←
        </a>
        <h1 className="col-title">きろく と メダル</h1>
        <span className="star-pill" aria-label={`メダル ${total}`} data-testid="medal-total">
          🏅 {total}
        </span>
      </header>
      <p className="rec-lead">
        ひとりで あそぶ ゲーム（と ディンク）で、じぶんの きろくを のばそう。メダルを とると ほしが もらえるよ（どう・ぎん ⭐1、きん ⭐{MEDAL_STARS[3]}）。
      </p>
      <ul className="rec-list">
        {MEDAL_GAMES.map((id) => {
          const g = gameById(id)!
          const best = progress.best[id]
          const got = progress.medals[id] ?? 0
          const goal = nextGoal(id, best)
          const rule = MEDAL_RULES[id]!
          return (
            <li key={id}>
              <a className="rec-card" href={href('setup', id)} data-testid={`rec-${id}`}>
                <GameIcon game={id} size={60} />
                <span className="rec-text">
                  <span className="rec-title">{g.title}</span>
                  <span className="rec-best">{best === undefined ? 'まだ きろく なし' : `さいこう：${recordText(id, best)}`}</span>
                  <span className="rec-goal">
                    {goal ? `つぎは ${MEDAL_NAME[goal.medal]}メダル：${recordText(id, goal.need)}${rule.low ? ' いない' : ''}` : 'きんメダル たっせい！'}
                  </span>
                </span>
                <span className="rec-medals" aria-label={got ? `${MEDAL_NAME[got]}メダル` : 'メダル なし'}>
                  {[1, 2, 3].map((m) => (
                    <span key={m} className="rec-medal" data-on={got >= m || undefined}>
                      {MEDAL_MARK[m]}
                    </span>
                  ))}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="rec-note">メダルの きろくは レベルに かんけいなく おなじ。ちいさい こは やさしい レベルで めざそう。</p>
    </main>
  )
}
