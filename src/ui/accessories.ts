/**
 * ピクルくんの きせかえ小物。公式の絵（public/hawk/cut-*.png）はそのままで、上に重ねて描く。
 * ブランドの形と色（体・輪郭・ヘッドバンド・「？」のアホ毛）は隠さない位置に置く。
 *
 * 置く場所は絵ごとに、ヘッドバンド（ライム）の位置から決める（scripts で測った値）。
 * 小物は「ヘッドバンドの幅＝1」の大きさで描くので、どの絵・どの大きさでも同じ見た目になる。
 */
import artSize from './artSize.json'
import type { CutArt } from './hawkArt'

export type Slot = 'head' | 'eyes' | 'neck' | 'side' | 'aura'

export const ACCESSORIES = {
  'party-hat': { label: 'パーティー ぼうし', slot: 'head' },
  ribbon: { label: 'リボン', slot: 'head' },
  crown: { label: 'おうかん', slot: 'head' },
  glasses: { label: 'まるめがね', slot: 'eyes' },
  sunglasses: { label: 'サングラス', slot: 'eyes' },
  'star-glasses': { label: 'ほしの めがね', slot: 'eyes' },
  bowtie: { label: 'ちょうネクタイ', slot: 'neck' },
  medal: { label: 'きんメダル', slot: 'neck' },
  flower: { label: 'おはな', slot: 'side' },
  aura: { label: 'キラキラ', slot: 'aura' },
} satisfies Record<string, { label: string; slot: Slot }>

export type AccessoryId = keyof typeof ACCESSORIES

/** 身につけている小物（場所ごとに1つ） */
export type Wear = Partial<Record<Slot, AccessoryId>>

/** 絵の大きさ（px）。scripts/build-art.mjs が原画から測って書く */
export const ART_SIZE = artSize as Record<CutArt, [number, number]>

interface Anchor {
  /** ヘッドバンドの中心と幅、かたむき（ラジアン） */
  cx: number
  cy: number
  b: number
  tilt: number
  /** 両目のまんなか */
  ex: number
  ey: number
}

const SMALL = { b: 96, tilt: -0.21 }
const ANCHORS: Record<CutArt, Anchor> = {
  think: { cx: 58.4, cy: 91.2, ...SMALL, ex: 63, ey: 136 },
  ok: { cx: 103.4, cy: 90.2, ...SMALL, ex: 110, ey: 131 },
  eh: { cx: 79.4, cy: 90.2, ...SMALL, ex: 86, ey: 134 },
  oops: { cx: 71.4, cy: 57.2, ...SMALL, ex: 78, ey: 100 },
  full: { cx: 140.8, cy: 205.9, b: 221, tilt: -0.15, ex: 152, ey: 300 },
  run: { cx: 140.8, cy: 205.9, b: 221, tilt: -0.15, ex: 152, ey: 300 },
}

const INK = '#12302b'
const LINE = '#2e5a1c'

/** ヘッドバンドに沿った向きで、中心から (u, v) だけずらした点（ヘッドバンドの幅＝1） */
function onBand(a: Anchor, u: number, v: number): [number, number] {
  const c = Math.cos(a.tilt)
  const s = Math.sin(a.tilt)
  return [a.cx + (u * c - v * s) * a.b, a.cy + (u * s + v * c) * a.b]
}

/**
 * 小物を描く。ctx の原点は絵の左上、1単位＝絵の1px（呼ぶ側で拡大しておく）。
 * aura（キラキラ）は絵の後ろの光とまわりの星。光は drawWearGlow で絵を描く前に。
 */
