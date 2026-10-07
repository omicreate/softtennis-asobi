/**
 * ソフトテニスのラケットの絵（土台にした pickle-asobi の名残で、型や関数の名前は Paddle のまま）。
 * 形：楕円の頭（フレーム＋ガット）・のど（2本の腕が合わさる）・シャフト・グリップ・グリップエンド。
 * 比率は実物に近く：頭の長さ31cm・幅24cm、のど18cm、グリップ19cm（全長およそ68cm）。
 * どのゲームでも、この比率をくずさず（横長にのばしたりつぶしたりせず）に大きさだけ変える。
 * 色はフレームに、もようはガットの上のステンシル（実物と同じ場所）に描く。
 * 当たり判定は形や もように関係なく同じ（ふたりで遊ぶときに不公平にならないように）。
 */

/** 頭の幅 ÷ 頭の長さ（スタンダード） */
export const FACE_RATIO = 24 / 31
/** グリップ（のど＋グリップ）の長さ ÷ 頭の長さ（スタンダード） */
export const GRIP_RATIO = 37 / 31

const OUTLINE = '#1d2b22'
const GRIP = '#22302a'
const CAP = '#0f1712'
const STRING = 'rgba(255, 255, 255, 0.78)'

export type PaddleShape = 'std' | 'long' | 'wide' | 'round'

export interface ShapeInfo {
  label: string
  /** 大きさ（全体の長さと頭の幅） */
  size: string
  /** 頭の幅 ÷ 頭の長さ */
  ratio: number
  /** のど＋グリップの長さ ÷ 頭の長さ */
  grip: number
  /** のどの長さの割合（のど＋グリップのうち） */
  throat: number
  /** 本物の頭の長さ（cm） */
  faceCm: number
}

/** ラケットのかたち。どれも実物にある範囲（全長およそ66〜69cm）の形 */
export const SHAPES: Record<PaddleShape, ShapeInfo> = {
  std: { label: 'スタンダード', size: 'ながさ 68cm・はば 24cm', ratio: FACE_RATIO, grip: GRIP_RATIO, throat: 0.49, faceCm: 31 },
  long: { label: 'ロング', size: 'ながさ 69cm・はば 23cm', ratio: 23 / 32, grip: 37 / 32, throat: 0.51, faceCm: 32 },
  wide: { label: 'デカヘッド', size: 'ながさ 68cm・はば 26cm', ratio: 26 / 32, grip: 36 / 32, throat: 0.47, faceCm: 32 },
  round: { label: 'まるがた', size: 'ながさ 66cm・はば 25cm', ratio: 25 / 29, grip: 37 / 29, throat: 0.49, faceCm: 29 },
}

export type Pattern = 'plain' | 'dots' | 'stripe' | 'star' | 'heart' | 'band' | 'rainbow' | 'gold'

export interface Design {
  label: string
  base: string
  pattern: Pattern
  accent?: string
}

/** ラケットの色（フレーム）と もよう（ガットのステンシル） */
export const DESIGNS = {
  orange: { label: 'オレンジ', base: '#ff8a3d', pattern: 'plain' },
  blue: { label: 'あお', base: '#3d9be9', pattern: 'plain' },
  lime: { label: 'ライム', base: '#c6e83a', pattern: 'plain' },
  red: { label: 'あか', base: '#e5533d', pattern: 'plain' },
  dots: { label: 'みずたま', base: '#ff7eb6', pattern: 'dots', accent: '#ff7eb6' },
  stripe: { label: 'しましま', base: '#12302b', pattern: 'stripe', accent: '#c6e83a' },
  star: { label: 'ほし', base: '#8b5cf6', pattern: 'star', accent: '#ffd84d' },
  heart: { label: 'ハート', base: '#ffffff', pattern: 'heart', accent: '#ff5d8f' },
  hawk: { label: 'ホークアイ先生 モデル', base: '#1f8a5b', pattern: 'band', accent: '#e4262c' },
  rainbow: { label: 'にじいろ', base: '#ff8a3d', pattern: 'rainbow' },
  gold: { label: 'きんいろ', base: '#f5c400', pattern: 'gold' },
  ocean: { label: 'うみ', base: '#3d9be9', pattern: 'stripe', accent: '#ffffff' },
  sakura: { label: 'さくら', base: '#ffc2d9', pattern: 'heart', accent: '#ff5d8f' },
  yozora: { label: 'よぞら', base: '#24497a', pattern: 'star', accent: '#ffd84d' },
  champion: { label: 'チャンピオン', base: '#12302b', pattern: 'star', accent: '#f5c400' },
} satisfies Record<string, Design>

export type DesignId = keyof typeof DESIGNS

/** ラケットの見た目（色・もよう と かたち）。tint があれば その色の むじ（じゅんばんモードの人の色） */
export interface PaddleLook {
  design: DesignId
  shape: PaddleShape
  tint?: string
}

export const DEFAULT_LOOKS: [PaddleLook, PaddleLook] = [
  { design: 'orange', shape: 'std' },
  { design: 'blue', shape: 'std' },
]

export interface PaddleArt {
  /** 頭（打つ面）の中心（px） */
  x: number
  y: number
  /** 頭の長さ（px）。幅と のど・グリップはこれから決まる */
  faceLen: number
  /** グリップから頭の先へ向かう向き（ラジアン。0＝右へ） */
  angle: number
  /** フレームの色（look が無いとき） */
  color?: string
  /** コレクションの見た目（色・もよう・かたち） */
  look?: PaddleLook
}

