/**
 * ピクルくんジャンプ（ひとりで）。どこをタップしてもジャンプ。空中でもう一度タップで2段・3段まで。
 * 右から流れてくるピックルボールとネットをよける。手に持って遊ぶので画面は回さない（横向きでも縦向きでも）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { useStage } from '../../core/Stage'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { Notice, Result } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { BALL_R, BODY, createRunner, jump, MAX_JUMPS, stepRunner } from './runner'
import type { Obstacle, RunnerState } from './runner'
import { drawPikuruArt } from '../../ui/pikuruArt'
import { mulberry32 } from '../../core/rng'
import { usePlay } from '../../shell/playContext'
import './jump.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

const bestKey = (lv: Level) => `jump-best-${lv}`
/** 見える範囲（m）：ピクルくんの少し後ろから右へ。横向きは広く、縦向きは狭く（そのぶん大きく描く） */
const VIEW_X0 = -2
const VIEW_X1 = 11.5
const VIEW_X1_PORTRAIT = 8
/** じゅんばんモード：1回当たったら終わり。長くても60秒で終わる（みんな同じ障害の並び） */
export const JUMP_CONTEST_TIME = 60

export function JumpGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const level = levels[0]
  const play = usePlay()
  const contest = play.contest
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<RunnerState>(() => {
    const g = createRunner(level)
    if (contest) g.lives = 1
    return g
  }, [level, contest])
  const rand = useMemo(() => (contest ? mulberry32(contest.seed) : Math.random), [contest])
  const countdown = useRef(2.4)
  const noticeTimer = useRef(0)
  const [hud, setHud] = useState({ dist: 0, lives: game.lives, jumps: 0, t: 0 })
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'タップで ジャンプ！', sub: '3だんまで とべるよ', face: 'think', only: 0 })
  const [over, setOver] = useState<{ dist: number; dodged: number; best: number } | null>(null)

  // 1m を何px で描くか（横は見える範囲、縦は3段ジャンプの高さが入るように）
  const view = useMemo(() => {
    const portrait = stage.h > stage.w
    const span = (portrait ? VIEW_X1_PORTRAIT : VIEW_X1) - VIEW_X0
    const scale = Math.min(stage.w / span, (stage.h * 0.62) / 4.6)
    // 3段ジャンプのいちばん上（約4.6m）が入る高さに地面を置く
    const ground = Math.min(stage.h * 0.8, Math.max(70 + 4.8 * scale, stage.h * 0.5))
    return { scale, ox: -VIEW_X0 * scale, ground }
  }, [stage.w, stage.h])

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __jump?: RunnerState }).__jump = game
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

  useFrame((dt, now) => {
    if (!paused && !over) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      // はじめに少し待ってから走り出す
      if (countdown.current > 0) {
        countdown.current -= dt
        if (countdown.current <= 0) setNotice(null)
      } else {
        const events = stepRunner(game, dt, rand)
        if (contest && game.phase === 'play' && game.t >= JUMP_CONTEST_TIME) {
          game.phase = 'over'
          events.push({ type: 'over' })
        }
        for (const ev of events) {
          if (ev.type === 'hit') {
            sfx.ng()
            if (ev.livesLeft > 0) {
              setNotice({ title: 'いたっ！', sub: `のこり ${ev.livesLeft}`, face: 'oops', only: 0 })
              noticeTimer.current = 1
            }
          } else if (ev.type === 'dodge') {
            sfx.tick()
          } else if (ev.type === 'over') {
            sfx.fanfare()
            play.finish({ value: Math.floor(game.dist) })
            if (contest) {
              setNotice(null)
              setOver({ dist: Math.floor(game.dist), dodged: game.dodged, best: 0 })
              continue
            }
            const prev = load<number>(bestKey(level), 0)
            const dist = Math.floor(game.dist)
            const best = Math.max(prev, dist)
            save(bestKey(level), best)
            if (dist > prev) speak(PHRASES.great)
            setNotice(null)
            setOver({ dist, dodged: game.dodged, best })
          }
        }
      }
      const d = Math.floor(game.dist)
      const t = contest ? Math.floor(game.t) : 0
      if (d !== hud.dist || game.lives !== hud.lives || game.jumps !== hud.jumps || t !== hud.t) setHud({ dist: d, lives: game.lives, jumps: game.jumps, t })
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, view, game, now / 1000)
  })

  const onTap = () => {
    unlockAudio()
    if (countdown.current > 0 || over || paused) return
    const ev: Parameters<typeof jump>[1] = []
    if (jump(game, ev)) sfx.pop(0.3 + game.jumps * 0.2)
  }

  return (
    <div className="jump">
      <canvas
        ref={canvasRef}
        className="jump-canvas"
        data-testid="jump-canvas"
        onPointerDown={onTap}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="jump-hud">
        <span className="jump-lives" aria-label={`ライフ ${hud.lives}`}>
          {'❤️'.repeat(Math.max(0, hud.lives))}
        </span>
        <span className="jump-dots" aria-label={`ジャンプ のこり ${MAX_JUMPS - hud.jumps}`}>
          {Array.from({ length: MAX_JUMPS }, (_, i) => (
            <i key={i} data-used={i < hud.jumps || undefined} />
          ))}
        </span>
        {contest && <span className="jump-time">のこり {Math.max(0, Math.ceil(JUMP_CONTEST_TIME - hud.t))}</span>}
        <span className="jump-dist">{hud.dist}m</span>
      </div>
      <Notice data={notice} />
      {over && !contest && (
        <Result
          single
          title={() => `${over.dist}m はしった！`}
          sub={() =>
            `${over.dodged}こ よけたよ。` + (over.dist >= over.best && over.dist > 0 ? 'さいこう きろく！' : `さいこうは ${over.best}m（${LEVEL_INFO[level].label}）`)
          }
          face={() => (over.dist >= over.best ? 'ok' : 'eh')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

interface View {
  scale: number
  ox: number
  ground: number
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, s: RunnerState, t: number) {
  const k = v.scale
  const X = (x: number) => v.ox + x * k
  const Y = (y: number) => v.ground - y * k

  // 空と、遠くのコート
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffd99a'
  for (let i = 0; i < 4; i++) {
    const cx = ((((i * 260 - s.dist * k * 0.25) % (w + 260)) + w + 260) % (w + 260)) - 130
    ctx.beginPath()
    ctx.ellipse(cx, v.ground - (1.8 + (i % 2) * 1.2) * k - 40, 60, 18, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 地面：コート（青）と、流れていく白いライン
  ctx.fillStyle = '#2f5d9a'
  ctx.fillRect(0, v.ground, w, h - v.ground)
  ctx.fillStyle = '#3d8f7a'
  ctx.fillRect(0, v.ground, w, Math.max(6, 0.18 * k))
  ctx.fillStyle = '#ffffff'
  const step = 3
  for (let x = -((s.dist % step) + step); x < VIEW_X1 + 2 * step; x += step) {
    ctx.fillRect(X(x), v.ground + 0.5 * k, 0.9 * k, Math.max(2, 0.06 * k))
  }

  // 障害
  for (const o of s.obstacles) drawObstacle(ctx, X, Y, k, o)

  // ピクルくん（原画の絵。走るとはずみ、跳ぶと少し後ろへかたむく。ぶつかった後は「えっ」の顔で点滅）
  const blink = s.safe > 0 && Math.floor(t * 12) % 2 === 0
  if (!blink) {
    const air = s.y > 0
    const bob = air ? 0 : Math.abs(Math.sin(t * 14)) * 0.08 * k
    const tilt = air ? -0.12 - s.jumps * 0.06 : Math.sin(t * 14) * 0.04
    const art = s.safe > 0 ? 'eh' : 'run'
    const h = (art === 'run' ? 1.35 : 1.15) * k
    // 絵がまだ読み込めていないときは、線で描いたピクルくん
    if (!drawPikuruArt(ctx, art, X(0), Y(s.y) - bob, h, tilt)) drawPikuru(ctx, X(0), Y(s.y), k, s, t)
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, k: number, o: Obstacle) {
  if (o.kind === 'net' || o.kind === 'net-tall') {
    const x = X(o.x)
    const top = Y(o.h)
    const nw = Math.max(10, 0.5 * k)
    // ポスト
    ctx.fillStyle = '#12302b'
    ctx.fillRect(x - nw / 2 - 3, top - 4, 5, Y(0) - top + 4)
    ctx.fillRect(x + nw / 2 - 2, top - 4, 5, Y(0) - top + 4)
    // あみ
    ctx.strokeStyle = 'rgba(18, 48, 43, 0.7)'
    ctx.lineWidth = 1
    for (let y = top; y < Y(0); y += 6) {
      ctx.beginPath()
      ctx.moveTo(x - nw / 2, y)
      ctx.lineTo(x + nw / 2, y)
      ctx.stroke()
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - nw / 2 - 3, top - 4, nw + 6, 5)
    return
  }
  // 地面の影（高さがわかるように）
  ctx.beginPath()
  ctx.ellipse(X(o.x), Y(0) + 2, BALL_R * k, BALL_R * k * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  // 速い球は尾をつける
  if (o.kind === 'drive' || o.kind.startsWith('fly')) {
    ctx.strokeStyle = 'rgba(212, 240, 60, 0.5)'
    ctx.lineWidth = BALL_R * k
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(X(o.x), Y(o.y))
    ctx.lineTo(X(o.x + (o.kind === 'drive' ? 1.6 : 0.9)), Y(o.y))
    ctx.stroke()
  }
  const r = BALL_R * k
  const x = X(o.x)
  const y = Y(o.y)
  ctx.save()
  ctx.translate(x, y)
  // 転がる球はくるくる回る
  ctx.rotate(-o.x * 2.5)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.14)
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  for (const [dx, dy] of [
    [-0.35, -0.25],
    [0.3, -0.3],
    [0.05, 0.38],
  ]) {
    ctx.beginPath()
    ctx.arc(dx * r, dy * r, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 線で描いたピクルくん（原画の絵が読み込めないときの予備。ピクルくん仕様：体 #6BB33F、輪郭 #2E5A1C、ライムの IQ ヘッドバンド、オレンジのほっぺ、「？」のアホ毛） */
function drawPikuru(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, s: RunnerState, t: number) {
  const bw = BODY.w * k * 1.25
  const bh = BODY.h * k * 1.1
  const air = s.y > 0
  const bob = air ? 0 : Math.abs(Math.sin(t * 14)) * 0.06 * k
  const top = y - bh - bob
  const line = Math.max(2, 0.05 * k)

  // 足（走ると交互に動く）
  ctx.strokeStyle = '#2e5a1c'
  ctx.lineWidth = line * 1.6
  ctx.lineCap = 'round'
  const leg = air ? 0.4 : Math.sin(t * 14)
  for (const sgn of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + sgn * bw * 0.18, y - bh * 0.12 - bob)
    ctx.lineTo(x + sgn * bw * 0.18 + leg * sgn * bw * 0.25, y - bob * 0.3)
    ctx.stroke()
  }

  // 体（ふっくらしたきゅうり）
  ctx.beginPath()
  ctx.roundRect(x - bw / 2, top, bw, bh * 0.9, bw / 2)
  ctx.fillStyle = '#6bb33f'
  ctx.fill()
  ctx.lineWidth = line
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()

  // ヘッドバンド（ライムに IQ）
  const hb = top + bh * 0.16
  ctx.fillStyle = '#d4f03c'
  ctx.fillRect(x - bw / 2 + line / 2, hb, bw - line, bh * 0.14)
  ctx.strokeRect(x - bw / 2 + line / 2, hb, bw - line, bh * 0.14)
  ctx.fillStyle = '#12302b'
  ctx.font = `900 ${Math.round(bh * 0.12)}px 'Zen Maru Gothic', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('IQ', x, hb + bh * 0.075)

  // 目とほっぺ（右を向いて走る）
  const ey = top + bh * 0.42
  for (const ex of [x + bw * 0.02, x + bw * 0.26]) {
    ctx.beginPath()
    ctx.arc(ex, ey, bw * 0.11, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = line * 0.6
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex + bw * 0.03, ey, bw * 0.055, 0, Math.PI * 2)
    ctx.fillStyle = '#12302b'
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255, 138, 61, 0.7)'
  ctx.beginPath()
  ctx.ellipse(x + bw * 0.32, ey + bh * 0.12, bw * 0.08, bw * 0.05, 0, 0, Math.PI * 2)
  ctx.fill()

  // アホ毛：走るときは「？」、ジャンプ中は「！」（2段目・3段目でのびる）
  ctx.strokeStyle = '#2e5a1c'
  ctx.lineWidth = line * 1.3
  ctx.beginPath()
  if (air) {
    const len = bh * (0.25 + s.jumps * 0.08)
    ctx.moveTo(x, top)
    ctx.lineTo(x, top - len)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, top - len - bh * 0.08, line, 0, Math.PI * 2)
    ctx.fillStyle = '#2e5a1c'
    ctx.fill()
  } else {
    ctx.moveTo(x, top)
    ctx.lineTo(x, top - bh * 0.12)
    ctx.arc(x + bh * 0.08, top - bh * 0.2, bh * 0.09, Math.PI * 0.9, Math.PI * 2.1)
    ctx.stroke()
  }
}
