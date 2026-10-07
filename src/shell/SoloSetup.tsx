/**
 * ひとりで遊ぶ前の準備。手に持って遊ぶので、画面は回さずふつうの向き。
 * レベルを選ぶ（ピクルくんとラリーでは、ピクルくんも同じレベルの強さになる）。
 */
import { useEffect, useState } from 'react'
import { LEVELS, LEVEL_INFO } from '../core/players'
import { setSettings, useSettings } from '../core/settings'
import { sfx, unlockAudio } from '../core/sound'
import { speak } from '../core/speak'
import { HowToSheet } from '../ui/HowToSheet'
import { PaddleIcon, PaddlePicker } from '../ui/PaddleIcon'
import { Pikuru } from '../ui/Pikuru'
import type { GameInfo } from './games'
import { href } from './route'
import './setup.css'

/** 何点先取か（ラリーポイント制） */
const TARGETS = [5, 7, 11]

export function SoloSetup({ game }: { game: GameInfo }) {
  const settings = useSettings()
  const [help, setHelp] = useState(false)
  const [picker, setPicker] = useState(false)
  // 自分のパドルが画面に出るゲームだけ（ジャンプ・キャッチ・リアクション・ピタッと では出さない）
  const usesPaddle = (['lift', 'breakout', 'target', 'pikuru'] as string[]).includes(game.id)

  useEffect(() => {
    speak(game.howto)
  }, [game])

  return (
    <main className="solo-setup">
      <header className="solo-head">
        <a className="btn btn-small" href="#/" aria-label="もどる">
          ←
        </a>
        <span className="side-chip side-chip-0">ひとりで</span>
        <h1 className="solo-title">{game.title}</h1>
      </header>

      <div className="solo-intro">
        <Pikuru face={game.face} size={88} />
        <p>{game.howto}</p>
        <button className="btn btn-small" aria-label="せつめいを よみあげる" onClick={() => speak(game.howto)}>
          🗣️
        </button>
      </div>

      <h2 className="solo-label">{game.id === 'pikuru' ? 'レベル（ピクルくんも おなじ つよさ）' : 'レベル'}</h2>
      <div className="level-grid" role="radiogroup" aria-label="レベル">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            className="level-btn"
            role="radio"
            aria-checked={settings.soloLevel === lv}
            data-level={lv}
            onClick={() => {
              unlockAudio()
              sfx.tick()
              setSettings({ soloLevel: lv })
            }}
          >
            <span className="level-mark" aria-hidden>
              {LEVEL_INFO[lv].mark}
            </span>
            <span className="level-label">{LEVEL_INFO[lv].label}</span>
            <span className="level-hint">{LEVEL_INFO[lv].hint}</span>
          </button>
        ))}
      </div>

      {game.id === 'sagasu' && (
        <div className="solo-options">
          <div className="seg" role="radiogroup" aria-label="あそびかた">
            {(['wally', 'diff'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={settings.sagasuMode === m} onClick={() => setSettings({ sagasuMode: m })} data-testid={`sagasu-mode-${m}`}>
                {m === 'wally' ? 'さがせ！ピクルくん' : 'まちがいさがし'}
              </button>
            ))}
          </div>
        </div>
      )}

      {game.id === 'pikuru' && (
        <div className="solo-options">
          <div className="seg" role="radiogroup" aria-label="ルール">
            {(['easy', 'real'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={settings.rallyRules === m} onClick={() => setSettings({ rallyRules: m })}>
                {m === 'easy' ? 'かんたん' : 'ほんかく'}
              </button>
            ))}
          </div>
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
      )}

      {usesPaddle && (
        <button className="solo-paddle" onClick={() => setPicker(true)} data-testid="solo-paddle">
          <PaddleIcon look={settings.paddles[0]} size={48} />
          <span>じぶんの パドル</span>
          <span className="solo-paddle-change">かえる</span>
        </button>
      )}
      <button className="btn solo-help" onClick={() => setHelp(true)}>
        ？ あそびかた・ルールを みる
      </button>
      <a className="btn btn-go solo-start" href={href('play', game.id)} data-testid="solo-start" onClick={unlockAudio}>
        はじめる！
      </a>
      {game.party && (
        <a className="btn solo-party" href={href('party', game.id)} data-testid="solo-party" onClick={unlockAudio}>
          👥 みんなで じゅんばんに しょうぶ
          <small>1だいを まわして、この ゲームの きろくで くらべる</small>
        </a>
      )}
      {help && <HowToSheet game={game.id} onClose={() => setHelp(false)} fixed />}
      {picker && (
        <div className="picker-fixed" onClick={() => setPicker(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <PaddlePicker value={settings.paddles[0]} onChange={(look) => setSettings({ paddles: [look, settings.paddles[1]] })} onClose={() => setPicker(false)} />
          </div>
        </div>
      )}
    </main>
  )
}
