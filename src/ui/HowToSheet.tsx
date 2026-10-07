/**
 * 「あそびかた・ルール」のページ。ゲーム中の「？」・メニュー・準備画面から開く。
 * ゲーム中に開くとゲームは止まり、とじると続きから。2人のゲームでは、向かいの人のために向きを変えられる。
 */
import { useEffect, useState } from 'react'
import { speak, stopSpeaking } from '../core/speak'
import { gameById } from '../shell/games'
import type { GameId } from '../shell/games'
import { HOWTO, howtoSpeech } from '../shell/howto'
import { PikuruCut } from './pikuruArt'
import './howto.css'

export function HowToSheet({
  game,
  onClose,
  canFlip = false,
  fixed = false,
}: {
  game: GameId
  onClose: () => void
  /** 2人のゲーム：向かいの人のために向きを変えるボタンを出す */
  canFlip?: boolean
  /** ふつうのページ（準備画面）から開くとき */
  fixed?: boolean
}) {
  const info = gameById(game)!
  const h = HOWTO[game]
  const [flipped, setFlipped] = useState(false)

  // とじたら読み上げも止める
  useEffect(() => () => stopSpeaking(), [])

  return (
    <div className={`howto-backdrop ${fixed ? 'howto-backdrop-fixed' : ''}`} onClick={onClose}>
      <section
        className="howto-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${info.title}の あそびかた`}
        data-flipped={flipped || undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="howto-head">
          <PikuruCut art="think" height={64} className="howto-pikuru" />
          <div className="howto-title">
            <span className="howto-eyebrow">あそびかた・ルール</span>
            <h2>{info.title}</h2>
          </div>
          <button className="btn btn-small" aria-label="とじる" data-testid="howto-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="howto-tools">
          <button className="btn btn-small" onClick={() => speak(howtoSpeech(game))}>
            🗣️ よみあげ
          </button>
          {canFlip && (
            <button className="btn btn-small" onClick={() => setFlipped((f) => !f)}>
              🔄 むきを かえる
            </button>
          )}
        </div>

        <div className="howto-body">
          <h3>あそびかた</h3>
          <ul>
            {h.play.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>ルールと はんてい</h3>
          <ul>
            {h.rules.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>レベルの ちがい</h3>
          <ul>
            {h.levels.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <details className="howto-detail">
            <summary>おうちの方へ（くわしいルール）</summary>
            <ul>
              {h.detail.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="howto-source">ルールは USA Pickleball 公式ルールブック（2026年版）にもとづいています。かっこの中の PBK-番号 は、根拠にした知識カードの番号です。</p>
          </details>
        </div>

        <button className="btn btn-go howto-back" onClick={onClose}>
          あそびに もどる
        </button>
      </section>
    </div>
  )
}
