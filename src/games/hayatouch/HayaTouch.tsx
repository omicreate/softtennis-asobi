/**
 * はやタッチ／ラインジャッジ。上下それぞれに、その人のレベルのお題が同時に出る。
 * ちびっこ・キッズ：ボールが みどりに光ったらタッチ（オレンジはフェイント）
 * おとな・せんしゅ：ライン際の球のあとを見て、イン／アウトを押す
 */
import { useMemo, useRef, useState } from 'react'
import { decide } from '../../core/buzzer'
import type { Press } from '../../core/buzzer'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { PHRASES } from '../../core/voiceLines'
import { Half } from '../../core/Stage'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import type { Face } from '../../ui/Hawk'
import { HawkCut } from '../../ui/hawkArt'
import { usePlay } from '../../shell/playContext'
import { LineView } from './LineView'
import { makeLineCase } from './lineJudge'
import type { LineCase } from './lineJudge'
import './hayatouch.css'

const TARGET = 5
const TIMEOUT = 6000

type Phase = 'intro' | 'wait' | 'go' | 'result' | 'over'

interface Round {
  /** GO までの待ち（秒） */
  wait: number
  /** フェイント（オレンジ）を出す時刻と長さ（秒）。出さないなら null */
  feint: { at: number; len: number } | null
  cases: [LineCase | null, LineCase | null]
}

function newRound(levels: [Level, Level]): Round {
  const task = levels.map((l) => LEVEL_INFO[l].task)
  const wait = 1.6 + Math.random() * 2.2
  const anyFlash = task.includes('flash')
  const feint = anyFlash && Math.random() < 0.35 ? { at: 0.5 + Math.random() * (wait - 1.3), len: 0.75 } : null
  // 同じレベルの2人には同じお題を出す
  const hard = (l: Level) => l === 'senshu'
  const c0 = task[0] === 'line' ? makeLineCase(hard(levels[0])) : null
  const c1 = task[1] === 'line' ? (c0 && levels[0] === levels[1] ? c0 : makeLineCase(hard(levels[1]))) : null
  return { wait, feint, cases: [c0, c1] }
}

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

