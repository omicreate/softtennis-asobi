/**
 * ピクルくずし（ブロック崩し）の画面。
 * two=false：ひとりで（手に持って遊ぶので画面は回さない）。どこを触ってもパドルが動く。
 * two=true：ふたりで（机に置いて上下で向かい合う）。指を置いた場所で持ち主を決める。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO, SIDE_COLOR, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { useStage } from '../../core/Stage'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { BALL_R, createBreakout, FIELD_W, launch, movePaddle, stepBreakout, STAGES } from './breakout'
import { drawPaddleArt } from '../../ui/paddleArt'
import type { PaddleLook } from '../../ui/paddleArt'
import type { Face } from '../../ui/Pikuru'
import { PikuruCut } from '../../ui/pikuruArt'
import type { BreakoutState } from './breakout'
import { usePlay } from '../../shell/playContext'
import './breakout.css'

interface Props {
  two: boolean
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `breakout-best-${lv}`
/** じゅんばんモード：ひとり60秒で点を比べる */
export const BREAKOUT_CONTEST_TIME = 60
/** ひとりのとき、上に点数などを出す分の高さ（px） */
const HUD = 56

export function BreakoutGame({ two, levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const contest = !two && !!play.contest
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<BreakoutState>(() => createBreakout(levels, two, contest ? BREAKOUT_CONTEST_TIME : undefined), [levels, two, contest])
  const pointers = useRef(new Map<number, Side>())
  const noticeTimer = useRef(0)
  const [hud, setHud] = useState({ score: [0, 0] as [number, number], lives: game.lives, stage: 0, time: Math.ceil(game.timeLeft) })
  const [notice, setNotice] = useState<NoticeData | null>(null)
  const [over, setOver] = useState<{ winner: Side | null; best: number } | null>(null)
  /** 応援するピクルくんの表情（しばらくすると「かんがえる」に戻る） */
  const [pkFace, setPkFace] = useState<Face>('think')
  const pkTimer = useRef(0)
  const react = (face: Face, seconds: number) => {
    setPkFace(face)
    pkTimer.current = seconds
  }

  // 場（幅100）を画面に合わせる
  const view = useMemo(() => {
    const top = two ? 8 : HUD
    const scale = Math.min((stage.w - 16) / FIELD_W, (stage.h - top - 8) / game.H)
    return { scale, ox: (stage.w - FIELD_W * scale) / 2, oy: top + (stage.h - top - 8 - game.H * scale) / 2 }
  }, [stage.w, stage.h, two, game.H])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __breakout?: BreakoutState }).__breakout = game
  }, [game])

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

  const flash = (data: NoticeData, seconds: number) => {
    setNotice(two ? data : { ...data, only: 0 })
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
      for (const ev of stepBreakout(game, dt)) {
        switch (ev.type) {
          case 'paddle':
            sfx.pop(0.5)
            break
          case 'wall':
            sfx.bounce()
            break
          case 'brick':
            if (ev.broke) {
              sfx.tick()
              react('ok', 0.6)
            } else sfx.bounce()
            break
          case 'miss':
            sfx.ng()
            react('oops', 1.2)
            if (!two && ev.livesLeft > 0) flash({ title: 'おっと！', sub: `のこり ${ev.livesLeft}`, face: 'oops' }, 1.2)
            break
          case 'clear':
            sfx.fanfare()
            react('ok', 1.6)
            if (ev.stage + 1 < STAGES) flash({ title: `ステージ ${ev.stage + 1} クリア！`, sub: 'つぎは すこし はやいよ', face: 'ok' }, 1.6)
            break
          case 'over': {
            sfx.fanfare()
            setNotice(null)
            let best = 0
            play.finish(two ? { winner: ev.winner } : { value: game.score[0] })
            if (contest) {
              setOver({ winner: ev.winner, best })
              break
            }
            if (!two) {
              best = Math.max(load<number>(bestKey(levels[0]), 0), game.score[0])
              if (game.score[0] > load<number>(bestKey(levels[0]), 0)) speak(PHRASES.great)
              save(bestKey(levels[0]), best)
            } else if (ev.winner !== null) {
              speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            }
            setOver({ winner: ev.winner, best })
            break
          }
        }
      }
      const t = Math.ceil(game.timeLeft)
      if (game.score[0] !== hud.score[0] || game.score[1] !== hud.score[1] || game.lives !== hud.lives || game.stage !== hud.stage || t !== hud.time) {
        setHud({ score: [game.score[0], game.score[1]], lives: game.lives, stage: game.stage, time: t })
      }
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, view, game, two, play.paddles)
  })

  const toField = (e: PointerEvent) => {
    const p = stage.toLogical(e.clientX, e.clientY)
    const side: Side = two && p.y < stage.h / 2 ? 1 : 0
    return { side, x: (p.x - view.ox) / view.scale }
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 捕まえられなくても動く
    }
    const { side, x } = toField(e)
    pointers.current.set(e.pointerId, side)
    movePaddle(game, side, x)
    launch(game, side)
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId)
    if (side === undefined) return
    movePaddle(game, side, toField(e).x)
  }
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
  }

  return (
    <div className="breakout" data-two={two || undefined}>
      <canvas
        ref={canvasRef}
        className="breakout-canvas"
        data-testid="breakout-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {two ? (
        <>
          <Scores score={hud.score} />
          <div className="bo-timer" aria-label={`のこり ${hud.time}びょう`}>
            <PikuruCut art={pkFace} height={40} />
            <span>{hud.time}</span>
          </div>
        </>
      ) : (
        <div className="bo-hud">
          <span className="bo-lives" aria-label={`ライフ ${hud.lives}`}>
            {'❤️'.repeat(Math.max(0, hud.lives))}
          </span>
          <span className="bo-stage">{contest ? `のこり ${hud.time}びょう` : `ステージ ${Math.min(hud.stage + 1, STAGES)}/${STAGES}`}</span>
          <PikuruCut art={pkFace} height={46} className="bo-pikuru" />
          <span className="bo-score">{hud.score[0]}てん</span>
        </div>
      )}
      <Notice data={notice} />
      {over &&
        !contest &&
        (two ? (
          <Result
            title={(side) => (over.winner === null ? 'ひきわけ！' : side === over.winner ? 'かち！ やったね' : 'おしい！')}
            sub={(side) => `${hud.score[side]} たい ${hud.score[other(side)]}`}
            face={(side) => (over.winner === null || side === over.winner ? 'ok' : 'oops')}
            onAgain={onRestart}
          />
        ) : (
          <Result
            single
            title={() => (over.winner === 0 ? 'ぜんぶ くずした！' : `${hud.score[0]}てん！`)}
            sub={() => (hud.score[0] >= over.best && hud.score[0] > 0 ? 'さいこう きろく！' : `さいこうは ${over.best}てん（${LEVEL_INFO[levels[0]].label}）`)}
            face={() => (over.winner === 0 ? 'ok' : 'eh')}
            onAgain={onRestart}
          />
        ))}
    </div>
  )
}

