/**
 * ラリーの画面。次の4つで使う：
 *   versus …… ラリーたいけつ（2人）／ピクルくんとラリー（cpu＝上はピクルくん）
 *   target …… ねらって ストローク（ひとりで。上はボールマシン）
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
import { Hawk } from '../../ui/Hawk'
import type { Face } from '../../ui/Hawk'
import { HawkCut } from '../../ui/hawkArt'
import { mulberry32 } from '../../core/rng'
import { usePlay } from '../../shell/playContext'
import { Cpu, CPU_SKILL } from './cpu'
import { drawRally, makeView, toWorld } from './draw'
import { RallyEngine } from './engine'
import type { Games, Kind, ShotMiss } from './engine'
import { REASON_TEXT } from './rules'
import type { RuleMode } from './rules'
import { SHOTS } from './targets'
import './rally.css'

interface Props {
  kind: Kind
  levels: [Level, Level]
  mode: RuleMode
  target: number
  games?: Games
  /** 上の人をホークアイ先生（コンピューター）にする */
  cpu?: boolean
  paused: boolean
  onRestart: () => void
}

const targetBest = (lv: Level) => `target-best-${lv}`

const MISS_TEXT: Record<ShotMiss, { title: string; sub: string }> = {
  zone: { title: 'おしい！', sub: 'まとの そとに おちたよ' },
  out: { title: 'アウト！', sub: 'コートの そとに でたよ' },
  'double-bounce': { title: 'ツーバウンズ！', sub: '2かい はねる まえに かえそう' },
}