function designOf(p: PaddleArt): Design {
  if (p.look?.tint) return { label: '', base: p.look.tint, pattern: 'plain' }
  if (p.look) return DESIGNS[p.look.design] ?? DESIGNS.orange
  return { label: '', base: p.color ?? DESIGNS.orange.base, pattern: 'plain' }
}

export function drawPaddleArt(ctx: CanvasRenderingContext2D, p: PaddleArt): void {
  const shape = SHAPES[p.look?.shape ?? 'std'] ?? SHAPES.std
  const design = designOf(p)
  const L = p.faceLen
  const W = L * shape.ratio
  const T = L * shape.grip * shape.throat
  const G = L * shape.grip - T
  const frame = Math.max(2, W * 0.1)
  const line = Math.max(1, W * 0.035)
  const gw = W * 0.16
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)

  // グリップ（シャフトの先から）とグリップエンド
  const g0 = -L / 2 - T
  ctx.beginPath()
  ctx.roundRect(g0 - G, -gw / 2, G + gw * 0.4, gw, gw * 0.3)
  ctx.fillStyle = GRIP
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = Math.max(1, gw * 0.12)
  for (let x = g0 - G + gw * 0.5; x < g0; x += gw * 0.7) {
    ctx.beginPath()
    ctx.moveTo(x, -gw / 2)
    ctx.lineTo(x + gw * 0.35, gw / 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(g0 - G, 0, gw * 0.3, gw * 0.62, 0, 0, Math.PI * 2)
  ctx.fillStyle = CAP
  ctx.fill()

  // のど：頭の根元の左右から、シャフトへ2本の腕
  const color = frameFill(ctx, design, L)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const arm = (side: number) => {
    ctx.beginPath()
    ctx.moveTo(-L / 2 + L * 0.12, side * W * 0.36)
    ctx.quadraticCurveTo(-L / 2 - T * 0.35, side * W * 0.14, g0, side * gw * 0.18)
  }
  for (const side of [-1, 1]) {
    arm(side)
    ctx.lineWidth = frame + line * 2
    ctx.strokeStyle = OUTLINE
    ctx.stroke()
    arm(side)
    ctx.lineWidth = frame
    ctx.strokeStyle = color
    ctx.stroke()
  }

  // 頭：ガット（白い網）→ ステンシル → フレーム
  const rx = L / 2
  const ry = W / 2
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0, rx - frame / 2, ry - frame / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = STRING
  ctx.lineWidth = Math.max(0.6, W * 0.012)
  const step = W * 0.085
  for (let x = -rx; x <= rx; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, -ry)
    ctx.lineTo(x, ry)
    ctx.stroke()
  }
  for (let y = -ry; y <= ry; y += step) {
    ctx.beginPath()
    ctx.moveTo(-rx, y)
    ctx.lineTo(rx, y)
    ctx.stroke()
  }
  if (design.pattern !== 'plain' && design.pattern !== 'rainbow' && design.pattern !== 'gold') drawPattern(ctx, design, L, W)
  ctx.restore()

  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.lineWidth = frame + line * 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.lineWidth = frame
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.restore()
}

function frameFill(ctx: CanvasRenderingContext2D, d: Design, L: number): string | CanvasGradient {
  if (d.pattern === 'rainbow') {
    const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0)
    ;['#ff6f6f', '#ffb23d', '#ffe24d', '#7fd36b', '#4fb3ff', '#9b7bff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c))
    return g
  }
  if (d.pattern === 'gold') {
    const g = ctx.createLinearGradient(-L / 2, -L / 4, L / 2, L / 4)
    g.addColorStop(0, '#c99a00')
    g.addColorStop(0.45, '#ffe680')
    g.addColorStop(0.55, '#fff4c2')
    g.addColorStop(1, '#d9a900')
    return g
  }
  return d.base
}

/** ガットの上のステンシル（頭の中だけに描く）。x が頭の長さの向き（+x がラケットの先） */
function drawPattern(ctx: CanvasRenderingContext2D, d: Design, L: number, W: number) {
  const accent = d.accent ?? '#ffffff'
  ctx.fillStyle = accent
  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.85
  switch (d.pattern) {
    case 'dots': {
      const r = W * 0.06
      const step = W * 0.24
      for (let i = -2; i <= 2; i++) {
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath()
          ctx.arc(i * step + (j % 2 ? step / 2 : 0), j * step * 0.86, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'stripe': {
      ctx.lineWidth = W * 0.08
      for (let i = -4; i <= 4; i++) {
        const x = i * W * 0.26
        ctx.beginPath()
        ctx.moveTo(x - W, -W)
        ctx.lineTo(x + W, W)
        ctx.stroke()
      }
      break
    }
    case 'star':
      star(ctx, L * 0.02, 0, W * 0.3)
      break
    case 'heart':
      heart(ctx, L * 0.02, 0, W * 0.28)
      break
    case 'band': {
      // ホークアイ先生のバンダナの「IQ」をガットに
      ctx.save()
      ctx.rotate(Math.PI / 2)
      ctx.font = `900 ${Math.round(W * 0.42)}px 'Zen Maru Gothic', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('IQ', 0, W * 0.02)
      ctx.restore()
      break
    }
  }
  ctx.globalAlpha = 1
}

/** 星（先が +x を向く＝ラケットの先の方を上にしたとき、まっすぐ立つ） */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

/** ハート（とがった方がグリップの向き） */
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 2)
  ctx.beginPath()
  ctx.moveTo(0, r * 0.9)
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.4)
  ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9)
  ctx.fill()
  ctx.restore()
}
