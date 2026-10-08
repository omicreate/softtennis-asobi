import { useEffect, useState } from 'react'
import { inAppName, isStandalone } from '../core/browser'
import { WELCOME_STARS } from '../core/items'
import { medalCount, takeWelcome, useProgress } from '../core/progress'
import { MEDAL_MARK, MEDAL_RULES, recordText } from '../core/records'
import { setSettings, useSettings } from '../core/settings'
import { unlockAudio } from '../core/sound'
import { speak } from '../core/speak'
import { PHRASES } from '../core/voiceLines'
import { Hawk } from '../ui/Hawk'
import { GameIcon } from '../ui/GameIcon'
import { HawkCut } from '../ui/hawkArt'
import { gameById, GAMES } from './games'
import type { GameInfo } from './games'
import { MissionCard } from './MissionCard'
import { href } from './route'
import './home.css'
import './install.css'

/** ゲーム名：単語の途中で折り返さないよう、区切ってよい所（| の所）でだけ折り返す */
function CardTitle({ g }: { g: GameInfo }) {
  const parts = (g.wrap ?? g.title).split('|')
  return (
    <span className="game-title">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <wbr />}
        </span>
      ))}
    </span>
  )
}

/** ゲームのカード（絵・なかま分け・名前・ひとこと・じこベスト） */
function GameCard({ g, best, medal, tag, className = '' }: { g: GameInfo; best?: number; medal: number; tag: string; className?: string }) {
  const rule = MEDAL_RULES[g.id]
  return (
    <a className={`game-card ${className}`} href={href('setup', g.id)} data-game={g.id} onClick={unlockAudio}>
      <span className="game-card-top">
        <GameIcon game={g.id} size={64} />
        <span className="game-tag">{tag}</span>
      </span>
      <span className="game-text">
        <CardTitle g={g} />
        <span className="game-desc">{g.desc}</span>
        {rule && best !== undefined && (
          <span className="game-best" data-testid={`best-${g.id}`}>
            {MEDAL_MARK[medal] || '🎯'} {recordText(g.id, best)}
          </span>
        )}
      </span>
    </a>
  )
}

