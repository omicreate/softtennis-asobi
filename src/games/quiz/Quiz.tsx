/**
 * ピクルくんクイズ早押し。上下それぞれに、その人のレベルの問題が同時に出る（同じレベルなら同じ問題）。
 * 先に正しく押した人が1点（押した時刻にレベルごとの遅れを足して比べる）。5点先取。
 */
import { useEffect, useRef, useState } from 'react'
import { decide } from '../../core/buzzer'
import type { Press } from '../../core/buzzer'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak, stopSpeaking } from '../../core/speak'
import { PHRASES } from '../../core/voiceLines'
import { Half } from '../../core/Stage'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { PikuruCut } from '../../ui/pikuruArt'
import { usePlay } from '../../shell/playContext'
import { Pic } from './pics'
import { pickRound } from './pick'
import type { Asked } from './pick'
import './quiz.css'

const TARGET = 5
const MAX_ROUNDS = 10
const TIMEOUT = 25000

type Phase = 'intro' | 'go' | 'result' | 'over'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

/** 読み上げる文（問題と、並んでいる順の選択肢） */
const speech = (a: Asked) => [a.q.prompt, ...a.choices.map((c) => c.text)]

/** 出した問題（アプリを開いているあいだ覚えておき、「もういちど」でも同じ問題が続かないように） */
const ASKED = new Set<string>()

export function Quiz({ levels, paused, onRestart }: Props) {
  const play = usePlay()
  const delays: [number, number] = [LEVEL_INFO[levels[0]].pressDelay, LEVEL_INFO[levels[1]].pressDelay]
  const used = useRef(ASKED)
  const [roundNo, setRoundNo] = useState(1)
  const [asked, setAsked] = useState<[Asked, Asked]>(() => pickRound(levels, used.current))
  const [phase, setPhase] = useState<Phase>('intro')
  const [presses, setPresses] = useState<Press[]>([])
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'だい 1もん', big: false, face: 'think' })
  const [roundWinner, setRoundWinner] = useState<Side | null>(null)
  const pressRef = useRef<Press[]>([])
  const t = useRef(0)
  const goAt = useRef(0)

  // こども向けの問題は読み上げる（同じ問題なら1回だけ）
  useEffect(() => {
    if (phase !== 'go') return
    const kids = asked.filter((a) => a.q.level === 'kids')
    if (kids.length) speak(speech(kids[0]))
    return () => stopSpeaking()
  }, [phase, asked])

  const next = () => {
    if (phase !== 'result') return
    const over = Math.max(...score) >= TARGET || roundNo >= MAX_ROUNDS
    if (over) {
      setPhase('over')
      play.finish({ winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1 })
      sfx.fanfare()
      speak(score[0] === score[1] ? PHRASES.draw : score[0] > score[1] ? PHRASES.win0 : PHRASES.win1)
      return
    }
    setRoundNo((n) => n + 1)
    setAsked(pickRound(levels, used.current))
    pressRef.current = []
    setPresses([])
    setRoundWinner(null)
    setNotice({ title: `だい ${roundNo + 1}もん`, face: 'think' })
    t.current = 0
    setPhase('intro')
  }

  useFrame((dt, now) => {
    // 止めている間は、出題からの時間を進めない
    if (paused) {
      goAt.current += dt * 1000
      return
    }
    t.current += dt
    if (phase === 'intro' && t.current > 1.1) {
      setNotice(null)
      goAt.current = now
      setPhase('go')
    } else if (phase === 'go') {
      const d = decide(pressRef.current, now - goAt.current, delays, TIMEOUT)
      if (d.done) finish(d.winner)
    } else if (phase === 'result' && t.current > 6) {
      next()
    }
  })

  const finish = (w: Side | null) => {
    t.current = 0
    setRoundWinner(w)
    setPhase('result')
    stopSpeaking()
    // こども向けの問題なら、答えの説明も読み上げる
    const kidsSide = ([0, 1] as Side[]).find((s) => asked[s].q.level === 'kids')
    if (kidsSide !== undefined) speak([w === kidsSide ? PHRASES.correct : PHRASES.miss, asked[kidsSide].q.explain])
    if (w === null) {
      sfx.ng()
      return
    }
    sfx.ok()
    setScore((s) => {
      const n: [number, number] = [s[0], s[1]]
      n[w] += 1
      return n
    })
  }

  const answer = (side: Side, choiceId: string) => {
    unlockAudio()
    if (phase !== 'go' || pressRef.current.some((p) => p.side === side)) return
    const correct = choiceId === asked[side].q.answerId
    if (!correct) sfx.ng()
    else sfx.pop(0.6)
    pressRef.current = [...pressRef.current, { side, at: performance.now() - goAt.current, correct, choiceId }]
    setPresses(pressRef.current)
  }

  const winner = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1

  return (
    <div className="quiz">
      {([1, 0] as Side[]).map((side) => {
        const a = asked[side]
        const mine = presses.find((p) => p.side === side)
        const reveal = phase === 'result'
        const kids = a.q.level === 'kids'
        return (
          <Half key={side} side={side} className={`quiz-half quiz-side-${side}`}>
            <div className="quiz-card" data-kids={kids || undefined}>
              <div className="quiz-prompt">
                <PikuruCut art={reveal ? (roundWinner === side ? 'ok' : 'oops') : 'think'} height={58} className="quiz-host" />
                {kids && (
                  <button className="quiz-speak" aria-label="もんだいを よみあげる" onClick={() => speak(speech(a))}>
                    🗣️
                  </button>
                )}
                <span>{phase === 'intro' ? '…' : a.q.prompt}</span>
              </div>
              <div className={`quiz-choices ${kids ? 'quiz-choices-pics' : ''}`} data-count={a.choices.length}>
                {a.choices.map((c) => {
                  const isAnswer = c.id === a.q.answerId
                  const state = reveal && isAnswer ? 'answer' : mine?.choiceId === c.id ? (mine.correct ? 'right' : 'wrong') : undefined
                  return (
                    <button
                      key={c.id}
                      className="quiz-choice"
                      data-state={state}
                      disabled={phase !== 'go' || !!mine}
                      onPointerDown={() => answer(side, c.id)}
                    >
                      {c.pic && <Pic id={c.pic} />}
                      <span className="quiz-choice-text">{c.text}</span>
                    </button>
                  )
                })}
              </div>
              {reveal && (
                <div className="quiz-explain">
                  <PikuruCut art={roundWinner === side ? 'ok' : mine && !mine.correct ? 'oops' : 'eh'} height={64} />
                  <div>
                    <div className="quiz-explain-head">{roundWinner === side ? 'せいかい！ 1てん' : roundWinner === null ? 'こんどは ひきわけ' : mine?.correct ? 'せいかい！ でも おしい' : 'ざんねん'}</div>
                    <div className="quiz-explain-body">{a.q.explain}</div>
                  </div>
                  <button className="btn btn-small btn-go" onClick={next}>
                    つぎへ
                  </button>
                </div>
              )}
            </div>
          </Half>
        )
      })}
      <Scores score={score} />
      {phase === 'intro' && <Notice data={notice} />}
      {phase === 'over' && (
        <Result
          title={(side) => (winner === null ? 'ひきわけ！' : side === winner ? 'かち！ ものしりだね' : 'おしい！')}
          sub={(side) => `${score[side]} たい ${score[other(side)]}`}
          face={(side) => (winner === null || side === winner ? 'ok' : 'oops')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}