export function RallyGame({ kind, levels, mode, target, games, cpu = false, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  // じゅんばんモード（ねらって ストローク）：みんな同じ球の並び
  const contest = kind === 'target' ? play.contest : undefined
  const solo = cpu || kind === 'target'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useMemo(
    () => new RallyEngine({ kind, mode, levels, target, games, cpu: cpu ? 1 : undefined, rand: contest ? mulberry32(contest.seed) : undefined }),
    [kind, mode, levels, target, games, cpu, contest],
  )
  const sensei = useMemo(() => (cpu ? new Cpu(1, CPU_SKILL[levels[1]]) : null), [cpu, levels])
  const view = useMemo(() => makeView(stage.w, stage.h, kind === 'target' ? 1.3 : 0), [stage.w, stage.h, kind])
  const pointers = useRef(new Map<number, Side>())
  const owner = useRef<[number | null, number | null]>([null, null])
  const noticeTimer = useRef(0)

  const [score, setScore] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>(null)
  const [phase, setPhase] = useState(engine.phase)
  const [server, setServer] = useState<Side>(0)
  const [call, setCall] = useState('')
  const [gamesWon, setGamesWon] = useState<[number, number]>([0, 0])
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

  const showLanding = levels.some((l) => LEVEL_INFO[l].assist > 0)
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
      sensei?.update(engine, dt)
      for (const ev of engine.step(dt)) {
        switch (ev.type) {
          case 'countdown':
            sfx.tick()
            flash({ title: String(ev.n), big: true }, 0.9)
            break
          case 'serve':
            setServer(ev.server)
            setCall(mode === 'real' && kind === 'versus' ? `${engine.serveNo === 2 ? 'セカンド　' : ''}${engine.scoreCall()}` : '')
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
          case 'fault': {
            // ファーストサービスのフォールト：点は動かず、セカンドサービス
            sfx.ng()
            const why = REASON_TEXT.fault
            flash({ title: why.kids, sub: mode === 'real' ? why.rule : undefined }, 1.4)
            react('eh')
            break
          }
          case 'point': {
            sfx.whistle()
            const why = REASON_TEXT[ev.fault.reason]
            const faces: [NoticeData['face'], NoticeData['face']] = [undefined, undefined]
            faces[ev.winner] = 'ok'
            faces[other(ev.winner)] = 'oops'
            const sub = mode === 'real' ? `${why.kids} ${why.rule}` : why.kids
            const title = ev.game ? `ゲーム！ ${name(ev.winner)}` : `${name(ev.winner)}の てん！`
            flash({ title, sub, faces }, 1.8)
            setScore([engine.score[0], engine.score[1]])
            setGamesWon([engine.gamesWon[0], engine.gamesWon[1]])
            if (cpu) react(ev.winner === 1 ? 'ok' : 'oops')
            // 審判：サービスの反則（ダブルフォールト・ダイレクト）は「えっ！？」、ふつうの得点は「！」
            else react(['double-fault', 'direct'].includes(ev.fault.reason) ? 'eh' : 'ok')
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
              speak(ev.winner === 0 ? PHRASES.youWin : PHRASES.senseiWin)
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
    if (ctx) drawRally(ctx, stage.w, stage.h, view, engine, { showLanding, realRules: mode === 'real' && kind === 'versus', solo, senseiFace: pkFace, paddles: play.paddles })
  })

  // 指
  const toCourt = (e: PointerEvent) => {
    const p = stage.toLogical(e.clientX, e.clientY)
    // ひとりのときは、どこを触っても自分（下）のラケット
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

  const again = () => onRestart()

  const showServeHint = phase === 'serve' && !over && kind !== 'target' && !(cpu && server === 1)
  /** ほんかくの複数ゲームのとき「1-0」のようにゲーム数を見せる */
  const gameText = mode === 'real' && kind === 'versus' && (games ?? 1) > 1 ? `${gamesWon[0]}-${gamesWon[1]}` : ''

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
        <div className="umpire" aria-label="しんぱんの ホークアイ先生">
          <HawkCut art={pkFace} height={Math.round(Math.min(96, stage.w * 0.2))} />
        </div>
      )}
      {kind === 'target' && (
        <>
          <div className="solo-banner" aria-live="polite">
            <Hawk face="think" size={40} />
            <span>{shots.label || 'ボールマシンから ボールが くるよ'}</span>
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
        <div className="solo-score" aria-label={`あなた ${score[0]}てん、ホークアイ先生 ${score[1]}てん${gameText ? `、ゲーム ${gameText}` : ''}`}>
          <span>あなた</span>
          <span className="solo-score-main">
            {score[0]} - {score[1]}
          </span>
          <span>せんせい</span>
          {gameText && <span className="solo-score-games">ゲーム {gameText}</span>}
        </div>
      )}
      {kind === 'versus' && !cpu && <Scores score={score} games={gameText ? gamesWon : undefined} />}
      {showServeHint && <ServeHint side={server} level={levels[server]} call={call} />}
      <Notice data={notice} />
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
          title={() => (over.winner === 0 ? 'かち！ ホークアイ先生に かったね' : 'ホークアイ先生の かち！')}
          sub={() => (gameText ? `ゲーム ${gameText}（あなた たい せんせい）` : `あなた ${score[0]} たい ${score[1]} せんせい`)}
          face={() => (over.winner === 0 ? 'oops' : 'ok')}
          onAgain={again}
        />
      )}
      {over && kind === 'versus' && !cpu && (
        <Result
          title={(side) => (side === over.winner ? 'かち！ やったね' : 'おしい！')}
          sub={(side) => (gameText ? `ゲーム ${gamesWon[side]} たい ${gamesWon[other(side)]}` : `${score[side]} たい ${score[other(side)]}`)}
          face={(side) => (side === over.winner ? 'ok' : 'oops')}
          onAgain={again}
        />
      )}
    </div>
  )
}

function ServeHint({ side, level, call }: { side: Side; level: Level; call: string }) {
  const auto = LEVEL_INFO[level].keepIn
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
        {auto ? 'うえに シュッ！で サービス（まってもOK）' : 'うえに シュッ！と ふって サービス'}
      </div>
    </Half>
  )
}
