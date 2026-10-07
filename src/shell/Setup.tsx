/**
 * あそぶ前の準備。上下の人がそれぞれ自分のレベルを選んで「じゅんびOK」を押す。2人そろったら始まる。
 */
import { useEffect, useState } from 'react'
import { LEVELS, LEVEL_INFO, SIDE_NAME } from '../core/players'
import type { Level, Side } from '../core/players'
import { getSettings, setSettings, useSettings } from '../core/settings'
import { sfx, unlockAudio } from '../core/sound'
import { speak } from '../core/speak'
import { Half, Stage } from '../core/Stage'
import { HowToSheet } from '../ui/HowToSheet'
import { PaddleIcon, PaddlePicker } from '../ui/PaddleIcon'
import type { PaddleLook } from '../ui/paddleArt'
import { Pikuru } from '../ui/Pikuru'
import type { GameId, GameInfo } from './games'
import { href } from './route'
import './setup.css'

/** 何点先取か（ラリーポイント制） */
const TARGETS = [5, 7, 11]
/** パドルを使うゲーム（パドルをえらぶボタンを出す） */
const PADDLE_GAMES: GameId[] = ['rally']
/** まんなかの帯の ひとこと */
const MID_NOTE: Partial<Record<GameId, string>> = {}

export function Setup({ game }: { game: GameInfo }) {
  const settings = useSettings()
  const [ready, setReady] = useState<[boolean, boolean]>([false, false])
  const [help, setHelp] = useState(false)
  /** パドルをえらんでいる人 */
  const [picker, setPicker] = useState<Side | null>(null)
  const usesPaddle = PADDLE_GAMES.includes(game.id)

  useEffect(() => {
    speak(game.howto)
  }, [game])

  useEffect(() => {
    if (ready[0] && ready[1]) {
      sfx.go()
      location.hash = href('play', game.id)
    }
  }, [ready, game.id])

  const pick = (side: Side, level: Level) => {
    unlockAudio()
    sfx.tick()
    const levels: [Level, Level] = [...getSettings().levels]
    levels[side] = level
    const patch: Parameters<typeof setSettings>[0] = { levels }
    // 2人とも「せんしゅ」になったら、ラリーはほんかくルールにする（あとで変えられる）
    const wasBoth = getSettings().levels.every((l) => l === 'senshu')
    const isBoth = levels.every((l) => l === 'senshu')
    if (isBoth && !wasBoth) patch.rallyRules = 'real'
    if (!isBoth && wasBoth) patch.rallyRules = 'easy'
    setSettings(patch)
  }

  const setPaddle = (side: Side, look: PaddleLook) => {
    const paddles: [PaddleLook, PaddleLook] = [...getSettings().paddles]
    paddles[side] = look
    setSettings({ paddles })
  }

  const toggleReady = (side: Side) => {
    unlockAudio()
    sfx.tick()
    setReady((r) => {
      const next: [boolean, boolean] = [r[0], r[1]]
      next[side] = !next[side]
      return next
    })
  }

  return (
    <Stage>
      {([1, 0] as Side[]).map((side) => (
        <Half key={side} side={side} className={`setup-half setup-side-${side} ${game.id === 'rally' ? 'setup-half-wide' : ''}`}>
          <div className="setup-inner">
            <div className="setup-head">
              <span className={`side-chip side-chip-${side}`}>{SIDE_NAME[side]}</span>
              <span className="setup-game">{game.title}</span>
              {usesPaddle && (
                <button className="paddle-btn" aria-label="パドルを えらぶ" data-testid={`paddle-btn-${side}`} onClick={() => setPicker(side)}>
                  <PaddleIcon look={settings.paddles[side]} size={40} />
                </button>
              )}
            </div>
            <div className="level-grid" role="radiogroup" aria-label="レベル">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  className="level-btn"
                  role="radio"
                  aria-checked={settings.levels[side] === lv}
                  data-level={lv}
                  onClick={() => pick(side, lv)}
                >
                  <span className="level-mark" aria-hidden>
                    {LEVEL_INFO[lv].mark}
                  </span>
                  <span className="level-label">{LEVEL_INFO[lv].label}</span>
                  <span className="level-hint">{LEVEL_INFO[lv].hint}</span>
                </button>
              ))}
            </div>
            <button className={`btn ready-btn ${ready[side] ? 'is-ready' : 'btn-go'}`} aria-pressed={ready[side]} data-testid={`ready-${side}`} onClick={() => toggleReady(side)}>
              {ready[side] ? 'まってるよ…' : 'じゅんび OK！'}
            </button>
          </div>
          {picker === side && <PaddlePicker value={settings.paddles[side]} onChange={(look) => setPaddle(side, look)} onClose={() => setPicker(null)} />}
        </Half>
      ))}

      <div className="setup-mid">
        <a className="btn btn-small" href="#/" aria-label="もどる">
          ←
        </a>
        {game.id === 'rally' ? (
          <div className="setup-rows">
            <div className="seg" role="radiogroup" aria-label="ルール">
              {(['easy', 'real'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={settings.rallyRules === m} onClick={() => setSettings({ rallyRules: m })}>
                  {m === 'easy' ? 'かんたん' : 'ほんかく'}
                </button>
              ))}
            </div>
            <div className="setup-row">
              {settings.rallyRules === 'real' && (
                <div className="seg" role="radiogroup" aria-label="てんの かぞえかた">
                  {(['sideout', 'rally'] as const).map((m) => (
                    <button key={m} role="radio" aria-checked={settings.rallyScoring === m} onClick={() => setSettings({ rallyScoring: m })}>
                      {m === 'sideout' ? 'サイドアウト' : 'ラリー'}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn btn-small target-btn"
                aria-label={`${settings.rallyTarget}てん とったら かち（おすと かわる）`}
                onClick={() => setSettings({ rallyTarget: TARGETS[(TARGETS.indexOf(settings.rallyTarget) + 1) % TARGETS.length] })}
              >
                {settings.rallyTarget}てん
              </button>
            </div>
          </div>
        ) : (
          <div className="setup-mid-note">
            <Pikuru face={game.face} size={40} />
            {MID_NOTE[game.id] ?? 'レベルに あわせた もんだいが でるよ'}
          </div>
        )}
        <button className="btn btn-small mid-btn-help" aria-label="あそびかた・ルール" onClick={() => setHelp(true)}>
          ？
        </button>
      </div>
      {help && <HowToSheet game={game.id} onClose={() => setHelp(false)} canFlip />}
    </Stage>
  )
}
