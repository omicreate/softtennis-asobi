/**
 * リアクション ボレー（ひとり・ハイスコア）の画面。手に持って遊ぶので画面は回さない。
 * ボールマシンから球が飛んできたら、画面のどこでもタップ。オレンジの球（フェイント）はさわらない。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { createRx, secText, stepRx, tapRx, totals, TRIES } from './reaction'
import type { RxEvent, RxState } from './reaction'
import './reaction.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `reaction-best-${lv}`

export function ReactionGame({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  const contest = play.contest
  const level = levels[0]
  const rand = useMemo(() => (contest ? mulberry32(contest.seed) : Math.random), [contest])
  const game = useMemo<RxState>(() => createRx(level, rand), [level, rand])
  const [, setTick] = useState(0)
  const [over, setOver] = useState<{ avg: number; score: number; best: number } | null>(null)
  const shownAt = useRef(0)

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __rx?: RxState }).__rx = game
  }, [game])

  const handle = (events: RxEvent[]) => {
    for (const ev of events) {
      switch (ev.type) {
        case 'ball':
          shownAt.current = performance.now()
          break
        case 'hit':
          sfx.pop(0.8)
          break
        case 'foul':
          sfx.ng()
          break
        case 'slow':
          sfx.bounce()
          break
        case 'over': {
          sfx.fanfare()
          play.finish({ value: ev.score })
          if (contest) {
            setOver({ ...ev, best: 0 })
            break
          }
          const prev = load<number>(bestKey(level), 0)
          const best = prev ? Math.min(prev, ev.score) : ev.score
          save(bestKey(level), best)
          if (!prev || ev.score < prev) speak(PHRASES.great)
          setOver({ ...ev, best })
          break
        }
      }
    }
  }

  useFrame((dt) => {
    if (paused || over) return
    const before = game.phase
    handle(stepRx(game, dt, rand))
    if (before !== game.phase || game.phase === 'go') setTick((n) => (n + 1) % 1000)
  })

  const onTap = () => {
    unlockAudio()
    if (paused || over) return
    // 反応の時間は、画面のフレームではなくタップした瞬間の時刻で測る（16ms のずれをなくす）
    if (game.phase === 'go' && shownAt.current) game.t = (performance.now() - shownAt.current) / 1000
    const ev: RxEvent[] = []
    tapRx(game, ev, rand)
    handle(ev)
    setTick((n) => (n + 1) % 1000)
  }

  const t = totals(game)
  const face = game.phase === 'go' ? 'eh' : game.last?.kind === 'foul' ? 'oops' : game.last?.kind === 'ok' ? 'ok' : 'think'

  return (
    <div className="rx" onPointerDown={onTap} data-testid="rx-area" data-phase={game.phase}>
      <div className="rx-hud">
        <HawkCut art={face} height={52} />
        <span className="rx-count">
          {Math.min(game.results.length + (game.phase === 'over' ? 0 : 1), TRIES)}/{TRIES}
        </span>
      </div>
      <div className="rx-machine">
        <span>ボールマシン</span>
      </div>
      <div className="rx-center">
        {game.phase === 'ready' && <p className="rx-msg">ボールが きたら すぐ タップ！</p>}
        {game.phase === 'wait' && <p className="rx-msg rx-dim">まだだよ…</p>}
        {game.phase === 'fake' && <div className="rx-ball rx-fake" aria-label="フェイント" />}
        {game.phase === 'go' && <div className="rx-ball" aria-label="ボール" />}
        {game.phase === 'shown' && game.last && (
          <p className="rx-last" data-kind={game.last.kind}>
            {game.last.kind === 'foul' ? 'フライング！' : game.last.kind === 'slow' ? 'おそい！' : secText(game.last.ms)}
          </p>
        )}
      </div>
      <ol className="rx-list">
        {Array.from({ length: TRIES }, (_, i) => (
          <li key={i} data-kind={game.results[i] === undefined ? undefined : game.results[i] >= 1000 ? 'bad' : 'ok'}>
            {game.results[i] === undefined ? '－' : secText(game.results[i])}
          </li>
        ))}
      </ol>
      {over && !contest && (
        <Result
          single
          title={() => `へいきん ${secText(over.avg)}`}
          sub={() =>
            (LEVEL_INFO[level].pressDelay ? `ハンデこみ ${secText(over.score)}。` : '') +
            (over.score <= over.best ? 'さいこう きろく！' : `さいこうは ${secText(over.best)}（${LEVEL_INFO[level].label}）`)
          }
          face={() => (over.score <= over.best ? 'ok' : 'eh')}
          onAgain={onRestart}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {t.avg ? `へいきん ${secText(t.avg)}` : ''}
      </span>
    </div>
  )
}