export function drawWear(ctx: CanvasRenderingContext2D, art: CutArt, wear: Wear, t = 0): void {
  const a = ANCHORS[art]
  const u = a.b
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (wear.aura) sparkles(ctx, art, t)
  if (wear.neck) {
    // メダルは口にかからないよう、ちょうネクタイより少し下
    const [x, y] = [a.cx + 0.07 * u, a.cy + (wear.neck === 'medal' ? 1.08 : 0.98) * u]
    place(ctx, x, y, 0, u, wear.neck === 'medal' ? medal : bowtie)
  }
  if (wear.side) {
    const [x, y] = onBand(a, -0.5, 0.02)
    place(ctx, x, y, a.tilt, u, flower)
  }
  if (wear.eyes) {
    const draw = wear.eyes === 'sunglasses' ? sunglasses : wear.eyes === 'star-glasses' ? starGlasses : glasses
    place(ctx, a.ex, a.ey, 0, u, draw)
  }
  if (wear.head) {
    const [x, y] = onBand(a, -0.24, -0.12)
    const draw = wear.head === 'crown' ? crown : wear.head === 'ribbon' ? ribbon : partyHat
    place(ctx, x, y, a.tilt - 0.32, u, draw)
  }
  ctx.restore()
}

/** キラキラの後ろの光（絵を描く前に ctx に設定する） */
export function setGlow(ctx: CanvasRenderingContext2D, wear: Wear, px: number): void {
  if (!wear.aura) return
  ctx.shadowColor = 'rgba(255, 214, 0, 0.95)'
  ctx.shadowBlur = Math.max(6, px * 0.06)
}

function place(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, u: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(u, u)
  ctx.lineWidth = 0.022
  ctx.strokeStyle = LINE
  draw(ctx)
  ctx.restore()
}

// 以下、原点が置き場所の中心、1単位＝ヘッドバンドの幅

/** パーティーぼうし（下のまんなかが原点） */
function partyHat(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(-0.17, 0)
  ctx.lineTo(0, -0.46)
  ctx.lineTo(0.17, 0)
  ctx.closePath()
  ctx.fillStyle = '#ff8a3d'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#d4f03c'
  for (const y of [-0.08, -0.22, -0.36]) {
    ctx.beginPath()
    ctx.moveTo(-0.3, y)
    ctx.lineTo(0.3, y - 0.12)
    ctx.lineTo(0.3, y - 0.06)
    ctx.lineTo(-0.3, y + 0.06)
    ctx.fill()
  }
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(-0.17, 0)
  ctx.lineTo(0, -0.46)
  ctx.lineTo(0.17, 0)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -0.48, 0.055, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()
}

/** おうかん（下のまんなかが原点） */
function crown(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(-0.21, 0)
  ctx.lineTo(-0.23, -0.24)
  ctx.lineTo(-0.11, -0.12)
  ctx.lineTo(0, -0.28)
  ctx.lineTo(0.11, -0.12)
  ctx.lineTo(0.23, -0.24)
  ctx.lineTo(0.21, 0)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -0.28, 0, 0)
  g.addColorStop(0, '#fff1a6')
  g.addColorStop(1, '#f2b600')
  ctx.fillStyle = g
  ctx.fill()
  ctx.stroke()
  for (const [x, y, c] of [
    [-0.23, -0.25, '#ff5d8f'],
    [0, -0.3, '#3d9be9'],
    [0.23, -0.25, '#ff5d8f'],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 0.035, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, -0.07, 0.04, 0, Math.PI * 2)
  ctx.fillStyle = '#e5533d'
  ctx.fill()
}

/** リボン（結び目が原点） */
function ribbon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ff5d8f'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, -0.06)
    ctx.bezierCurveTo(s * 0.12, -0.28, s * 0.3, -0.2, s * 0.24, -0.06)
    ctx.bezierCurveTo(s * 0.2, 0.04, s * 0.1, 0.02, 0, -0.06)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, -0.06, 0.05, 0, Math.PI * 2)
  ctx.fillStyle = '#ff8fb3'
  ctx.fill()
  ctx.stroke()
}

/** めがねのつる（両横へ） */
function temples(ctx: CanvasRenderingContext2D, w: number) {
  ctx.beginPath()
  ctx.moveTo(-w, -0.02)
  ctx.lineTo(-w - 0.1, -0.05)
  ctx.moveTo(w, -0.02)
  ctx.lineTo(w + 0.1, -0.05)
  ctx.stroke()
}

