/** ラリーの絵（canvas）。コートは上から見た図で、上下どちらの人にも同じ向きで見せる */
import { SIDE_COLOR } from '../../core/players'
import type { Side } from '../../core/players'
import { COURT, inKitchen, serveHalf, toNet } from './court'
import { hand, MACHINE, SWING_TIME } from './engine'
import type { RallyEngine } from './engine'
import { predictLanding } from './physics'
import { drawPaddleArt } from '../../ui/paddleArt'
import type { PaddleLook } from '../../ui/paddleArt'
import { drawPikuruArt } from '../../ui/pikuruArt'
import type { Face } from '../../ui/Pikuru'

/**
 * 本物のパドルの大きさ（m）：全長16インチ・幅8インチ、握り5インチ（よくある形）。
 * ルールは「長さ＋幅が61cm以内、長さ43cm以内」（PBK-0044）。
 */
export const PADDLE = { length: 0.406, width: 0.203, grip: 0.127 }
/** 上から見るとパドルも人も小さすぎて見えないので、同じ倍率で大きく描く（形と比率はそのまま） */
const VIS = 1.6
/** ピクルくん（コンピューター）の色 */
const PICKLE = '#6bb33f'

export interface View {
  scale: number
  ox: number
  oy: number
}

/** 画面に見せる範囲（コートの外も少し動けるように余白をとる） */
const VIEW = { x0: -1.0, x1: COURT.W + 1.0, y0: -1.9, y1: COURT.L + 1.9 }

/** topExtra：上に空ける分（m）。ねらってショットは、上の案内とボールマシンが重ならないように空ける */
export function makeView(w: number, h: number, topExtra = 0): View {
  const y0 = VIEW.y0 - topExtra
  const vw = VIEW.x1 - VIEW.x0
  const vh = VIEW.y1 - y0
  const scale = Math.min(w / vw, h / vh)
  return {
    scale,
    ox: (w - vw * scale) / 2 - VIEW.x0 * scale,
    oy: (h - vh * scale) / 2 - y0 * scale,
  }
}

export const toWorld = (v: View, x: number, y: number) => ({ x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale })

