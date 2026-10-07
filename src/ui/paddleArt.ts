/**
 * パドルの絵。ピクルくんの原画（ブランド/ピクルくん）のパドルと同じ形で描く：
 * 角の丸い面・内側の明るい縁・濃い緑の輪郭・握り・握りの端のキャップ。
 * 比率は本物どおり（面の長さ28cm：幅20cm、握り13cm。ルールは長さ＋幅61cm以内・長さ43cm以内）。
 * どのゲームでも、この比率をくずさず（横長にのばしたりつぶしたりせず）に大きさだけ変える。
 *
 * コレクションで集める「かたち」も、ルール（PBK-0044・3.D.2：長さ＋幅61cm以内、長さ43.18cm以内）の
 * 中におさまる本物の形だけにする。色や もようは面の中に描く（形はくずさない）。
 * 当たり判定は形や もように関係なく同じ（ふたりで遊ぶときに不公平にならないように）。
 */

/** 面の幅 ÷ 面の長さ（スタンダード） */
export const FACE_RATIO = 20 / 28
/** 握りの長さ ÷ 面の長さ（スタンダード） */
export const GRIP_RATIO = 13 / 28

const OUTLINE = '#2e5a1c'
const GRIP = '#2e5a1c'
const CAP = '#12302b'

export type PaddleShape = 'std' | 'long' | 'wide' | 'round'

export interface ShapeInfo {
  label: string
  /** 大きさ（握りを入れた全体の長さと幅） */
  size: string
  /** 面の幅 ÷ 面の長さ */
  ratio: number
  /** 握りの長さ ÷ 面の長さ */
  grip: number
  /** 角の丸み（面の幅に対する割合。0.5 で まるい頭） */
  corner: number
  /** 本物の面の長さ（cm）。ルールに合っているかのテストに使う */
  faceCm: number
}

/**
 * パドルのかたち。どれも長さ＋幅が61cm（24インチ）以内・長さ43.18cm（17インチ）以内。
 * ながめ：17×7インチ（43.2×17.8cm、握り14cm）。ひろめ：15.25×8.75インチ（38.7×22.2cm、握り12.1cm）。
 */
export const SHAPES: Record<PaddleShape, ShapeInfo> = {
  std: { label: 'スタンダード', size: 'ながさ 41cm・はば 20cm', ratio: FACE_RATIO, grip: GRIP_RATIO, corner: 0.36, faceCm: 28 },
  long: { label: 'ながめ', size: 'ながさ 43cm・はば 18cm', ratio: 17.8 / 29.2, grip: 14 / 29.2, corner: 0.36, faceCm: 29.2 },
  wide: { label: 'ひろめ', size: 'ながさ 39cm・はば 22cm', ratio: 22.2 / 26.6, grip: 12.1 / 26.6, corner: 0.3, faceCm: 26.6 },
  round: { label: 'まるがた', size: 'ながさ 41cm・はば 20cm', ratio: FACE_RATIO, grip: GRIP_RATIO, corner: 0.5, faceCm: 28 },
}

export type Pattern = 'plain' | 'dots' | 'stripe' | 'star' | 'heart' | 'band' | 'rainbow' | 'gold'

export interface Design {
  label: string
  base: string
  pattern: Pattern
  accent?: string
}

/** パドルの色と もよう */
export const DESIGNS = {
  orange: { label: 'オレンジ', base: '#ff8a3d', pattern: 'plain' },
  blue: { label: 'あお', base: '#3d9be9', pattern: 'plain' },
  lime: { label: 'ライム', base: '#d4f03c', pattern: 'plain' },
  red: { label: 'あか', base: '#e5533d', pattern: 'plain' },
  dots: { label: 'みずたま', base: '#ff7eb6', pattern: 'dots', accent: '#ffffff' },
  stripe: { label: 'しましま', base: '#12302b', pattern: 'stripe', accent: '#d4f03c' },
  star: { label: 'ほし', base: '#8b5cf6', pattern: 'star', accent: '#ffd84d' },
  heart: { label: 'ハート', base: '#ffffff', pattern: 'heart', accent: '#ff5d8f' },
  pikuru: { label: 'ピクルくん モデル', base: '#6bb33f', pattern: 'band', accent: '#d4f03c' },
  rainbow: { label: 'にじいろ', base: '#ff8a3d', pattern: 'rainbow' },
  gold: { label: 'きんいろ', base: '#f5c400', pattern: 'gold' },
  ocean: { label: 'うみ', base: '#3d9be9', pattern: 'stripe', accent: '#ffffff' },
  sakura: { label: 'さくら', base: '#ffc2d9', pattern: 'heart', accent: '#ff5d8f' },
  yozora: { label: 'よぞら', base: '#24497a', pattern: 'star', accent: '#ffd84d' },
  champion: { label: 'チャンピオン', base: '#12302b', pattern: 'star', accent: '#f5c400' },
} satisfies Record<string, Design>

export type DesignId = keyof typeof DESIGNS

/** パドルの見た目（色・もよう と かたち）。tint があれば その色の むじ（じゅんばんモードの人の色） */
export interface PaddleLook {
  design: DesignId
  shape: PaddleShape
  tint?: string
}

