/**
 * ラリーの画面。次の4つで使う：
 *   versus …… ラリーたいけつ（2人）／ピクルくんとラリー（cpu＝上はピクルくん）
 *   dink …… ディンクでつなごう（2人で協力）
 *   target …… ねらってショット（ひとりで。上はボールマシン）
 * 2人で遊ぶときは、指を置いた場所（上半分か下半分か）で持ち主を決める。ひとりのときは、どの指も下の人。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO, SIDE_NAME, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { PHRASES } from '../../core/voiceLines'
import { Half, useStage } from '../../core/Stage'
import { load, save } from '../../core/storage'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { Pikuru } from '../../ui/Pikuru'
import type { Face } from '../../ui/Pikuru'
import { PikuruCut } from '../../ui/pikuruArt'
import { mulberry32 } from '../../core/rng'
import { usePlay } from '../../shell/playContext'
import { Cpu, CPU_SKILL } from './cpu'
import { drawRally, makeView, toWorld } from './draw'
import { RallyEngine } from './engine'
import type { Kind, Scoring, ShotMiss } from './engine'
import { REASON_TEXT } from './rules'
import type { RuleMode } from './rules'
import { SHOTS } from './targets'
import './rally.css'

interface Props {
  kind: Kind
  levels: [Level, Level]
  mode: RuleMode
  target: number
  scoring?: Scoring
  /** 上の人をピクルくん（コンピューター）にする */
  cpu?: boolean
  paused: boolean
  onRestart: () => void
}

const DINK_BEST = 'dink-best'
const targetBest = (lv: Level) => `target-best-${lv}`

const MISS_TEXT: Record<ShotMiss, { title: string; sub: string }> = {
  zone: { title: 'おしい！', sub: 'まとの そとに おちたよ' },
  out: { title: 'アウト！', sub: 'コートの そとに でたよ' },
  'double-bounce': { title: '2かい はねた！', sub: '2かい はねる まえに かえそう' },
  'two-bounce': { title: '2バウンドルール！', sub: '3きゅうめは 1かい はねてから うつ' },
}