const C = {
  bg: '#ffe7b8',
  out: '#24497a',
  court: '#2f5d9a',
  kitchen: '#3d8f7a',
  kitchenHot: '#5fb79f',
  line: '#ffffff',
  net: '#12302b',
  ball: '#d4f03c',
  ballLine: '#2e5a1c',
  shadow: 'rgba(0, 0, 0, 0.28)',
  target: 'rgba(212, 240, 60, 0.22)',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export interface DrawOptions {
  showLanding: boolean
  realRules: boolean
  /** ひとりで遊ぶ（上の文字も回さない） */
  solo?: boolean
  /** ピクルくん（相手・ボールマシンの係）の表情 */
  pikuruFace?: Face
  /** パドルの見た目（コレクション） */
  paddles?: [PaddleLook, PaddleLook]
}

export function drawRally(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, e: RallyEngine, o: DrawOptions): void {
  const s = v.scale
  const X = (x: number) => v.ox + x * s
  const Y = (y: number) => v.oy + y * s

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, w, h)

  // まわり・コート・キッチン
  ctx.fillStyle = C.out
  roundRect(ctx, X(VIEW.x0), Y(VIEW.y0), (VIEW.x1 - VIEW.x0) * s, (VIEW.y1 - VIEW.y0) * s, 18)
  ctx.fill()
  ctx.fillStyle = C.court
  ctx.fillRect(X(0), Y(0), COURT.W * s, COURT.L * s)

  for (const side of [0, 1] as Side[]) {
    const p = e.paddles[side]
    // ほんかくルール：パドルがキッチンに入っているとキッチンを明るくして気づかせる
    const hot = o.realRules && e.phase === 'play' && inKitchen(p.y) && (side === 0 ? p.y > COURT.NET_Y : p.y < COURT.NET_Y)
    ctx.fillStyle = hot ? C.kitchenHot : C.kitchen
    const y0 = side === 0 ? COURT.NET_Y : COURT.NET_Y - COURT.KITCHEN
    ctx.fillRect(X(0), Y(y0), COURT.W * s, COURT.KITCHEN * s)
  }

  // サーブのとき（ほんかく）：入れるべき対角のサービスコートを光らせる
  if (o.realRules && e.phase === 'serve' && e.opts.kind === 'versus') {
    const server = e.server
    const half = serveHalf(server, e.score[server])
    // サーバーが x の大きい側なら、相手コートの x の小さい側
    const xs = half === 'high' ? 0 : COURT.W / 2
    const ys = server === 0 ? 0 : COURT.NET_Y + COURT.KITCHEN
    ctx.fillStyle = C.target
    ctx.fillRect(X(xs), Y(ys), (COURT.W / 2) * s, (COURT.NET_Y - COURT.KITCHEN) * s)
  }

  // ライン
  ctx.strokeStyle = C.line
  ctx.lineWidth = Math.max(2, 0.06 * s)
  ctx.strokeRect(X(0), Y(0), COURT.W * s, COURT.L * s)
  ctx.beginPath()
  for (const ky of [COURT.NET_Y - COURT.KITCHEN, COURT.NET_Y + COURT.KITCHEN]) {
    ctx.moveTo(X(0), Y(ky))
    ctx.lineTo(X(COURT.W), Y(ky))
  }
  ctx.moveTo(X(COURT.W / 2), Y(0))
  ctx.lineTo(X(COURT.W / 2), Y(COURT.NET_Y - COURT.KITCHEN))
  ctx.moveTo(X(COURT.W / 2), Y(COURT.NET_Y + COURT.KITCHEN))
  ctx.lineTo(X(COURT.W / 2), Y(COURT.L))
  ctx.stroke()

  // 「キッチン」の文字（それぞれの人から読める向き）
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.font = `900 ${Math.round(0.62 * s)}px 'Zen Maru Gothic', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const side of [0, 1] as Side[]) {
    const cy = COURT.NET_Y - toNet(side) * (COURT.KITCHEN / 2)
    ctx.save()
    ctx.translate(X(COURT.W / 2), Y(cy))
    if (side === 1 && !o.solo) ctx.rotate(Math.PI)
    ctx.fillText('キッチン', 0, 0)
    ctx.restore()
  }

  // ネット
  const ny = Y(COURT.NET_Y)
  ctx.fillStyle = C.net
  ctx.fillRect(X(-0.35), ny - 0.07 * s, (COURT.W + 0.7) * s, 0.14 * s)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(X(-0.35), ny - 0.025 * s, (COURT.W + 0.7) * s, 0.05 * s)
  for (const px of [-0.35, COURT.W + 0.35]) {
    ctx.beginPath()
    ctx.arc(X(px), ny, 0.16 * s, 0, Math.PI * 2)
    ctx.fillStyle = C.net
    ctx.fill()
  }

  // 落ちる場所の目印（小さい子が球の行き先をつかみやすいように）
  const b = e.ball
  if (o.showLanding && e.phase === 'play' && b.bounces === 0 && e.ballVisible) {
    const at = predictLanding(b)
    ctx.beginPath()
    ctx.ellipse(X(at.x), Y(at.y), 0.32 * s, 0.32 * s, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(212, 240, 60, 0.55)'
    ctx.lineWidth = Math.max(2, 0.05 * s)
    ctx.setLineDash([0.12 * s, 0.1 * s])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ねらってショット：的とボールマシン
  if (e.opts.kind === 'target') {
    const z = e.zone
    if (z && e.phase !== 'over') {
      ctx.fillStyle = 'rgba(212, 240, 60, 0.3)'
      ctx.fillRect(X(z.x0), Y(z.y0), (z.x1 - z.x0) * s, (z.y1 - z.y0) * s)
      ctx.strokeStyle = C.ball
      ctx.lineWidth = Math.max(2, 0.07 * s)
      ctx.setLineDash([0.25 * s, 0.15 * s])
      ctx.strokeRect(X(z.x0), Y(z.y0), (z.x1 - z.x0) * s, (z.y1 - z.y0) * s)
      ctx.setLineDash([])
    }
    drawMachine(ctx, X, Y, s, o.pikuruFace ?? 'think')
  }

  // 選手とパドル（当たり判定の「とどく範囲」もうすく見せる）
  for (const side of [0, 1] as Side[]) {
    if (e.opts.kind === 'target' && side === 1) continue
    drawPlayer(ctx, X, Y, s, e, side, o.pikuruFace ?? 'think', o.paddles?.[side])
  }

  // 球（影で高さを見せる）
  if (e.ballVisible) {
    const r = 0.15
    const lift = Math.max(0, b.z)
    ctx.beginPath()
    ctx.ellipse(X(b.x + lift * 0.22), Y(b.y + lift * 0.22), r * s, r * 0.8 * s, 0, 0, Math.PI * 2)
    ctx.fillStyle = C.shadow
    ctx.fill()
    const rr = r * (1 + lift * 0.2) * s
    ctx.beginPath()
    ctx.arc(X(b.x), Y(b.y), rr, 0, Math.PI * 2)
    ctx.fillStyle = C.ball
    ctx.fill()
    ctx.lineWidth = Math.max(1.5, 0.035 * s)
    ctx.strokeStyle = C.ballLine
    ctx.stroke()
    // 穴（ピックルボールの球は穴あき）
    ctx.fillStyle = C.ballLine
    for (const [dx, dy] of [
      [-0.35, -0.25],
      [0.3, -0.3],
      [0.05, 0.35],
    ]) {
      ctx.beginPath()
      ctx.arc(X(b.x) + dx * rr, Y(b.y) + dy * rr, rr * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

type Px = (v: number) => number

function drawMachine(ctx: CanvasRenderingContext2D, X: Px, Y: Px, s: number, face: Face) {
  const w = 1.4
  const h = 0.7
  // マシンの係のピクルくん（マシンの右に立つ。打った球が入ると喜ぶ）
  drawPikuruArt(ctx, face, X(MACHINE.x + 1.25), Y(MACHINE.y + h / 2 + 0.05), 1.15 * s)
  roundRect(ctx, X(MACHINE.x - w / 2), Y(MACHINE.y - h / 2), w * s, h * s, 0.18 * s)
  ctx.fillStyle = PICKLE
  ctx.fill()
  ctx.lineWidth = Math.max(2, 0.05 * s)
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  // 球の出口
  ctx.fillStyle = '#2e5a1c'
  ctx.fillRect(X(MACHINE.x - 0.16), Y(MACHINE.y + h / 2 - 0.02), 0.32 * s, 0.28 * s)
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 ${Math.round(0.3 * s)}px 'Zen Maru Gothic', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ピクルマシン', X(MACHINE.x), Y(MACHINE.y))
}

/**
 * 選手・腕・パドル。人は上から見た肩と頭、ピクルくん（コンピューター）は原画の絵で描く。
 * パドルの先は、球が来るとその方へ伸びる（engine の head）。打った瞬間は前へ振る（swingT）。
 * うすい帯が「とどく範囲」＝当たり判定。小さい子のレベルほど広い。
 * パドルはいつも原画と同じ形・比率（ui/paddleArt.ts）。
 */
function drawPlayer(ctx: CanvasRenderingContext2D, X: Px, Y: Px, s: number, e: RallyEngine, side: Side, face: Face, look?: PaddleLook) {
  const p = e.paddles[side]
  const n = toNet(side)
  const cpu = e.opts.cpu === side
  const color = cpu ? PICKLE : SIDE_COLOR[side]

  // とどく範囲
  roundRect(ctx, X(p.x - p.width / 2), Y(p.y - 0.14), p.width * s, 0.28 * s, 0.14 * s)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fill()
  ctx.setLineDash([0.12 * s, 0.1 * s])
  ctx.lineWidth = Math.max(1.5, 0.03 * s)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.7
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])

  const bx = p.x
  const by = p.y - n * 0.55

  // パドルの面の中心（振る瞬間は前へ押し出す）
  const u = e.swingT[side] > 0 ? 1 - e.swingT[side] / SWING_TIME : 0
  const punch = u > 0 ? Math.sin(u * Math.PI) * 0.4 : 0
  const hx = p.x + e.head[side]
  const hy = p.y + n * punch
  // 肩：パドルのある側（フォアかバックか）
  const toward = Math.sign(e.head[side]) || hand(side)
  const sx = bx + toward * 0.2 * VIS
  const sy = by
  let dx = hx - sx
  let dy = hy - sy
  const d = Math.hypot(dx, dy) || 1
  dx /= d
  dy /= d
  const faceLen = (PADDLE.length - PADDLE.grip) * VIS
  const gripLen = PADDLE.grip * VIS
  const gx = hx - dx * (faceLen / 2 + gripLen)
  const gy = hy - dy * (faceLen / 2 + gripLen)

  // 腕
  ctx.beginPath()
  ctx.moveTo(X(sx), Y(sy))
  ctx.lineTo(X(gx), Y(gy))
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(3, 0.08 * VIS * s)
  ctx.strokeStyle = cpu ? '#2e5a1c' : '#f2c7a0'
  ctx.stroke()

  if (cpu) {
    // ピクルくん（原画）。表情は試合の流れで変わる
    drawPikuruArt(ctx, face, X(bx), Y(by + 0.32 * VIS), 0.95 * VIS * s)
  } else {
    // 人（上から見た肩と頭）
    ctx.beginPath()
    ctx.ellipse(X(bx), Y(by), 0.24 * VIS * s, 0.13 * VIS * s, 0, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = Math.max(1.5, 0.03 * s)
    ctx.strokeStyle = '#12302b'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(X(bx), Y(by), 0.11 * VIS * s, 0, Math.PI * 2)
    ctx.fillStyle = '#4a3426'
    ctx.fill()
    ctx.stroke()
  }

  // パドル（原画と同じ形。比率はくずさない）
  drawPaddleArt(ctx, { x: X(hx), y: Y(hy), faceLen: faceLen * s, angle: Math.atan2(dy, dx), color: cpu ? '#ff8a3d' : color, look: cpu ? undefined : look })
}