export function HayaTouch({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  /** 終わりを1回だけ知らせる（次の描画の前にもう一度呼ばれても数えない） */
  const finished = useRef(false)
  const delays: [number, number] = [LEVEL_INFO[levels[0]].pressDelay, LEVEL_INFO[levels[1]].pressDelay]
  const tasks = useMemo(() => [LEVEL_INFO[levels[0]].task, LEVEL_INFO[levels[1]].task] as const, [levels])

  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState<Round>(() => newRound(levels))
  const [feintOn, setFeintOn] = useState(false)
  const [presses, setPresses] = useState<Press[]>([])
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'よーい', big: true })
  const [winner, setWinner] = useState<Side | null>(null)

  const t = useRef(0)
  const goAt = useRef(0)
  const pressRef = useRef<Press[]>([])

  const startRound = () => {
    setRound(newRound(levels))
    pressRef.current = []
    setPresses([])
    setFeintOn(false)
    setNotice(null)
    t.current = 0
    setPhase('wait')
  }

  useFrame((dt, now) => {
    // 止めている間は、合図からの時間を進めない
    if (paused) {
      goAt.current += dt * 1000
      return
    }
    t.current += dt
    switch (phase) {
      case 'intro':
        if (t.current > 1.2) startRound()
        break
      case 'wait': {
        const f = round.feint
        const on = !!f && t.current >= f.at && t.current < f.at + f.len
        if (on !== feintOn) setFeintOn(on)
        // 2人ともお手つきなら、このラウンドはやり直し
        if (pressRef.current.length >= 2) {
          setNotice({ title: 'ふたりとも おてつき', sub: 'もういちど', face: 'eh' })
          t.current = -0.6
          setPhase('result')
          break
        }
        if (t.current >= round.wait) {
          goAt.current = now
          sfx.go()
          setFeintOn(false)
          setPhase('go')
        }
        break
      }
      case 'go': {
        const d = decide(pressRef.current, now - goAt.current, delays, TIMEOUT)
        if (d.done) finishRound(d.winner)
        break
      }
      case 'result':
        if (t.current > 2.2) {
          if (winner !== null) {
            setPhase('over')
            if (!finished.current) play.finish({ winner })
            finished.current = true
            sfx.fanfare()
            speak(winner === 0 ? PHRASES.win0 : PHRASES.win1)
          } else {
            startRound()
          }
        }
        break
    }
  })

  const finishRound = (w: Side | null) => {
    t.current = 0
    setPhase('result')
    if (w === null) {
      sfx.ng()
      setNotice({ title: 'こんどは ひきわけ', sub: 'つぎの もんだいへ', face: 'eh' })
      return
    }
    sfx.ok()
    const next: [number, number] = [score[0], score[1]]
    next[w] += 1
    setScore(next)
    const faces: NoticeData['faces'] = [undefined, undefined]
    faces[w] = 'ok'
    faces[other(w)] = 'oops'
    setNotice({ title: `${w === 0 ? 'オレンジ' : 'あお'}の てん！`, faces })
    if (next[w] >= TARGET) setWinner(w)
  }

  const press = (side: Side, answer?: 'in' | 'out') => {
    unlockAudio()
    if (pressRef.current.some((p) => p.side === side)) return
    if (phase === 'wait') {
      // 合図の前に押した＝お手つき
      if (tasks[side] !== 'flash') return
      sfx.ng()
      pressRef.current = [...pressRef.current, { side, at: -1, correct: false }]
      setPresses(pressRef.current)
      return
    }
    if (phase !== 'go') return
    const at = performance.now() - goAt.current
    const c = round.cases[side]
    const correct = tasks[side] === 'flash' ? true : !!c && c.answer === answer
    if (correct) sfx.pop(0.6)
    else sfx.ng()
    pressRef.current = [...pressRef.current, { side, at, correct }]
    setPresses(pressRef.current)
  }

  return (
    <div className="haya" data-phase={phase}>
      {([1, 0] as Side[]).map((side) => {
        const mine = presses.find((p) => p.side === side)
        const c = round.cases[side]
        return (
          <Half key={side} side={side} className={`haya-half haya-side-${side}`}>
            {tasks[side] === 'flash' ? (
              <FlashPad
                state={mine && !mine.correct ? 'locked' : mine ? 'done' : phase === 'go' ? 'go' : phase === 'wait' && feintOn ? 'feint' : 'wait'}
                onPress={() => press(side)}
              />
            ) : (
              <LinePad c={c} phase={phase} chosen={mine} onAnswer={(a) => press(side, a)} />
            )}
          </Half>
        )
      })}
      <Scores score={score} />
      {phase !== 'over' && <Notice data={notice} />}
      {phase === 'over' && winner !== null && (
        <Result
          title={(side) => (side === winner ? 'かち！ はやかったね' : 'おしい！')}
          sub={(side) => `${score[side]} たい ${score[other(side)]}`}
          face={(side) => (side === winner ? 'ok' : 'oops')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

type FlashState = 'wait' | 'feint' | 'go' | 'done' | 'locked'

const FLASH_TEXT: Record<FlashState, string> = {
  wait: 'みどりに なったら タッチ',
  feint: 'まだだよ！',
  go: 'タッチ！',
  done: 'タッチ した！',
  locked: 'おてつき…',
}

/** 合図をするホークアイ先生の表情 */
const FLASH_FACE: Record<FlashState, Face> = { wait: 'think', feint: 'eh', go: 'ok', done: 'ok', locked: 'oops' }

function FlashPad({ state, onPress }: { state: FlashState; onPress: () => void }) {
  return (
    <button className="flash-pad" data-state={state} onPointerDown={onPress} aria-label={FLASH_TEXT[state]}>
      <HawkCut art={FLASH_FACE[state]} height={96} className="flash-sensei" />
      <span className="flash-ball" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="flash-text">{FLASH_TEXT[state]}</span>
    </button>
  )
}

function LinePad({ c, phase, chosen, onAnswer }: { c: LineCase | null; phase: Phase; chosen?: Press; onAnswer: (a: 'in' | 'out') => void }) {
  const show = phase === 'go' || phase === 'result'
  if (!c || !show) {
    return (
      <div className="line-pad line-pad-wait">
        <HawkCut art={phase === 'result' ? 'ok' : 'think'} height={110} />
        <div className="line-wait-text">ライン ジャッジ</div>
        <div className="line-wait-sub">ボールの あとを みて、イン？ アウト？</div>
      </div>
    )
  }
  const reveal = phase === 'result'
  return (
    <div className="line-pad">
      <div className="line-scene">
        <span className="line-chip">{c.scene}</span>
        {c.line}
      </div>
      <LineView c={c} />
      {reveal ? (
        <div className="line-explain">
          こたえ：<b>{c.answer === 'in' ? 'イン' : 'アウト'}</b>　{c.explain}
        </div>
      ) : (
        <div className="line-buttons">
          {(['in', 'out'] as const).map((a) => (
            <button key={a} className="btn line-btn" data-answer={a} disabled={!!chosen} aria-pressed={chosen ? undefined : false} onPointerDown={() => onAnswer(a)}>
              {a === 'in' ? 'イン' : 'アウト'}
            </button>
          ))}
        </div>
      )}
      {chosen && !reveal && <div className="line-mark">{chosen.correct ? '○ せいかい' : '× ちがうよ'}</div>}
    </div>
  )
}
