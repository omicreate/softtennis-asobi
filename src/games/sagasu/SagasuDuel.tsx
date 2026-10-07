/**
 * ピクルくん さがし たいせん（ふたり・むかいあう）。上と下に それぞれの絵を出し、先に ほんものを見つけた人が1点。3点先取。
 * 絵は1人ずつのレベルで作る（ちびっこは人が少なく、ちがいが大きい）。ちがう人をタップしたら1秒 おてつき。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '../../core/loop'
import { SIDE_NAME } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { Half, useStage } from '../../core/Stage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { DUEL_WIN, makeWally, ZONE_NAME } from './sagasu'
import type { WallyRound } from './sagasu'
import { ZONE_PHRASE } from './SagasuGame'
import { SceneSvg, TargetCard } from './SceneSvg'
import './sagasu.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const HEAD = 52
/** おてつきで止まる時間（秒） */
const FREEZE = 1

export function SagasuDuel({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  const stage = useStage()
  const dims = useMemo(() => {
    const W = Math.max(280, stage.w - 12)
    const H = Math.max(200, stage.h / 2 - HEAD - 10)
    return { w: 100, h: Math.min(160, Math.max(60, (100 * H) / W)) }
    // 始めたときの大きさで決める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const make = (): [WallyRound, WallyRound] => [makeWally(levels[0], dims.w, dims.h), makeWally(levels[1], dims.w, dims.h)]
  const [rounds, setRounds] = useState<[WallyRound, WallyRound]>(make)
  const [no, setNo] = useState(0)
  const [score, setScore] = useState<[number, number]>([0, 0])
  /** このラウンドで見つけた人（見つけたら次のラウンドまで止める） */
  const [winner, setWinner] = useState<Side | null>(null)
  const [over, setOver] = useState<Side | null>(null)
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'よーい', big: true })
  const ready = useRef(1.2)
  const frozen = useRef<[number, number]>([0, 0])
  const [, setTick] = useState(0)

  useEffect(() => {
    speak(PHRASES.sagasuDuel)
  }, [])
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sagasuDuel?: unknown }).__sagasuDuel = { rounds }
  }, [rounds])

  useFrame((dt) => {
    if (paused || over !== null) return
    if (ready.current > 0) {
      ready.current -= dt
      if (ready.current <= 0) {
        setNotice(null)
        sfx.go()
      }
    }
    for (const sd of [0, 1] as Side[]) if (frozen.current[sd] > 0) frozen.current[sd] = Math.max(0, frozen.current[sd] - dt)
    setTick((n) => (n + 1) % 1000)
  })

  const looking = ready.current <= 0 && winner === null && over === null && !paused

  const tap = (side: Side, id: string) => {
    unlockAudio()
    if (!looking || frozen.current[side] > 0) return
    const r = rounds[side]
    if (id !== r.target) {
      sfx.ng()
      frozen.current[side] = FREEZE
      return
    }
    sfx.ok()
    const next: [number, number] = [score[0], score[1]]
    next[side] += 1
    setScore(next)
    setWinner(side)
    speak(ZONE_PHRASE[r.zone])
    setNotice({ title: `${SIDE_NAME[side]}が みつけた！`, sub: `${ZONE_NAME[r.zone]}に いたよ`, faces: side === 0 ? ['ok', 'oops'] : ['oops', 'ok'] })
    window.setTimeout(() => {
      if (next[side] >= DUEL_WIN) {
        sfx.fanfare()
        speak(side === 0 ? PHRASES.win0 : PHRASES.win1)
        play.finish({ winner: side })
        setNotice(null)
        setOver(side)
        return
      }
      setRounds(make())
      setNo((n) => n + 1)
      setWinner(null)
      frozen.current = [0, 0]
      ready.current = 1.2
      setNotice({ title: 'よーい', big: true })
    }, 2000)
  }

  return (
    <div className="sagasu-duel">
      {([1, 0] as Side[]).map((side) => (
        <Half key={side} side={side} className="sagasu-half">
          <div className="sagasu-half-inner">
            <header className="sagasu-duel-head">
              <span className={`side-chip side-chip-${side}`}>{SIDE_NAME[side]}</span>
              <TargetCard size={38} />
              <b>ほんものは どこ？</b>
              <span className="sagasu-duel-no">{no + 1}かいめ</span>
            </header>
            <div className="sagasu-duel-field">
              {ready.current <= 0 || winner !== null ? (
                <SceneSvg
                  key={no}
                  scene={rounds[side].scene}
                  onPerson={(id) => tap(side, id)}
                  ring={winner !== null ? rounds[side].target : null}
                  disabled={!looking}
                  testId={`sagasu-duel-${side}`}
                />
              ) : null}
              {frozen.current[side] > 0 && <div className="sagasu-freeze">おてつき！</div>}
            </div>
          </div>
        </Half>
      ))}
      <Scores score={score} />
      <Notice data={notice} />
      {over !== null && (
        <Result
          title={(side) => (side === over ? 'かち！ みつけ めいじん' : 'おしい！')}
          sub={(side) => `${score[side]} たい ${score[side === 0 ? 1 : 0]}`}
          face={(side) => (side === over ? 'ok' : 'oops')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}
