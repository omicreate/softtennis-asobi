/**
 * ラインぎわ ストップ（ふたり）の画面。机に置いて上下で向かい合う。
 * それぞれの半分に、ネットから自分のベースラインへ向かうコートの帯がある。ボールが転がってくるので、
 * 自分の半分のどこかをタップして止める。ラインの横の「ルーペ」で、ラインぎわを大きく見せる。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { SIDE_COLOR, SIDE_NAME } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { useStage } from '../../core/Stage'
import { PHRASES } from '../../core/voiceLines'
import { usePlay } from '../../shell/playContext'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { drawPikuruArt } from '../../ui/pikuruArt'
import { BALL_R, callText, CONTACT, createLs, LINE, LINE_W, ROUNDS_TO_WIN, stepLs, stopBall } from './linestop'
import type { Call, LsState } from './linestop'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

/** 見せる範囲（cm）：ラインの手前 2.2m から、ラインの先 0.5m まで */
const VIEW0 = LINE - 220
const VIEW1 = LINE + 50

export function LineStopGame({ levels, paused, onRestart }: Props) {
  const stage = useStage()
  const play = usePlay()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useMemo<LsState>(() => createLs(levels), [levels])
  const noticeTimer = useRef(0)
  const [wins, setWins] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>({ title: 'ラインの ぎりぎりで ストップ！', sub: 'こえたら アウト', face: 'think' })
  const [over, setOver] = useState<Side | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __ls?: LsState }).__ls = game
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
      for (const ev of stepLs(game, dt)) {
        switch (ev.type) {
          case 'go':
            sfx.whistle()
            setNotice(null)
            break
          case 'stop':
            if (ev.call.kind === 'out') sfx.ng()
            else sfx.tick()
            break
          case 'round': {
            const w = ev.winner
            setWins(ev.wins)
            if (w === null) {
              sfx.bounce()
              setNotice({ title: 'ひきわけ', sub: `${callText(ev.calls[0])}・${callText(ev.calls[1])}`, face: 'think' })
            } else {
              sfx.ok()
              speak(w === 0 ? PHRASES.point0 : PHRASES.point1)
              setNotice({
                title: `${SIDE_NAME[w]}の かち！`,
                sub: `${SIDE_NAME[0]} ${callText(ev.calls[0])}・${SIDE_NAME[1]} ${callText(ev.calls[1])}`,
                faces: [w === 0 ? 'ok' : 'oops', w === 1 ? 'ok' : 'oops'],
              })
            }
            noticeTimer.current = 2.4
            break
          }
          case 'over':
            sfx.fanfare()
            speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            setNotice(null)
            play.finish({ winner: ev.winner })
            setOver(ev.winner)
            break
        }
      }
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, stage.w, stage.h, game)
  })

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    if (paused || over !== null) return
    const p = stage.toLogical(e.clientX, e.clientY)
    stopBall(game, p.y < stage.h / 2 ? 1 : 0)
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block', touchAction: 'none' }}
        data-testid="linestop-canvas"
        onPointerDown={onDown}
        onContextMenu={(e) => e.preventDefault()}
      />
      <Scores score={wins} />
      <Notice data={notice} />
      {over !== null && (
        <Result
          title={(side) => (side === over ? 'かち！ ナイスジャッジ' : 'おしい！')}
          sub={(side) => `${wins[side]} たい ${wins[side === 0 ? 1 : 0]}（さきに ${ROUNDS_TO_WIN}かい）`}
          face={(side) => (side === over ? 'ok' : 'oops')}
          onAgain={onRestart}
        />
      )}
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: LsState) {
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, w, h)
  for (const side of [0, 1] as Side[]) {
    ctx.save()
    // 上の人の半分は180°回して、どちらも「自分の方へ転がってくる」ように描く
    if (side === 1) {
      ctx.translate(w, h)
      ctx.rotate(Math.PI)
    }
    ctx.translate(0, h / 2)
    drawHalf(ctx, w, h / 2, s, side)
    ctx.restore()
  }
  // ネット
  ctx.fillStyle = '#12302b'
  ctx.fillRect(0, h / 2 - 2, w, 4)
}

