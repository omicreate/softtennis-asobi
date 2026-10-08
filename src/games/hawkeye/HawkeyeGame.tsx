/**
 * ホークアイの め（ひとりで）の画面。手に持って遊ぶので画面は回さない。
 * 上から見たコートを少しのあいだ見せ、消えたら質問。答えあわせでは、もう一度コートを見せる。
 */
import { useMemo, useState } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { mulberry32 } from '../../core/rng'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Result } from '../../ui/GameUI'
import { HawkCut } from '../../ui/hawkArt'
import { answerHe, createHe, L, NET, QUESTIONS, SERVICE, SHOW_SEC, stepHe, W } from './hawkeye'
import type { HeEvent, HeState, Question } from './hawkeye'
import './hawkeye.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `hawkeye-best-${lv}`
/** 見せる範囲（m）。コートのまわりも少し */
const VB = { x: -1.2, y: -1.6, w: W + 2.4, h: L + 3.2 }
/** ダブルスとシングルスのサイドラインの間（m） */
const ALLEY = (10.97 - 8.23) / 2

export function HawkeyeGame({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  const contest = play.contest
  const level = levels[0]
  const rand = useMemo(() => (contest ? mulberry32(contest.seed) : Math.random), [contest])
  const game = useMemo<HeState>(() => createHe(level, rand), [level, rand])
  const [, setTick] = useState(0)
  const [over, setOver] = useState<{ correct: number; best: number } | null>(null)

  const handle = (events: HeEvent[]) => {
    for (const ev of events) {
      switch (ev.type) {
        case 'hide':
          sfx.tick()
          break
        case 'answer':
          if (ev.ok) {
            sfx.ok()
            speak(PHRASES.nice)
          } else sfx.ng()
          break
        case 'over': {
          sfx.fanfare()
          play.finish({ value: ev.correct })
          if (contest) {
            setOver({ correct: ev.correct, best: 0 })
            break
          }
          const best = Math.max(load<number>(bestKey(level), 0), ev.correct)
          save(bestKey(level), best)
          if (ev.correct >= best && ev.correct > 0) speak(PHRASES.great)
          setOver({ correct: ev.correct, best })
          break
        }
      }
    }
  }

  useFrame((dt) => {
    if (paused || over) return
    const before = game.phase
    handle(stepHe(game, dt, rand))
    if (before !== game.phase || game.phase === 'show') setTick((n) => (n + 1) % 1000)
  })

  const pick = (id: string) => {
    unlockAudio()
    if (paused || over) return
    handle(answerHe(game, id))
    setTick((n) => (n + 1) % 1000)
  }

  const q = game.question
  const showPlayers = game.phase === 'show' || game.phase === 'result'
  const ok = game.picked === q.answer
  const face = game.phase === 'result' ? (ok ? 'ok' : 'oops') : 'think'
  const left = game.phase === 'show' ? game.timer / SHOW_SEC[level] : 0

  return (
    <div className="he" data-phase={game.phase} data-testid="he-area">
      <div className="he-hud">
        <HawkCut art={face} height={52} />
        <span className="he-count">
          {Math.min(game.index + 1, QUESTIONS)}/{QUESTIONS}
        </span>
        <span className="he-score">せいかい {game.correct}</span>
      </div>
      <div className="he-court-wrap">
        <Court q={q} showPlayers={showPlayers} />
        {game.phase === 'show' && (
          <div className="he-timer" aria-hidden>
            <i style={{ transform: `scaleX(${Math.max(0, left)})` }} />
          </div>
        )}
        {game.phase === 'ask' && <p className="he-hidden">どこだったかな？</p>}
      </div>
      <div className="he-panel">
        {game.phase === 'show' ? (
          <p className="he-prompt he-look">よく みて おぼえよう！</p>
        ) : (
          <>
            <p className="he-prompt">{q.prompt}</p>
            <div className="he-choices" style={{ gridTemplateColumns: `repeat(${q.cols}, minmax(0, 1fr))` }} role="group" aria-label="こたえ">
              {q.choices.map((c) => {
                const state = game.phase !== 'result' ? '' : c.id === q.answer ? 'is-right' : c.id === game.picked ? 'is-wrong' : 'is-dim'
                return (
                  <button key={c.id} className={`he-choice ${state}`} disabled={game.phase !== 'ask'} onClick={() => pick(c.id)} data-testid={`he-choice-${c.id}`}>
                    {c.label}
                  </button>
                )
              })}
            </div>
            {game.phase === 'result' && (
              <p className="he-explain" aria-live="polite">
                {ok ? 'せいかい！ ' : 'おしい！ '}
                {q.explain}
              </p>
            )}
          </>
        )}
      </div>
      {over && !contest && (
        <Result
          single
          title={() => `${QUESTIONS}もん中 ${over.correct}もん せいかい！`}
          sub={() => (over.correct >= over.best && over.correct > 0 ? 'さいこう きろく！' : `さいこうは ${over.best}もん（${LEVEL_INFO[level].label}）`)}
          face={() => (over.correct >= QUESTIONS / 2 ? 'ok' : 'eh')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

/** 上から見たコート（ダブルスのコート）。上が相手、下が自分たち */
function Court({ q, showPlayers }: { q: Question; showPlayers: boolean }) {
  const line = { stroke: '#ffffff', strokeWidth: 0.08 }
  return (
    <svg className="he-court" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-label={showPlayers ? 'コートの ようす' : 'コート（いまは かくれている）'}>
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} rx={0.8} fill="#1f5a42" />
      <rect x={0} y={0} width={W} height={L} fill="#2f8a5f" {...line} />
      <line x1={ALLEY} y1={0} x2={ALLEY} y2={L} {...line} />
      <line x1={W - ALLEY} y1={0} x2={W - ALLEY} y2={L} {...line} />
      <line x1={ALLEY} y1={NET - SERVICE} x2={W - ALLEY} y2={NET - SERVICE} {...line} />
      <line x1={ALLEY} y1={NET + SERVICE} x2={W - ALLEY} y2={NET + SERVICE} {...line} />
      <line x1={W / 2} y1={NET - SERVICE} x2={W / 2} y2={NET + SERVICE} {...line} />
      <line x1={-0.9} y1={NET} x2={W + 0.9} y2={NET} stroke="#12302b" strokeWidth={0.22} />
      <text x={W / 2} y={-0.55} textAnchor="middle" className="he-side-label">
        あいて
      </text>
      <text x={W / 2} y={L + 1.15} textAnchor="middle" className="he-side-label">
        じぶんたち
      </text>
      {showPlayers && (
        <g>
          {q.players.map((p, i) =>
            p.team === 'ours' ? (
              <g key={i} transform={`translate(${p.x} ${p.y})`}>
                <circle r={0.75} fill="#f4e04d" stroke="#12302b" strokeWidth={0.1} />
                <text y={0.32} textAnchor="middle" className="he-role">
                  {p.role}
                </text>
              </g>
            ) : (
              <g key={i} transform={`translate(${p.x} ${p.y})`}>
                <rect x={-0.7} y={-0.7} width={1.4} height={1.4} rx={0.18} fill="#ffffff" stroke="#12302b" strokeWidth={0.1} />
                <text y={0.32} textAnchor="middle" className="he-role">
                  {p.role}
                </text>
              </g>
            ),
          )}
          {q.ball && (
            <g>
              <circle cx={q.ball.x} cy={q.ball.y} r={0.42} fill="#fff1a8" stroke="#b39a3e" strokeWidth={0.08} />
              <circle cx={q.ball.x - 0.13} cy={q.ball.y - 0.13} r={0.12} fill="rgba(255,255,255,0.8)" />
            </g>
          )}
        </g>
      )}
    </svg>
  )
}
