/**
 * ポンポン リフティング（ひとり）の画面。手に持って遊ぶので画面は回さない。
 * どこを触っても、指の少し上にラケットが来る。ボールの影の所にラケットを動かして受ける。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { mulberry32 } from '../../core/rng'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { useStage } from '../../core/Stage'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Notice, Result } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { drawPaddleArt } from '../../ui/paddleArt'
import type { PaddleLook } from '../../ui/paddleArt'
import type { Face } from '../../ui/Hawk'
import { HawkCut } from '../../ui/hawkArt'
import { drawSoftBall } from '../../ui/softBall'
import { BALL_R, createLift, FIELD_H, FIELD_W, GRAVITY, movePaddle, stepLift } from './lift'
import type { LiftState } from './lift'
import './lift.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `lift-best-${lv}`
const HUD = 64
/** 指より少し上にラケットを出す（指で隠れないように） */
const FINGER_OFFSET = 14

export function LiftGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const contest = play.contest
  const level = levels[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<LiftState>(() => createLift(level), [level])
  const rand = useMemo(() => (contest ? mulberry32(contest.seed) : Math.random), [contest])
  const noticeTimer = useRef(0)
  const [count, setCount] = useState(0)
  const [face, setFace] = useState<Face>('think')
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'かげの ところで うけてね', face: 'think', only: 0 })
  const [over, setOver] = useState<{ count: number; best: number } | null>(null)

  const view = useMemo(() => {
    const scale = Math.min((stage.w - 16) / FIELD_W, (stage.h - HUD - 12) / FIELD_H)
    return { scale, ox: (stage.w - FIELD_W * scale) / 2, oy: HUD + (stage.h - HUD - 12 - FIELD_H * scale) / 2 }
  }, [stage.w, stage.h])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __lift?: LiftState }).__lift = game
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

  useFrame((dt) => {
    if (!paused && !over) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      for (const ev of stepLift(game, dt, rand)) {
        if (ev.type === 'pon') {
          sfx.pop(0.4 + Math.min(0.5, ev.count / 60))
          setCount(ev.count)
          if (ev.count === 1) setNotice(null)
          if (ev.count % 10 === 0) {
            sfx.ok()
            setFace('ok')
            setNotice({ title: `${ev.count}かい！`, sub: 'すごい！', face: 'ok', only: 0 })
            noticeTimer.current = 1.2
          } else if (ev.count % 10 === 2) setFace('think')
        } else if (ev.type === 'drop') {
          sfx.ng()
          setFace('oops')
        } else if (ev.type === 'over') {
          sfx.fanfare()
          setNotice(null)
          play.finish({ value: ev.count })
          if (contest) {
            setOver({ count: ev.count, best: 0 })
            continue
          }
          const prev = load<number>(bestKey(level), 0)
          const best = Math.max(prev, ev.count)
          save(bestKey(level), best)
          if (ev.count > prev) speak(PHRASES.great)
          setOver({ count: ev.count, best })
        }
      }
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, view, game, play.paddles[0])
  })

  const onPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.type === 'pointerdown') {
      unlockAudio()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // 捕まえられなくても動く
      }
    }
    if (paused || over) return
    const p = stage.toLogical(e.clientX, e.clientY)
    movePaddle(game, (p.x - view.ox) / view.scale, (p.y - view.oy) / view.scale - FINGER_OFFSET)
  }

  return (
    <div className="lift">
      <canvas
        ref={canvasRef}
        className="lift-canvas"
        data-testid="lift-canvas"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="lift-hud">
        <HawkCut art={face} height={52} />
        <span className="lift-count" aria-label={`${count}かい`}>
          {count}
          <small>かい</small>
        </span>
      </div>
      <Notice data={notice} />
      {over && !contest && (
        <Result
          single
          title={() => `${over.count}かい つづいた！`}
          sub={() => (over.count >= over.best && over.count > 0 ? 'さいこう きろく！' : `さいこうは ${over.best}かい（${LEVEL_INFO[level].label}）`)}
          face={() => (over.count >= over.best && over.count > 0 ? 'ok' : 'eh')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

interface View {
  scale: number
  ox: number
  oy: number
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: LiftState, look: PaddleLook) {
  const k = v.scale
  const X = (x: number) => v.ox + x * k
  const Y = (y: number) => v.oy + y * k
  ctx.fillStyle = '#fff3d9'
  ctx.fillRect(0, 0, w, h)
  // 場（コートの色と線）
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.fillStyle = '#2f8a5f'
  ctx.fill()
  ctx.fillStyle = '#3d8f7a'
  ctx.fillRect(X(0), Y(0), FIELD_W * k, FIELD_H * 0.22 * k)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(X(0), Y(FIELD_H * 0.22))
  ctx.lineTo(X(FIELD_W), Y(FIELD_H * 0.22))
  ctx.moveTo(X(FIELD_W / 2), Y(FIELD_H * 0.22))
  ctx.lineTo(X(FIELD_W / 2), Y(FIELD_H))
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  const b = s.ball
  // 落ちる場所の目じるし（ちびっこ・キッズ）
  if ((s.level === 'chibi' || s.level === 'kids') && s.phase === 'play' && b.vz < 0 && b.z > 0) {
    // いまの高さから地面に着くまでの時間
    const tLand = (b.vz + Math.sqrt(b.vz * b.vz + 2 * GRAVITY * b.z)) / GRAVITY
    const lx = b.x + b.vx * tLand
    const ly = b.y + b.vy * tLand
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(X(lx), Y(ly), BALL_R * 1.8 * k, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(212, 240, 60, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ラケット（原画の形。上から見た面。握りは手前）
  const p = s.paddle
  drawPaddleArt(ctx, { x: X(p.x), y: Y(p.y), faceLen: p.len * k, angle: -Math.PI / 2, look })

  // 影（高いほど うすく小さく）
  const zr = Math.min(1, b.z / 40)
  ctx.beginPath()
  ctx.ellipse(X(b.x), Y(b.y), BALL_R * k * (1 - zr * 0.3), BALL_R * k * 0.7 * (1 - zr * 0.3), 0, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 - zr * 0.2})`
  ctx.fill()

  // ボール（高いほど上に、大きく）
  const r = BALL_R * k * (1 + b.z / 45)
  const bx = X(b.x)
  const by = Y(b.y) - b.z * k * 0.9
  drawSoftBall(ctx, bx, by, r)
}
