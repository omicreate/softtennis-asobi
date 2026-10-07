/**
 * ピタッと 10びょう（ひとり・ハイスコア）の画面。手に持って遊ぶので画面は回さない。
 * タップでピクルくんが ロブを打ち上げる。時計は とちゅうで消える。10秒ちょうどだと思ったらタップでキャッチ。
 */
import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Result } from '../../ui/GameUI'
import { PikuruCut } from '../../ui/pikuruArt'
import { best, clock, createS10, HIDE_AT, stepS10, tapS10, TRIES, visible } from './stop10'
import type { S10Event, S10State } from './stop10'
import '../reaction/reaction.css'
import './stop10.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `stop10-best-${lv}`
const diffText = (ms: number) => `ずれ ${(ms / 1000).toFixed(2)}びょう`

export function Stop10Game({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  const contest = play.contest
  const level = levels[0]
  const game = useMemo<S10State>(() => createS10(level), [level])
  const [, setTick] = useState(0)
  const [over, setOver] = useState<{ best: number; record: number } | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __s10?: S10State }).__s10 = game
  }, [game])

  const handle = (events: S10Event[]) => {
    for (const ev of events) {
      if (ev.type === 'start') sfx.pop(0.6)
      else if (ev.type === 'stop') {
        if (ev.diff <= 50) sfx.ok()
        else if (ev.diff <= 300) sfx.pop(0.5)
        else sfx.bounce()
      } else if (ev.type === 'over') {
        sfx.fanfare()
        play.finish({ value: ev.best })
        if (contest) {
          setOver({ best: ev.best, record: 0 })
          continue
        }
        const prev = load<number | null>(bestKey(level), null)
        const record = prev === null ? ev.best : Math.min(prev, ev.best)
        save(bestKey(level), record)
        if (prev === null || ev.best < prev) speak(PHRASES.great)
        setOver({ best: ev.best, record })
      }
    }
  }

  useFrame((dt) => {
    if (paused || over) return
    handle(stepS10(game, dt))
    setTick((n) => (n + 1) % 1000)
  })

  const onTap = () => {
    unlockAudio()
    if (paused || over) return
    const ev: S10Event[] = []
    tapS10(game, ev)
    handle(ev)
  }

  const running = game.phase === 'run'
  const show = visible(game)
  // ボールは時計が消えるまでに空の上へ消えていく（ボールの高さで時間が分からないように）
  const height = running && show ? Math.min(1, game.t / HIDE_AT[level]) : 0
  const face = game.phase === 'shown' && game.last ? (game.last.diff <= 100 ? 'ok' : game.last.diff <= 500 ? 'eh' : 'oops') : running ? 'think' : 'ok'

  return (
    <div className="s10" onPointerDown={onTap} data-testid="s10-area" data-phase={game.phase}>
      <div className="s10-hud">
        <span className="rx-count">
          {Math.min(game.results.length + (game.phase === 'over' ? 0 : 1), TRIES)}/{TRIES}
        </span>
      </div>
      <div className="s10-clock" data-hidden={!show || undefined} aria-live="off">
        {game.phase === 'idle' ? clock(0) : show ? clock(game.t) : '？？.？？'}
        <small>びょう</small>
      </div>
      <div className="s10-sky">
        {running && show && <div className="s10-ball" style={{ bottom: `${8 + height * 92}%`, opacity: 1 - height * 0.7 }} />}
      </div>
      <div className="s10-pikuru">
        <PikuruCut art={face} height={110} />
      </div>
      <p className="s10-msg">
        {game.phase === 'idle' && 'タップで ロブを うちあげる'}
        {running && (show ? '10びょうで おちてくるよ' : 'いまだ！と おもったら タップ')}
        {game.phase === 'shown' && game.last && `${clock(game.last.at)}びょう（${diffText(game.last.diff)}）`}
      </p>
      <ol className="rx-list">
        {Array.from({ length: TRIES }, (_, i) => (
          <li key={i} data-kind={game.results[i] !== undefined && game.results[i] > 500 ? 'bad' : undefined}>
            {game.results[i] === undefined ? '－' : diffText(game.results[i])}
          </li>
        ))}
      </ol>
      {over && !contest && (
        <Result
          single
          title={() => (over.best <= 30 ? 'ピタッ！ すごい！' : diffText(over.best))}
          sub={() => (over.best <= over.record ? 'さいこう きろく！' : `さいこうは ${diffText(over.record)}（${LEVEL_INFO[level].label}）`)}
          face={() => (over.best <= over.record ? 'ok' : 'eh')}
          onAgain={onRestart}
        />
      )}
      <span className="sr-only">{best(game)}</span>
    </div>
  )
}
