/**
 * キッチン カーリング（ふたり・チームでも）の画面。机に置いて上下で向かい合う。
 * 自分の番のとき、自分の半分のどこかに指を置いて、うしろ（自分の方）へ引いて はなすと投げる。
 * ちびっこ・キッズは、止まりそうな所に目じるしが出る。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { SIDE_COLOR, SIDE_NAME } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { Both, useStage } from '../../core/Stage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { drawPikuruArt } from '../../ui/pikuruArt'
import { BALL_R, CENTER, createCurling, ENDS, FIELD_H, FIELD_W, launchPoint, launchVelocity, restPoint, RINGS, stepCurling, STONES, throwStone } from './curling'
import type { CuState } from './curling'
import './curling.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

interface Aim {
  side: Side
  id: number
  sx: number
  sy: number
  dx: number
  dy: number
}

export function CurlingGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<CuState>(() => createCurling(levels), [levels])
  const aim = useRef<Aim | null>(null)
  const noticeTimer = useRef(0)
  const [hud, setHud] = useState({ score: [0, 0] as [number, number], turn: 0 as Side, thrown: [0, 0] as [number, number], end: 1, phase: game.phase })
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'ひいて はなすと なげるよ', sub: 'まとの まんなかに ちかい ほうが かち', face: 'think' })
  const [over, setOver] = useState<Side | null>(null)

  const view = useMemo(() => {
    const scale = Math.min((stage.w - 12) / FIELD_W, (stage.h - 12) / FIELD_H)
    return { scale, ox: (stage.w - FIELD_W * scale) / 2, oy: (stage.h - FIELD_H * scale) / 2 }
  }, [stage.w, stage.h])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __curling?: CuState }).__curling = game
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
    if (!paused) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      for (const ev of stepCurling(game, dt)) {
        switch (ev.type) {
          case 'hit':
            sfx.pop(Math.min(1, ev.speed / 80))
            break
          case 'out':
            sfx.bounce()
            break
          case 'end':
            sfx.ok()
            if (ev.side === null) setNotice({ title: 'てんなし', sub: 'まとに だれも はいらなかった', face: 'eh' })
            else {
              speak(ev.side === 0 ? PHRASES.point0 : PHRASES.point1)
              setNotice({
                title: `${SIDE_NAME[ev.side]} +${ev.points}`,
                sub: `${ev.score[0]} たい ${ev.score[1]}`,
                faces: [ev.side === 0 ? 'ok' : 'oops', ev.side === 1 ? 'ok' : 'oops'],
              })
            }
            noticeTimer.current = 2.6
            break
          case 'over':
            sfx.fanfare()
            if (ev.winner !== null) speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            setNotice(null)
            play.finish({ winner: ev.winner })
            setOver(ev.winner)
            break
        }
      }
      if (game.phase !== hud.phase || game.turn !== hud.turn || game.thrown[0] !== hud.thrown[0] || game.thrown[1] !== hud.thrown[1] || game.score[0] !== hud.score[0] || game.score[1] !== hud.score[1] || game.end !== hud.end) {
        setHud({ score: [game.score[0], game.score[1]], turn: game.turn, thrown: [game.thrown[0], game.thrown[1]], end: game.end, phase: game.phase })
      }
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, view, game, aim.current)
  })

  const toField = (e: PointerEvent) => {
    const p = stage.toLogical(e.clientX, e.clientY)
    return { side: (p.y < stage.h / 2 ? 1 : 0) as Side, x: (p.x - view.ox) / view.scale, y: (p.y - view.oy) / view.scale }
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    if (paused || over !== null || game.phase !== 'aim' || aim.current) return
    const f = toField(e)
    if (f.side !== game.turn) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 捕まえられなくても動く
    }
    setNotice(null)
    aim.current = { side: f.side, id: e.pointerId, sx: f.x, sy: f.y, dx: 0, dy: 0 }
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = aim.current
    if (!a || a.id !== e.pointerId) return
    const f = toField(e)
    a.dx = f.x - a.sx
    a.dy = f.y - a.sy
  }
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = aim.current
    if (!a || a.id !== e.pointerId) return
    aim.current = null
    if (Math.hypot(a.dx, a.dy) < 4) return
    if (throwStone(game, a.side, a.dx, a.dy)) sfx.pop(0.4)
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block', touchAction: 'none' }}
        data-testid="curling-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <Scores score={hud.score} />
      <Both>
        {(side) => (
          <div className="cu-info">
            <span className="cu-end">
              エンド {Math.min(hud.end, ENDS)}/{ENDS}
              {hud.end > ENDS ? '＋' : ''}
            </span>
            <span className="cu-stones" aria-label={`のこり ${STONES - hud.thrown[side]}きゅう`}>
              {Array.from({ length: STONES }, (_, i) => (
                <i key={i} data-used={i < hud.thrown[side] || undefined} style={{ borderColor: SIDE_COLOR[side] }} />
              ))}
            </span>
            {hud.phase === 'aim' && <span className="cu-turn">{hud.turn === side ? 'あなたの ばん！' : 'あいての ばん'}</span>}
          </div>
        )}
      </Both>
      <Notice data={notice} />
      {over !== null && (
        <Result
          title={(side) => (side === over ? 'かち！ ナイスショット' : 'おしい！')}
          sub={(side) => `${hud.score[side]} たい ${hud.score[side === 0 ? 1 : 0]}`}
          face={(side) => (side === over ? 'ok' : 'oops')}
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

function stone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(x + 1.5, y + 2, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = Math.max(2.5, r * 0.28)
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  for (const [dx, dy] of [
    [-0.32, -0.22],
    [0.28, -0.28],
    [0.04, 0.34],
  ]) {
    ctx.beginPath()
    ctx.arc(x + dx * r, y + dy * r, r * 0.14, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: CuState, aim: Aim | null) {
  const k = v.scale
  const X = (x: number) => v.ox + x * k
  const Y = (y: number) => v.oy + y * k
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  // コート：まんなかがキッチン（的）
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.fillStyle = '#2f5d9a'
  ctx.fill()
  const kz = 26
  ctx.fillStyle = '#3d8f7a'
  ctx.fillRect(X(0), Y(CENTER.y - kz), FIELD_W * k, kz * 2 * k)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(X(0), Y(CENTER.y - kz), FIELD_W * k, kz * 2 * k)
  // 的（外から ライム・しろ・オレンジ）
  const ringColors = ['#ff8a3d', '#ffffff', '#d4f03c']
  for (let i = RINGS.length - 1; i >= 0; i--) {
    ctx.beginPath()
    ctx.arc(X(CENTER.x), Y(CENTER.y), RINGS[i] * k, 0, Math.PI * 2)
    ctx.fillStyle = ringColors[i]
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#2e5a1c'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // ネット（まんなかの線。ボールは通れる）
  ctx.fillStyle = 'rgba(18, 48, 43, 0.35)'
  ctx.fillRect(X(0), Y(CENTER.y) - 1, FIELD_W * k, 2)
  // 投げる所
  for (const side of [0, 1] as Side[]) {
    const p = launchPoint(side)
    ctx.beginPath()
    ctx.arc(X(p.x), Y(p.y), (BALL_R + 2) * k, 0, Math.PI * 2)
    ctx.strokeStyle = SIDE_COLOR[side]
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()

  // ピクルくん（しんぱん。的の よこ）
  // 右はしの ？・⏸ と重ならないよう、的の左に
  drawPikuruArt(ctx, s.phase === 'endScore' ? 'ok' : s.phase === 'moving' ? 'eh' : 'think', X(CENTER.x - RINGS[2] - 16), Y(CENTER.y + 12), 18 * k)

  for (const st of s.stones) stone(ctx, X(st.x), Y(st.y), BALL_R * k, SIDE_COLOR[st.side])

  // ねらい：引いた反対へ矢印。ちびっこ・キッズは止まる所の目じるし
  if (aim && s.phase === 'aim') {
    const p = launchPoint(aim.side)
    const vel = launchVelocity(aim.dx, aim.dy)
    const sp = Math.hypot(vel.vx, vel.vy)
    stone(ctx, X(p.x), Y(p.y), BALL_R * k, SIDE_COLOR[aim.side], 0.8)
    if (sp > 1) {
      const ux = vel.vx / sp
      const uy = vel.vy / sp
      const len = 8 + sp * 0.35
      ctx.strokeStyle = SIDE_COLOR[aim.side]
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(X(p.x), Y(p.y))
      ctx.lineTo(X(p.x + ux * len), Y(p.y + uy * len))
      ctx.stroke()
      const lv = s.levels[aim.side]
      if (lv === 'chibi' || lv === 'kids') {
        const r = restPoint(p.x, p.y, vel.vx, vel.vy)
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(X(r.x), Y(r.y), BALL_R * k, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  } else if (s.phase === 'aim') {
    // 次に投げるボールを、投げる所に置いておく
    const p = launchPoint(s.turn)
    stone(ctx, X(p.x), Y(p.y), BALL_R * k, SIDE_COLOR[s.turn], 0.6)
  }
}