export function RallyGame({ kind, levels, mode, target, scoring, cpu = false, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  // じゅんばんモード（ねらってショット）：みんな同じ球の並び
  const contest = kind === 'target' ? play.contest : undefined
  const solo = cpu || kind === 'target'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useMemo(
    () => new RallyEngine({ kind, mode, levels, target, scoring, cpu: cpu ? 1 : undefined, rand: contest ? mulberry32(contest.seed) : undefined }),
    [kind, mode, levels, target, scoring, cpu, contest],
  )
  const pikuru = useMemo(() => (cpu ? new Cpu(1, CPU_SKILL[levels[1]]) : null), [cpu, levels])
  const view = useMemo(() => makeView(stage.w, stage.h, kind === 'target' ? 1.3 : 0), [stage.w, stage.h, kind])
  const pointers = useRef(new Map<number, Side>())
  const owner = useRef<[number | null, number | null]>([null, null])
  const noticeTimer = useRef(0)

  const [score, setScore] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>(null)
  const [phase, setPhase] = useState(engine.phase)
  const [server, setServer] = useState<Side>(0)
  const [call, setCall] = useState('')
  const [dink, setDink] = useState({ count: 0, best: load<number>(DINK_BEST, 0) })
  const [shots, setShots] = useState({ index: 0, hits: 0, label: '', best: load<number>(targetBest(levels[0]), 0) })
  const [over, setOver] = useState<{ winner: Side | null } | null>(null)
  /** ピクルくん（審判・相手・マシンの係）の表情。しばらくすると「かんがえる」に戻る */
  const [pkFace, setPkFace] = useState<Face>('think')
  const pkTimer = useRef(0)
  const react = (face: Face, seconds = 1.8) => {
    setPkFace(face)
    pkTimer.current = seconds
  }
  /** 審判のピクルくんを出すか（2人で遊ぶラリーとディンク） */
  const umpire = !solo

  const showLanding = levels.some((l) => LEVEL_INFO[l].assist > 0) || kind === 'dink'
  /** 得点した側の名前（ひとりのときは「あなた」と「ピクルくん」） */
  const name = (s: Side) => (cpu ? (s === 0 ? 'あなた' : 'ピクルくん') : SIDE_NAME[s])

  // 開発中とテスト（Playwright）だけ、進行を外から見られるようにする
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __rally?: RallyEngine }).__rally = engine
  }, [engine])

  // canvas の大きさ（高精細の画面でもぼやけないように）
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    c.width = Math.round(stage.w * dpr)
    c.height = Math.round(stage.h * dpr)
    c.style.width = `${stage.w}px`
    c.style.height = `${stage.h}px`
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [stage.w, stage.h])

  /** 知らせを出す。ひとりのときは自分の側だけ（向きを回さない） */
  const flash = (data: NoticeData, seconds: number) => {
    setNotice(solo ? { ...data, only: 0, faces: undefined, face: data.faces?.[0] ?? data.face } : data)
    noticeTimer.current = seconds
  }

  useFrame((dt) => {
    if (!paused) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      if (pkTimer.current > 0) {
        pkTimer.current -= dt
        if (pkTimer.current <= 0) setPkFace('think')
      }
      pikuru?.update(engine, dt)
      for (const ev of engine.step(dt)) {
        switch (ev.type) {
          case 'countdown':
            sfx.tick()
            flash({ title: String(ev.n), big: true }, 0.9)
            break
          case 'serve':
            setServer(ev.server)
            setCall(engine.sideout() ? engine.scoreCall() : '')
            if (kind === 'versus') sfx.go()
            break
          case 'feed':
            setShots((s) => ({ ...s, index: ev.index, label: ev.zone.label }))
            break
          case 'hit':
            sfx.pop(ev.power)
            break
          case 'bounce':
            sfx.bounce()
            break
          case 'point': {
            sfx.whistle()
            const why = REASON_TEXT[ev.fault.reason]
            const faces: [NoticeData['face'], NoticeData['face']] = [undefined, undefined]
            faces[ev.winner] = 'ok'
            faces[other(ev.winner)] = 'oops'
            const sub = mode === 'real' ? `${why.kids} ${why.rule}` : why.kids
            // サイドアウト：レシーブ側が勝っても点は入らず、サーブが移るだけ
            const title = ev.scored ? `${name(ev.winner)}の てん！` : `サイドアウト！ ${name(ev.winner)}の サーブ`
            flash({ title, sub, faces }, 1.8)
            setScore([engine.score[0], engine.score[1]])
            if (cpu) react(ev.winner === 1 ? 'ok' : 'oops')
            // 審判：反則（キッチン・2バウンド・サーブ）は「えっ！？」、ふつうの得点は「！」
            else react(['kitchen-volley', 'two-bounce', 'serve-kitchen', 'serve-wrong-court'].includes(ev.fault.reason) ? 'eh' : 'ok')
            break
          }
          case 'shot':
            if (ev.ok) {
              sfx.ok()
              flash({ title: 'ナイス！', sub: 'ねらいどおり', face: 'ok' }, 1.3)
              speak(PHRASES.nice)
              react('ok', 1.3)
            } else {
              sfx.ng()
              const m = MISS_TEXT[ev.reason ?? 'zone']
              flash({ title: m.title, sub: m.sub, face: 'oops' }, 1.3)
              react('oops', 1.3)
            }
            setShots((s) => ({ ...s, hits: ev.hits }))
            break
          case 'dink':
            if (ev.ok) {
              sfx.ok()
              react('ok', 0.8)
            } else {
              flash({ title: 'つよすぎ！', sub: 'そっと ポンで キッチンへ', face: 'eh' }, 1.3)
              speak(PHRASES.tooStrong)
              react('eh')
            }
            setDink((d) => ({ ...d, count: ev.count }))
            break
          case 'dink-end': {
            sfx.ng()
            setNotice(null)
            react('oops', 99)
            play.finish({ value: ev.count })
            setDink((d) => {
              const best = Math.max(d.best, ev.count)
              save(DINK_BEST, best)
              if (ev.count > 0 && ev.count > d.best) speak(PHRASES.great)
              return { count: ev.count, best }
            })
            setOver({ winner: null })
            break
          }
          case 'over':
            sfx.fanfare()
            setNotice(null)
            play.finish(kind === 'target' ? { value: engine.hits } : { winner: ev.winner })
            if (contest) {
              setOver({ winner: ev.winner })
              break
            }
            if (kind === 'target') {
              setShots((s) => {
                const best = Math.max(s.best, engine.hits)
                save(targetBest(levels[0]), best)
                if (engine.hits > s.best) speak(PHRASES.great)
                return { ...s, hits: engine.hits, best }
              })
            } else if (cpu) {
              speak(ev.winner === 0 ? PHRASES.youWin : PHRASES.pikuruWin)
            } else if (ev.winner !== null) {
              speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            }
            setOver({ winner: ev.winner })
            break
        }
      }
      if (engine.phase !== phase) setPhase(engine.phase)
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawRally(ctx, stage.w, stage.h, view, engine, { showLanding, realRules: mode === 'real' && kind === 'versus', solo, pikuruFace: pkFace, paddles: play.paddles })
  })

  // 指
  const toCourt = (e: PointerEvent) => {
    const p = stage.toLogical(e.clientX, e.clientY)
    // ひとりのときは、どこを触っても自分（下）のパドル
    const side: Side = solo ? 0 : p.y < stage.h / 2 ? 1 : 0
    return { side, ...toWorld(view, p.x, p.y) }
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 指を捕まえられなくても動く（canvas の外に出た指を追えないだけ）
    }
    const { side, x, y } = toCourt(e)
    pointers.current.set(e.pointerId, side)
    owner.current[side] = e.pointerId
    engine.setFinger(side, true, x, y)
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId)
    if (side === undefined || owner.current[side] !== e.pointerId) return
    const { x, y } = toCourt(e)
    engine.setFinger(side, true, x, y)
  }
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (side === undefined || owner.current[side] !== e.pointerId) return
    owner.current[side] = null
    engine.setFinger(side, false, 0, 0)
  }

  const again = () => {
    if (kind === 'dink') {
      setOver(null)
      setDink((d) => ({ ...d, count: 0 }))
      engine.restartDink()
      setPhase(engine.phase)
      react('think', 0)
    } else {
      onRestart()
    }
  }

  const showServeHint = phase === 'serve' && !over && kind !== 'target' && !(cpu && server === 1)

  return (
    <div className="rally" data-kind={kind} data-phase={phase} data-solo={solo || undefined}>
      <canvas
        ref={canvasRef}
        className="rally-canvas"
        data-testid="rally-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {umpire && (
        <div className="umpire" aria-label="しんぱんの ピクルくん">
          <PikuruCut art={pkFace} height={Math.round(Math.min(96, stage.w * 0.2))} />
        </div>
      )}
      {kind === 'target' && (
        <>
          <div className="solo-banner" aria-live="polite">
            <Pikuru face="think" size={40} />
            <span>{shots.label || 'ピクルマシンから ボールが くるよ'}</span>
          </div>
          <div className="solo-score">
            <span>
              {Math.min(shots.index + 1, SHOTS)} / {SHOTS} きゅう
            </span>
            <span className="solo-score-main">まと {shots.hits}</span>
          </div>
        </>
      )}
      {kind === 'versus' && cpu && (
        <div className="solo-score" aria-label={`あなた ${score[0]}てん、ピクルくん ${score[1]}てん`}>
          <span>あなた</span>
          <span className="solo-score-main">
            {score[0]} - {score[1]}
          </span>
          <span>ピクルくん</span>
        </div>
      )}
      {kind === 'versus' && !cpu && <Scores score={score} />}
      {kind === 'dink' && <DinkCount count={dink.count} best={dink.best} />}
      {showServeHint && <ServeHint side={kind === 'dink' ? 0 : server} kind={kind} level={levels[kind === 'dink' ? 0 : server]} call={call} />}
      <Notice data={notice} />
      {over && kind === 'dink' && (
        <Result
          title={() => `${dink.count}かい つづいた！`}
          sub={() => (dink.count >= dink.best && dink.count > 0 ? 'さいこう きろく！' : `さいこうは ${dink.best}かい`)}
          face={() => (dink.count >= dink.best && dink.count > 0 ? 'ok' : 'eh')}
          onAgain={again}
        />
      )}
      {over && kind === 'target' && !contest && (
        <Result
          single
          title={() => `${SHOTS}きゅう中 ${shots.hits}きゅう まとに はいった！`}
          sub={() => (shots.hits >= shots.best && shots.hits > 0 ? 'さいこう きろく！' : `さいこうは ${shots.best}きゅう（${LEVEL_INFO[levels[0]].label}）`)}
          face={() => (shots.hits >= SHOTS / 2 ? 'ok' : 'eh')}
          onAgain={again}
        />
      )}
      {over && kind === 'versus' && cpu && (
        <Result
          single
          title={() => (over.winner === 0 ? 'かち！ ピクルくんに かったね' : 'ピクルくんの かち！')}
          sub={() => `あなた ${score[0]} たい ${score[1]} ピクルくん`}
          face={() => (over.winner === 0 ? 'oops' : 'ok')}
          onAgain={again}
        />
      )}
      {over && kind === 'versus' && !cpu && (
        <Result
          title={(side) => (side === over.winner ? 'かち！ やったね' : 'おしい！')}
          sub={(side) => `${score[side]} たい ${score[other(side)]}`}
          face={(side) => (side === over.winner ? 'ok' : 'oops')}
          onAgain={again}
        />
      )}
    </div>
  )
}

function DinkCount({ count, best }: { count: number; best: number }) {
  return (
    <>
      {([1, 0] as Side[]).map((side) => (
        <Half key={side} side={side} interactive={false}>
          <div className="dink-count" aria-live="polite">
            <span className="dink-num">{count}</span>
            <span className="dink-label">かい</span>
            <span className="dink-best">さいこう {best}</span>
          </div>
        </Half>
      ))}
    </>
  )
}

function ServeHint({ side, kind, level, call }: { side: Side; kind: Kind; level: Level; call: string }) {
  const auto = kind === 'dink' || LEVEL_INFO[level].keepIn
  return (
    <Half side={side} interactive={false}>
      <div className="serve-hint">
        {call && (
          <span className="serve-call" aria-label={`スコアの コール ${call}`}>
            {call}
          </span>
        )}
        <span className="serve-arrow" aria-hidden>
          ⬆
        </span>
        {kind === 'dink' ? 'ゆっくり ポンと つなごう' : auto ? 'うえに シュッ！で サーブ（まってもOK）' : 'うえに シュッ！と ふって サーブ'}
      </div>
    </Half>
  )
}
