/**
 * ボールキャッチ（ひとり）の画面。手に持って遊ぶので画面は回さない。
 * どこを触っても、かご（とピクルくん）が指の左右の位置へ動く。
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
import type { Face } from '../../ui/Pikuru'
import { drawPikuruArt } from '../../ui/pikuruArt'
import { BASKET_Y, CATCH_LEVEL, CONTEST_TIME, createCatch, FIELD_H, FIELD_W, ITEM_NAME, ITEM_R, moveBasket, stepCatch } from './catch'
import type { CatchState, Item, ItemKind } from './catch'
import '../lift/lift.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `catch-best-${lv}`
const HUD = 64

/** まちがえたときの ひとこと（見分けかた） */
const WHY: Partial<Record<ItemKind, string>> = {
  tennis: 'けが はえていて、あなが ないよ',
  soccer: 'ピックルボールより ずっと おおきいよ',
  basket: 'ピックルボールより ずっと おおきいよ',
  baseball: 'ぬいめが あって、あなが ないよ',
  shuttle: 'はねで とぶよ',
}

export function CatchGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const contest = play.contest
  const level = levels[0]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<CatchState>(() => createCatch(level, contest ? CONTEST_TIME : undefined), [level, contest])
  const rand = useMemo(() => (contest ? mulberry32(contest.seed) : Math.random), [contest])
  const noticeTimer = useRef(0)
  const faceTimer = useRef(0)
  const [hud, setHud] = useState({ score: 0, lives: game.lives, time: Math.ceil(game.timeLimit) })
  const [face, setFace] = useState<Face>('think')
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'あなの ある ボールを とろう', face: 'think', only: 0 })
  const [over, setOver] = useState<{ score: number; caught: number; best: number } | null>(null)
  const faceRef = useRef<Face>('think')
  faceRef.current = face

  const view = useMemo(() => {
    const scale = Math.min((stage.w - 16) / FIELD_W, (stage.h - HUD - 12) / FIELD_H)
    return { scale, ox: (stage.w - FIELD_W * scale) / 2, oy: HUD + (stage.h - HUD - 12 - FIELD_H * scale) / 2 }
  }, [stage.w, stage.h])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __catch?: CatchState }).__catch = game
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

  const react = (f: Face, seconds: number) => {
    setFace(f)
    faceTimer.current = seconds
  }

  useFrame((dt) => {
    if (!paused && !over) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      if (faceTimer.current > 0) {
        faceTimer.current -= dt
        if (faceTimer.current <= 0) setFace('think')
      }
      if (game.phase === 'play' && notice && noticeTimer.current <= 0) setNotice(null)
      for (const ev of stepCatch(game, dt, rand)) {
        switch (ev.type) {
          case 'good':
            if (ev.kind === 'gold') {
              sfx.ok()
              setNotice({ title: 'きんの ボール！', sub: '+3てん', face: 'ok', only: 0 })
              noticeTimer.current = 1
            } else sfx.pop(0.6)
            react('ok', 0.6)
            break
          case 'bad':
            sfx.ng()
            react('oops', 1.2)
            if (ev.lives > 0) {
              setNotice({ title: `${ITEM_NAME[ev.kind]}は ちがうよ！`, sub: WHY[ev.kind], face: 'oops', only: 0 })
              noticeTimer.current = 1.6
            }
            break
          case 'miss':
            break
          case 'over': {
            sfx.fanfare()
            setNotice(null)
            play.finish({ value: ev.score })
            if (contest) {
              setOver({ score: ev.score, caught: ev.caught, best: 0 })
              break
            }
            const prev = load<number>(bestKey(level), 0)
            const best = Math.max(prev, ev.score)
            save(bestKey(level), best)
            if (ev.score > prev) speak(PHRASES.great)
            setOver({ score: ev.score, caught: ev.caught, best })
            break
          }
        }
      }
      const time = Math.max(0, Math.ceil(game.timeLimit - game.t))
      if (game.score !== hud.score || game.lives !== hud.lives || time !== hud.time) setHud({ score: game.score, lives: game.lives, time })
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, view, game, faceRef.current)
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
    moveBasket(game, (p.x - view.ox) / view.scale)
  }

  return (
    <div className="catch">
      <canvas
        ref={canvasRef}
        className="catch-canvas"
        data-testid="catch-canvas"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="catch-hud">
        <span className="jump-lives" aria-label={`ライフ ${hud.lives}`} style={{ fontSize: 18, letterSpacing: -2 }}>
          {'❤️'.repeat(Math.max(0, hud.lives))}
        </span>
        <span className="catch-time" aria-label={`のこり ${hud.time}びょう`}>
          ⏱ {hud.time}
        </span>
        <span className="catch-score" style={{ marginLeft: 'auto', fontSize: 32 }}>
          {hud.score}
          <small>てん</small>
        </span>
      </div>
      <Notice data={notice} />
      {over && !contest && (
        <Result
          single
          title={() => `${over.score}てん！`}
          sub={() =>
            `ピックルボールを ${over.caught}こ とったよ。` +
            (over.score >= over.best && over.score > 0 ? 'さいこう きろく！' : `さいこうは ${over.best}てん（${LEVEL_INFO[level].label}）`)
          }
          face={() => (over.score >= over.best && over.score > 0 ? 'ok' : 'eh')}
          onAgain={onRestart}
          extra={<p className="result-sub">あなが あいているのが ピックルボール！</p>}
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

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: CatchState, face: Face) {
  const k = v.scale
  const X = (x: number) => v.ox + x * k
  const Y = (y: number) => v.oy + y * k
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  // 空（場）と地面（コート）
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, Y(0), 0, Y(FIELD_H))
  sky.addColorStop(0, '#bfe6ff')
  sky.addColorStop(1, '#fff3d6')
  ctx.fillStyle = sky
  ctx.fillRect(X(0), Y(0), FIELD_W * k, FIELD_H * k)
  ctx.fillStyle = '#2f5d9a'
  ctx.fillRect(X(0), Y(FIELD_H - 8), FIELD_W * k, 8 * k)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(X(0), Y(FIELD_H - 8), FIELD_W * k, Math.max(2, 0.8 * k))

  // 落ちてくるボール
  for (const it of s.items) {
    if (it.done && it.y > BASKET_Y) continue
    drawItem(ctx, it, X(it.x), Y(it.y), ITEM_R * k)
  }

  // ピクルくん（かごの後ろ）と かご
  const lv = CATCH_LEVEL[s.level]
  const bw = lv.basket * k
  const bx = X(s.basketX)
  const by = Y(BASKET_Y)
  drawPikuruArt(ctx, face, bx + bw * 0.08, by + 12 * k, 30 * k)
  drawBasket(ctx, bx, by, bw, 13 * k)
  ctx.restore()
  ctx.beginPath()
  ctx.roundRect(X(0), Y(0), FIELD_W * k, FIELD_H * k, 14)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}

/** ボールかご（金あみのかご） */
function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const top = w / 2
  const bot = w * 0.4
  ctx.beginPath()
  ctx.moveTo(x - top, y)
  ctx.lineTo(x + top, y)
  ctx.lineTo(x + bot, y + h)
  ctx.lineTo(x - bot, y + h)
  ctx.closePath()
  ctx.fillStyle = 'rgba(80, 92, 104, 0.35)'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(40, 52, 64, 0.8)'
  ctx.lineWidth = 1.2
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath()
    ctx.moveTo(x + i * w * 0.09, y)
    ctx.lineTo(x + i * w * 0.075, y + h)
    ctx.stroke()
  }
  for (let j = 1; j < 4; j++) {
    ctx.beginPath()
    ctx.moveTo(x - top, y + (h * j) / 4)
    ctx.lineTo(x + top, y + (h * j) / 4)
    ctx.stroke()
  }
  ctx.restore()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#3a4752'
  ctx.beginPath()
  ctx.moveTo(x - top, y)
  ctx.lineTo(x + top, y)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - top, y)
  ctx.lineTo(x - bot, y + h)
  ctx.lineTo(x + bot, y + h)
  ctx.lineTo(x + top, y)
  ctx.stroke()
}