export function Home() {
  const settings = useSettings()
  const progress = useProgress()
  const recent = progress.recent.map((id) => gameById(id)).filter((g): g is GameInfo => !!g)
  const [welcome, setWelcome] = useState(false)
  // インスタなどのアプリの中で開いているときは、ふつうのブラウザで開きなおす案内（おうちの方向け）
  const [inApp] = useState(() => (isStandalone() ? null : inAppName()))

  useEffect(() => {
    if (takeWelcome()) setWelcome(true)
  }, [])

  return (
    <main className="home">
      <header className="home-hero">
        <a className="home-pikuru" href="#/collection" aria-label="ホークアイ先生の きせかえ">
          <HawkCut art="full" height={150} />
        </a>
        <div>
          <h1 className="home-title">
            ホークアイ先生と
            <br />
            あそぼ
          </h1>
          <p className="home-lead">ひとりでも ふたりでも みんなでも あそべるよ</p>
          <div className="home-hero-btns">
            <a className="btn btn-small home-dress" href="#/collection" onClick={unlockAudio}>
              👕 きせかえ
            </a>
            <a className="btn btn-small home-dress" href="#/records" onClick={unlockAudio} data-testid="records-link">
              🏅 きろく {medalCount(progress) > 0 ? medalCount(progress) : ''}
            </a>
          </div>
        </div>
      </header>

      {inApp && (
        <div className="inapp-banner" data-testid="inapp-banner">
          <p>
            おうちの方へ：いま {inApp} の中で開いています。ホーム画面に入れるには、Safari・Chrome で開きなおしてください。
          </p>
          <a className="btn btn-small" href="#/install">
            ほうほう
          </a>
        </div>
      )}

      <MissionCard />

      {recent.length > 0 && (
        <section className="home-recent" aria-labelledby="games-recent">
          <h2 id="games-recent" className="game-section-title">
            また あそぶ
          </h2>
          <ul className="recent-list">
            {recent.map((g) => (
              <li key={g.id}>
                <a className="recent-chip" href={href('setup', g.id)} data-recent={g.id} onClick={unlockAudio}>
                  <GameIcon game={g.id} size={44} />
                  <span>{g.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {([2, 1] as const).map((n) => (
        <section key={n} className="game-section" aria-labelledby={`games-${n}`}>
          <h2 id={`games-${n}`} className="game-section-title">
            {n === 2 ? 'ふたりで あそぶ' : 'ひとりで あそぶ'}
          </h2>
          <ul className="game-list">
            {GAMES.filter((g) => g.players === n && !g.adult).map((g) => (
              <li key={g.id}>
                <GameCard g={g} tag={g.tag} best={progress.best[g.id]} medal={progress.medals[g.id] ?? 0} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="game-section" aria-labelledby="games-adult">
        <h2 id="games-adult" className="game-section-title">
          おとなも むちゅう
        </h2>
        <p className="game-section-lead">サッと あそべて、けっかで もりあがる しょうぶ</p>
        <ul className="game-list">
          {GAMES.filter((g) => g.adult).map((g) => (
            <li key={g.id}>
              <GameCard
                g={g}
                className="game-card-adult"
                tag={g.players === 2 ? `ふたり・${g.tag}` : g.tag}
                best={progress.best[g.id]}
                medal={progress.medals[g.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="game-section" aria-labelledby="games-party">
        <h2 id="games-party" className="game-section-title">
          みんなで あそぶ
        </h2>
        <p className="game-section-lead">1だいを じゅんばんに てわたし して あそぶよ</p>
        <ul className="game-list game-list-group">
          {GAMES.filter((g) => g.players === 'group').map((g) => (
            <li key={g.id}>
              <GameCard g={g} className="game-card-group" tag={g.sizes ? `${g.sizes.join('・')}にん` : g.range ? `${g.range[0]}〜${g.range[1]}にん` : g.tag} medal={0} />
            </li>
          ))}
        </ul>
        <a className="game-card game-card-party" href="#/party" data-game="party" onClick={unlockAudio}>
          <Hawk face="ok" size={72} />
          <span className="game-text">
            <span className="game-tag">2〜6にん</span>
            <span className="game-title">じゅんばんモード</span>
            <span className="game-desc">1だいを じゅんばんに まわして、きろくで しょうぶ！</span>
          </span>
        </a>
      </section>

      <section className="home-toggles" aria-label="せってい">
        <button className="toggle" aria-pressed={settings.sound} onClick={() => setSettings({ sound: !settings.sound })}>
          <span aria-hidden>{settings.sound ? '🔊' : '🔇'}</span> おと {settings.sound ? 'あり' : 'なし'}
        </button>
        <button className="toggle" aria-pressed={settings.speak} onClick={() => setSettings({ speak: !settings.speak })}>
          <span aria-hidden>{settings.speak ? '🗣️' : '🤐'}</span> よみあげ {settings.speak ? 'あり' : 'なし'}
        </button>
      </section>

      <a className="home-parents" href="#/parents" data-testid="parents-link">
        おうちの方へ（記録・集計・共有・あそびかた）
      </a>

      {welcome && (
        <div className="welcome-backdrop" onClick={() => setWelcome(false)}>
          <div className="welcome" role="dialog" aria-label="はじめての プレゼント" onClick={(e) => e.stopPropagation()}>
            <HawkCut art="ok" height={120} />
            <p className="welcome-title">はじめての プレゼント！</p>
            <p className="welcome-stars">⭐ × {WELCOME_STARS}</p>
            <p className="welcome-sub">ほしで ホークアイ先生の こものや ラケットと こうかん できるよ</p>
            <div className="welcome-actions">
              <button
                className="btn btn-small"
                aria-label="よみあげる"
                onClick={() => {
                  unlockAudio()
                  speak(PHRASES.welcome)
                }}
              >
                🗣️
              </button>
              <button className="btn btn-go" onClick={() => setWelcome(false)}>
                ありがとう！
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