/** まるめがね（両目のまんなかが原点） */
function glasses(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.028
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(s * 0.175, 0, 0.15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-0.03, -0.02)
  ctx.quadraticCurveTo(0, -0.05, 0.03, -0.02)
  ctx.stroke()
  temples(ctx, 0.325)
}

/** サングラス */
function sunglasses(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(18, 48, 43, 0.92)'
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.026
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.roundRect(s * 0.175 - 0.155, -0.11, 0.31, 0.21, 0.08)
    ctx.fill()
    ctx.stroke()
    // ひかり
    ctx.beginPath()
    ctx.moveTo(s * 0.175 - 0.09, -0.05)
    ctx.lineTo(s * 0.175 - 0.02, -0.08)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.stroke()
    ctx.strokeStyle = INK
  }
  ctx.beginPath()
  ctx.moveTo(-0.03, -0.06)
  ctx.lineTo(0.03, -0.06)
  ctx.stroke()
  temples(ctx, 0.33)
}

/** ほしの めがね */
function starGlasses(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 0.024
  for (const s of [-1, 1]) {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 0.085 : 0.19
      ctx.lineTo(s * 0.18 + Math.cos(a) * r, Math.sin(a) * r + 0.01)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 216, 77, 0.55)'
    ctx.fill()
    ctx.strokeStyle = '#ff5d8f'
    ctx.stroke()
  }
  ctx.strokeStyle = '#ff5d8f'
  ctx.beginPath()
  ctx.moveTo(-0.05, -0.03)
  ctx.lineTo(0.05, -0.03)
  ctx.stroke()
  temples(ctx, 0.36)
}

/** ちょうネクタイ（結び目が原点） */
function bowtie(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#e5533d'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(s * 0.19, -0.09)
    ctx.quadraticCurveTo(s * 0.22, 0, s * 0.19, 0.09)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.roundRect(-0.04, -0.045, 0.08, 0.09, 0.03)
  ctx.fillStyle = '#ff7a63'
  ctx.fill()
  ctx.stroke()
}

/** きんメダル（ひもの合わさる所が原点） */
function medal(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 0.05
  ctx.strokeStyle = '#3d9be9'
  ctx.beginPath()
  ctx.moveTo(-0.2, -0.22)
  ctx.lineTo(0, 0.04)
  ctx.lineTo(0.2, -0.22)
  ctx.stroke()
  ctx.lineWidth = 0.022
  ctx.strokeStyle = LINE
  ctx.beginPath()
  ctx.arc(0, 0.15, 0.12, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-0.04, 0.11, 0.01, 0, 0.15, 0.12)
  g.addColorStop(0, '#fff4b8')
  g.addColorStop(1, '#e8a800')
  ctx.fillStyle = g
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 0.026 : 0.06
    ctx.lineTo(Math.cos(a) * r, 0.15 + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}

/** おはな（花のまんなかが原点） */
function flower(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2
    ctx.beginPath()
    ctx.ellipse(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.06, 0.045, a, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 0.045, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd84d'
  ctx.fill()
  ctx.stroke()
}

/** キラキラの星（絵のまわり。t で少しまたたく） */
function sparkles(ctx: CanvasRenderingContext2D, art: CutArt, t: number) {
  const [w, h] = ART_SIZE[art]
  const pts: [number, number, number][] = [
    [0.08, 0.18, 1],
    [0.92, 0.12, 0.8],
    [0.06, 0.62, 0.7],
    [0.95, 0.55, 1],
    [0.5, 0.04, 0.6],
  ]
  const size = Math.min(w, h) * 0.07
  pts.forEach(([px, py, k], i) => {
    const tw = 0.75 + 0.25 * Math.sin(t * 4 + i * 1.7)
    const r = size * k * tw
    const x = px * w
    const y = py * h
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.quadraticCurveTo(x, y, x, y + r)
    ctx.quadraticCurveTo(x, y, x - r, y)
    ctx.quadraticCurveTo(x, y, x, y - r)
    ctx.fillStyle = '#ffd84d'
    ctx.fill()
  })
}