interface View {
  scale: number
  ox: number
  oy: number
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** ピックルボール（穴あき） */
function pickleball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill = '#d4f03c') {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, r * 0.14)
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  for (const [dx, dy] of [
    [-0.35, -0.25],
    [0.3, -0.3],
    [0.05, 0.38],
  ]) {
    ctx.beginPath()
    ctx.arc(x + dx * r, y + dy * r, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: BreakoutState, two: boolean, looks: [PaddleLook, PaddleLook]) {
  const k = v.scale
  const X = (x: number) => v.ox + x * k
  const Y = (y: number) => v.oy + y * k
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  // 場（コートの色）
  rr(ctx, X(0), Y(0), FIELD_W * k, s.H * k, 12)
  ctx.fillStyle = '#2f5d9a'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()
  if (two) {
    // まんなかのネット
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(X(0), Y(s.H / 2) - 1, FIELD_W * k, 2)
  }

  // ブロック
  for (const b of s.bricks) {
    const x = X(b.x)
    const y = Y(b.y)
    const bw = b.w * k
    const bh = b.h * k
    if (b.kind === 'pickle') {
      // ピクルス（ピクルくんのなかま）：緑のつぶつぶと目。1回当てるとひびが入って「><」の目になる
      rr(ctx, x, y, bw, bh, bh / 2)
      ctx.fillStyle = b.hp >= 2 ? '#6bb33f' : '#9ccc6e'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#2e5a1c'
      ctx.stroke()
      ctx.fillStyle = 'rgba(46, 90, 28, 0.55)'
      for (const fx of [0.25, 0.5, 0.75]) {
        ctx.beginPath()
        ctx.arc(x + bw * fx, y + bh * (fx === 0.5 ? 0.35 : 0.62), Math.max(1, bh * 0.09), 0, Math.PI * 2)
        ctx.fill()
      }
      // 目
      const ey = y + bh * 0.42
      for (const ex of [x + bw * 0.4, x + bw * 0.6]) {
        if (b.hp >= 2) {
          ctx.beginPath()
          ctx.arc(ex, ey, Math.max(1.5, bh * 0.14), 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(ex + 0.6, ey, Math.max(1, bh * 0.07), 0, Math.PI * 2)
          ctx.fillStyle = '#12302b'
          ctx.fill()
        } else {
          ctx.strokeStyle = '#12302b'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(ex - bh * 0.1, ey - bh * 0.1)
          ctx.lineTo(ex + bh * 0.1, ey)
          ctx.lineTo(ex - bh * 0.1, ey + bh * 0.1)
          ctx.stroke()
        }
      }
      if (b.hp < 2) {
        ctx.beginPath()
        ctx.moveTo(x + bw * 0.3, y + 2)
        ctx.lineTo(x + bw * 0.45, y + bh * 0.55)
        ctx.lineTo(x + bw * 0.38, y + bh - 2)
        ctx.strokeStyle = '#2e5a1c'
        ctx.stroke()
      }
    } else {
      rr(ctx, x, y, bw, bh, 4)
      ctx.fillStyle = '#fff6e3'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#2e5a1c'
      ctx.stroke()
      pickleball(ctx, x + bw / 2, y + bh / 2, bh * 0.36)
    }
  }

  // パドル：原画と同じ形のまま横に寝かせる（握りは右へ。上の人から見ても右）。面の長さが球を受ける範囲
  for (const side of (two ? [0, 1] : [0]) as Side[]) {
    const p = s.paddles[side]
    drawPaddleArt(ctx, { x: X(p.x), y: Y(p.y), faceLen: p.w * k, angle: side === 0 ? Math.PI : 0, look: looks[side] })
  }

  // 球（最後に打った人の色のふち）
  for (const b of s.balls) {
    pickleball(ctx, X(b.x), Y(b.y), BALL_R * k)
    if (two) {
      ctx.beginPath()
      ctx.arc(X(b.x), Y(b.y), BALL_R * k + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = SIDE_COLOR[b.owner]
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }
}
