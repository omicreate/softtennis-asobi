/**
 * れんだ つなひき（ふたり）の画面。机に置いて上下で向かい合う。
 * 自分の側（画面の半分）をどこでもタップすると、まんなかのボールを相手の方へ押す。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { SIDE_COLOR, SIDE_NAME } from '../../core/players'
import { getSettings } from '../../core/settings'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { useStage } from '../../core/Stage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import type { Face } from '../../ui/Pikuru'
import { drawPikuruArt } from '../../ui/pikuruArt'
import { COUNTDOWN, createTug, ROUND_TIME, stepTug, tap, WINS } from './tug'
import type { TugState } from './tug'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

interface Ripple {
  x: number
  y: number
  t: number
  side: Side
}

export function TugGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // チーム戦（2たい2）は はじめたときの設定で決める
  const game = useMemo<TugState>(() => createTug(levels, getSettings().tugTeam), [levels])
  const ripples = useRef<Ripple[]>([])
  const noticeTimer = useRef(0)
  const [wins, setWins] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>({ title: String(COUNTDOWN), big: true })
  const [over, setOver] = useState<Side | null>(null)
  const [face, setFace] = useState<Face>('think')

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __tug?: TugState }).__tug = game
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
      for (const ev of stepTug(game, dt)) {
        switch (ev.type) {
          case 'count':
            sfx.tick()
            setNotice({ title: String(ev.n), big: true })
            break
          case 'go':
            sfx.whistle()
            setFace('eh')
            setNotice({ title: 'スタート！', big: true })
            noticeTimer.current = 0.8
            break
          case 'round':
            setWins(ev.wins)
            if (ev.winner === null) {
              sfx.bounce()
              setFace('think')
              setNotice({ title: 'ひきわけ！', sub: 'もういちど', face: 'think' })
            } else {
              sfx.ok()
              setFace('ok')
              speak(ev.winner === 0 ? PHRASES.point0 : PHRASES.point1)
              setNotice({
                title: `${SIDE_NAME[ev.winner]}の かち！`,
                sub: `${ev.wins[0]} たい ${ev.wins[1]}`,
                faces: [ev.winner === 0 ? 'ok' : 'oops', ev.winner === 1 ? 'ok' : 'oops'],
              })
            }
            noticeTimer.current = 2
            break
          case 'over':
            sfx.fanfare()
            speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            setNotice(null)
            play.finish({ winner: ev.winner })
            setOver(ev.winner)
            break
        }
      }
      if (game.phase === 'ready' && game.t < 0.05) setFace('think')
      ripples.current = ripples.current.filter((r) => (r.t += dt) < 0.45)
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, game, ripples.current, face)
  })

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    if (paused || over !== null) return
    const p = stage.toLogical(e.clientX, e.clientY)
    const side: Side = p.y < stage.h / 2 ? 1 : 0
    if (tap(game, side)) {
      sfx.pop(0.15)
      ripples.current.push({ x: p.x, y: p.y, t: 0, side })
    }
  }

  return (
    <div className="tug" style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block', touchAction: 'none' }}
        data-testid="tug-canvas"
        onPointerDown={onDown}
        onContextMenu={(e) => e.preventDefault()}
      />
      <Scores score={wins} />
      <Notice data={notice} />
      {over !== null && (
        <Result
          title={(side) => (side === over ? 'かち！ やったね' : 'おしい！')}
          sub={(side) => `${wins[side]} たい ${wins[side === 0 ? 1 : 0]}（${WINS}かい かったら かち）`}
          face={(side) => (side === over ? 'ok' : 'oops')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

/** ゴールラインまでの余白（上下） */
function margin(h: number) {
  return Math.max(76, h * 0.12)
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: TugState, ripples: Ripple[], face: Face) {
  // 下はオレンジ、上はあお
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d3e7f8' // 上の人の地（tokens.css の --p1-tint）
  ctx.fillRect(0, 0, w, h / 2)
  ctx.fillStyle = 'rgba(255, 138, 61, 0.22)'
  ctx.fillRect(0, h / 2, w, h / 2)

  // まんなかの通り道（コートの色）
  const m = margin(h)
  const laneW = Math.min(w * 0.3, 140)
  const lx = (w - laneW) / 2

  // 通り道の両よこに「タップ！」（向かいの人にも読めるように上は逆さ）
  const fs = Math.round(Math.min(lx * 0.24, 44))
  for (const side of [0, 1] as Side[]) {
    for (const cx of [lx / 2, w - lx / 2]) {
      ctx.save()
      ctx.translate(cx, side === 0 ? h * 0.76 : h * 0.24)
      if (side === 1) ctx.rotate(Math.PI)
      ctx.fillStyle = side === 0 ? 'rgba(196, 87, 15, 0.22)' : 'rgba(23, 100, 168, 0.22)'
      ctx.font = `900 ${fs}px 'Zen Maru Gothic', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('タップ！', 0, 0)
      ctx.restore()
    }
  }
  ctx.beginPath()
  ctx.roundRect(lx, m - 18, laneW, h - 2 * m + 36, 18)
  ctx.fillStyle = '#2f5d9a'
  ctx.fill()
  // キッチンの色をネットの近くに
  ctx.fillStyle = '#3d8f7a'
  ctx.fillRect(lx, h / 2 - (h / 2 - m) * 0.3, laneW, (h / 2 - m) * 0.6)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(lx, h / 2 - 2, laneW, 4)
  // ゴールライン
  for (const side of [0, 1] as Side[]) {
    const y = side === 0 ? h - m : m
    ctx.fillStyle = SIDE_COLOR[side]
    ctx.fillRect(lx - 10, y - 5, laneW + 20, 10)
    ctx.save()
    ctx.translate(w / 2, side === 0 ? y + 24 : y - 24)
    if (side === 1) ctx.rotate(Math.PI)
    ctx.fillStyle = '#12302b'
    ctx.font = `900 16px 'Zen Maru Gothic', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ここまで おされたら まけ', 0, 0)
    ctx.restore()
  }

  // つな（ボールと いっしょに動く）
  const by = h / 2 - s.pos * (h / 2 - m)
  ctx.save()
  ctx.beginPath()
  ctx.rect(lx, m - 18, laneW, h - 2 * m + 36)
  ctx.clip()
  ctx.strokeStyle = '#e8c48a'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(w / 2, -20)
  ctx.lineTo(w / 2, h + 20)
  ctx.stroke()
  ctx.strokeStyle = '#b98a4a'
  ctx.lineWidth = 3
  const off = (by % 16) - 16
  for (let y = off; y < h + 16; y += 16) {
    ctx.beginPath()
    ctx.moveTo(w / 2 - 6, y)
    ctx.lineTo(w / 2 + 6, y + 8)
    ctx.stroke()
  }
  ctx.restore()

  // ボール（押されると少しゆれる）
  const r = Math.min(30, laneW * 0.22)
  const shake = s.phase === 'pull' ? Math.sin(s.clock * 60) * 1.5 : 0
  ctx.beginPath()
  ctx.arc(w / 2 + shake, by, r, 0, Math.PI * 2)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  for (const [dx, dy] of [
    [-0.35, -0.25],
    [0.3, -0.3],
    [0.05, 0.38],
  ]) {
    ctx.beginPath()
    ctx.arc(w / 2 + shake + dx * r, by + dy * r, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }

  // ピクルくん（しんぱん。まんなかの左）
  drawPikuruArt(ctx, face, lx / 2, h / 2 + Math.min(60, lx * 0.45), Math.min(110, lx * 0.85), 0)

  // のこり時間（通り道の中、ネットの近く。右はしのボタンと重ならないように）
  if (s.phase === 'pull') {
    const left = Math.max(0, Math.ceil(ROUND_TIME - s.t))
    for (const side of [0, 1] as Side[]) {
      ctx.save()
      ctx.translate(lx + laneW * 0.82, side === 0 ? h / 2 + 18 : h / 2 - 18)
      if (side === 1) ctx.rotate(Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.font = `900 20px 'Zen Maru Gothic', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(left), 0, 0)
      ctx.restore()
    }
  }

  // タップした所の輪
  for (const rp of ripples) {
    const k = rp.t / 0.45
    ctx.beginPath()
    ctx.arc(rp.x, rp.y, 14 + k * 36, 0, Math.PI * 2)
    ctx.strokeStyle = SIDE_COLOR[rp.side]
    ctx.globalAlpha = 1 - k
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