export const DEFAULT_LOOKS: [PaddleLook, PaddleLook] = [
  { design: 'orange', shape: 'std' },
  { design: 'blue', shape: 'std' },
]

/** 色を白に近づける（内側の縁の色） */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const m = (c: number) => Math.round(c + (255 - c) * t)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

export interface PaddleArt {
  /** 面の中心（px） */
  x: number
  y: number
  /** 面の長さ（px）。幅と握りはこれから決まる */
  faceLen: number
  /** 握りから面の先へ向かう向き（ラジアン。0＝右へ） */
  angle: number
  /** 面の色（look が無いとき） */
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
  const G = L * shape.grip
  const gw = W * 0.24
  const line = Math.max(1.5, W * 0.075)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)

  // 握り（面の根元から）とキャップ
  ctx.beginPath()
  ctx.roundRect(-L / 2 - G, -gw / 2, G + W * 0.1, gw, gw * 0.35)
  ctx.fillStyle = GRIP
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-L / 2 - G, 0, gw * 0.32, gw * 0.62, 0, 0, Math.PI * 2)
  ctx.fillStyle = CAP
  ctx.fill()

  // 面
  const face = () => {
    ctx.beginPath()
    ctx.roundRect(-L / 2, -W / 2, L, W, W * shape.corner)
  }
  face()
  ctx.fillStyle = faceFill(ctx, design, L)
  ctx.fill()
  if (design.pattern !== 'plain' && design.pattern !== 'rainbow' && design.pattern !== 'gold') {
    ctx.save()
    face()
    ctx.clip()
    drawPattern(ctx, design, L, W)
    ctx.restore()
  }
  face()
  ctx.lineWidth = line
  ctx.strokeStyle = OUTLINE
  ctx.stroke()

  // 内側の明るい縁
  const inset = W * 0.14
  ctx.beginPath()
  ctx.roundRect(-L / 2 + inset, -W / 2 + inset, L - inset * 2, W - inset * 2, (W - inset * 2) * shape.corner)
  ctx.lineWidth = Math.max(1, W * 0.06)
  ctx.strokeStyle = design.pattern === 'gold' ? 'rgba(255, 250, 220, 0.9)' : design.base === '#ffffff' ? 'rgba(255, 93, 143, 0.35)' : lighten(design.base, 0.5)
  ctx.stroke()
  ctx.restore()
}

function faceFill(ctx: CanvasRenderingContext2D, d: Design, L: number): string | CanvasGradient {
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

/** もよう（面の中だけに描く）。x が面の長さの向き（+x がパドルの先） */
function drawPattern(ctx: CanvasRenderingContext2D, d: Design, L: number, W: number) {
  const accent = d.accent ?? '#ffffff'
  ctx.fillStyle = accent
  ctx.strokeStyle = accent
  switch (d.pattern) {
    case 'dots': {
      const r = W * 0.075
      const step = W * 0.26
      for (let i = -3; i <= 3; i++) {
        for (let j = -2; j <= 2; j++) {
          const x = i * step + (j % 2 ? step / 2 : 0)
          const y = j * step * 0.86
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'stripe': {
      ctx.lineWidth = W * 0.1
      for (let i = -6; i <= 6; i++) {
        const x = i * W * 0.28
        ctx.beginPath()
        ctx.moveTo(x - W, -W)
        ctx.lineTo(x + W, W)
        ctx.stroke()
      }
      break
    }
    case 'star':
      star(ctx, L * 0.05, 0, W * 0.32)
      ctx.globalAlpha = 0.85
      star(ctx, -L * 0.3, W * 0.22, W * 0.1)
      star(ctx, -L * 0.22, -W * 0.25, W * 0.08)
      ctx.globalAlpha = 1
      break
    case 'heart':
      heart(ctx, L * 0.06, 0, W * 0.3)
      heart(ctx, -L * 0.28, W * 0.2, W * 0.12)
      heart(ctx, -L * 0.24, -W * 0.22, W * 0.1)
      break
    case 'band': {
      // ピクルくんのヘッドバンド（ライムに IQ）を面の先に
      const bx = L * 0.12
      const bw = L * 0.2
      ctx.fillRect(bx - bw / 2, -W, bw, W * 2)
      ctx.lineWidth = Math.max(1, W * 0.04)
      ctx.strokeStyle = OUTLINE
      ctx.beginPath()
      ctx.moveTo(bx - bw / 2, -W)
      ctx.lineTo(bx - bw / 2, W)
      ctx.moveTo(bx + bw / 2, -W)
      ctx.lineTo(bx + bw / 2, W)
      ctx.stroke()
      ctx.save()
      ctx.translate(bx, 0)
      ctx.rotate(Math.PI / 2)
      ctx.fillStyle = '#12302b'
      ctx.font = `900 ${Math.round(bw * 0.62)}px 'Zen Maru Gothic', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('IQ', 0, bw * 0.04)
      ctx.restore()
      break
    }
  }
}

/** 星（先が +x を向く＝パドルの先の方を上にしたとき、まっすぐ立つ） */
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

/** ハート（とがった方が握りの向き） */
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