function holes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  for (const [dx, dy] of [
    [-0.35, -0.25],
    [0.3, -0.3],
    [0.05, 0.38],
    [-0.42, 0.25],
    [0.45, 0.15],
  ]) {
    ctx.beginPath()
    ctx.arc(x + dx * r, y + dy * r, r * 0.14, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, x: number, y: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(it.spin)
  ctx.lineWidth = Math.max(1.5, r * 0.13)
  switch (it.kind) {
    case 'pickle':
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#d4f03c'
      ctx.fill()
      ctx.strokeStyle = '#2e5a1c'
      ctx.stroke()
      holes(ctx, 0, 0, r, '#2e5a1c')
      break
    case 'gold': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
      g.addColorStop(0, '#fff7c2')
      g.addColorStop(1, '#f0b400')
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = '#a67600'
      ctx.stroke()
      holes(ctx, 0, 0, r, '#a67600')
      break
    }
    case 'tennis':
      // テニスボール：けばだった黄緑に、白いぬいめ（穴はない）
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#d9ec3a'
      ctx.fill()
      ctx.strokeStyle = '#a7b82a'
      ctx.setLineDash([r * 0.18, r * 0.12])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = r * 0.16
      ctx.beginPath()
      ctx.arc(-r * 1.15, 0, r * 0.9, -0.95, 0.95)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(r * 1.15, 0, r * 0.9, Math.PI - 0.95, Math.PI + 0.95)
      ctx.stroke()
      break
    case 'soccer': {
      const R = r * 1.5
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#12302b'
      ctx.stroke()
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
        ctx.lineTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38)
      }
      ctx.closePath()
      ctx.fillStyle = '#12302b'
      ctx.fill()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38)
        ctx.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95)
        ctx.stroke()
      }
      break
    }
    case 'basket': {
      const R = r * 1.6
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.fillStyle = '#f08a24'
      ctx.fill()
      ctx.strokeStyle = '#4a2a10'
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-R, 0)
      ctx.lineTo(R, 0)
      ctx.moveTo(0, -R)
      ctx.lineTo(0, R)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(-R * 1.25, 0, R * 0.95, -0.85, 0.85)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(R * 1.25, 0, R * 0.95, Math.PI - 0.85, Math.PI + 0.85)
      ctx.stroke()
      break
    }
    case 'baseball':
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#9aa5a0'
      ctx.stroke()
      ctx.strokeStyle = '#e5533d'
      ctx.lineWidth = r * 0.12
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(s * r * 1.15, 0, r * 0.85, s > 0 ? Math.PI - 0.9 : -0.9, s > 0 ? Math.PI + 0.9 : 0.9)
        ctx.stroke()
      }
      break
    case 'shuttle':
      // シャトル：コルク（下）と羽根（上）。回さない
      ctx.rotate(-it.spin)
      ctx.beginPath()
      ctx.moveTo(-r * 0.45, r * 0.2)
      ctx.lineTo(-r * 1.1, -r * 1.6)
      ctx.lineTo(r * 1.1, -r * 1.6)
      ctx.lineTo(r * 0.45, r * 0.2)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#9aa5a0'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, r * 0.45, r * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = '#f2e3c4'
      ctx.fill()
      ctx.strokeStyle = '#b38b4d'
      ctx.stroke()
      break
  }
  ctx.restore()
}