/** 半分（上がネット、下が自分のベースライン）を描く */
function drawHalf(ctx: CanvasRenderingContext2D, w: number, hh: number, s: LsState, side: Side) {
  const top = 30
  const bottom = 86
  const laneW = Math.min(w * 0.36, 170)
  const lx = w * 0.42 - laneW / 2
  const k = (hh - top - bottom) / (VIEW1 - VIEW0)
  const Y = (pos: number) => top + (pos - VIEW0) * k
  const cx = lx + laneW / 2

  // コート（ラインの外は外の色）
  ctx.fillStyle = '#2f5d9a'
  ctx.fillRect(lx, 0, laneW, Y(LINE))
  ctx.fillStyle = '#24497a'
  ctx.fillRect(lx, Y(LINE), laneW, hh - Y(LINE))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(lx, Y(LINE), laneW, LINE_W * k)
  ctx.font = `900 13px 'Zen Maru Gothic', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('ベースライン', cx, Y(LINE + LINE_W) + 4)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText('アウト', cx, Y(LINE + 30))

  // ボール（本物の大きさの比率）
  const lane = s.lanes[side]
  const show = s.phase !== 'ready' && lane.pos >= VIEW0 - BALL_R
  if (show) ball(ctx, cx, Y(lane.pos), Math.max(2.5, BALL_R * k))

  // ルーペ：ラインのまわりを大きく
  const lr = Math.min(64, (w - (lx + laneW)) * 0.42)
  const lcx = lx + laneW + 14 + lr
  const lcy = Y(LINE) - 6
  const zk = (lr * 2) / 40 // 40cm を直径に
  ctx.save()
  ctx.beginPath()
  ctx.arc(lcx, lcy, lr, 0, Math.PI * 2)
  ctx.clip()
  const ZY = (pos: number) => lcy + (pos - LINE - LINE_W / 2) * zk
  ctx.fillStyle = '#2f5d9a'
  ctx.fillRect(lcx - lr, lcy - lr, lr * 2, ZY(LINE) - (lcy - lr))
  ctx.fillStyle = '#24497a'
  ctx.fillRect(lcx - lr, ZY(LINE), lr * 2, lcy + lr - ZY(LINE))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(lcx - lr, ZY(LINE), lr * 2, LINE_W * zk)
  if (show) {
    ball(ctx, lcx, ZY(lane.pos), BALL_R * zk)
    // 地面に触れている所（真下）
    ctx.beginPath()
    ctx.arc(lcx, ZY(lane.pos), Math.max(2, CONTACT * zk), 0, Math.PI * 2)
    ctx.fillStyle = '#ff3b3b'
    ctx.fill()
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(lcx, lcy, lr, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = '#12302b'
  ctx.stroke()
  ctx.fillStyle = '#12302b'
  ctx.font = `900 12px 'Zen Maru Gothic', sans-serif`
  ctx.textBaseline = 'top'
  // 2行に分け、画面の はしで 切れないように 中心を内側へ寄せる
  const notes = ['ルーペ', 'あかい てん＝じめん']
  const half = Math.max(...notes.map((t) => ctx.measureText(t).width)) / 2
  const nx = Math.min(lcx, w - half - 6)
  notes.forEach((t, i) => ctx.fillText(t, nx, lcy + lr + 4 + i * 15))

  // ピクルくん（ラインジャッジ）
  drawPikuruArt(ctx, s.calls[side]?.kind === 'out' ? 'oops' : s.calls[side] ? 'ok' : 'think', lx / 2, Y(LINE) + 30, Math.min(90, lx * 0.9))

  // 下の文：止めた結果・タップの合図
  const call = s.calls[side]
  // 左下の点数（はば 74px）に かからないよう、その右に書く
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SIDE_COLOR[side]
  ctx.font = `900 22px 'Zen Maru Gothic', sans-serif`
  const msg = call ? resultText(call, lane.byTap) : s.phase === 'roll' ? 'タップで ストップ！' : s.phase === 'ready' ? 'じゅんび…' : ''
  ctx.fillText(msg, (w + 84) / 2, hh - bottom / 2 - 6, w - 96)
}

function resultText(c: Call, byTap: boolean): string {
  const t = callText(c)
  return byTap ? t : `とまった：${t}`
}

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = Math.max(1, r * 0.14)
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  if (r > 8) {
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
}
