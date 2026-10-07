/**
 * きねんカード（SNS に のせる画像）を作る。1080×1080 の正方形。
 * のせるもの：ゲームの名前・結果・日付・ピクルくん（つけている小物ごと）・パドル。
 * 名前や顔写真など、遊んだ人が分かるものは入れない。
 */
import { onPublicSite, PUBLIC_URL } from '../core/counter'
import type { Wear } from './accessories'
import { drawPaddleArt } from './paddleArt'
import type { PaddleLook } from './paddleArt'
import { drawHawkArt, loadPikuru } from './hawkArt'
import type { CutArt } from './hawkArt'

export interface CardData {
  /** ゲームの id（共有のリンクで、そのゲームの じゅんびの画面を開く）。じゅんばんモードは 'party' */
  game?: string
  /** ひとりで遊んだ記録（「この きろくに ちょうせんしてね」をそえる） */
  challenge?: boolean
  gameTitle: string
  title: string
  sub?: string
  face: CutArt
  wear: Wear
  look?: PaddleLook
  date?: Date
}

const SIZE = 1080
const FONT = "'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif"

export const HASHTAGS = '#ピクルくんとあそぼ #ピックルボール'

/**
 * 共有のリンク：受け取った人が そのゲームを すぐ遊べるように、じゅんびの画面を開く。
 * ?src=share は「共有から来た」ことを数えるための印（アプリが読んだらアドレスから消す）。
 */
export function shareLink(game?: string): string {
  const hash = game === 'party' ? '#/party' : game ? `#/setup/${game}` : ''
  return `${PUBLIC_URL}?src=share${hash}`
}

/** 共有するときの文（公開URLで開いているときだけ URL をつける） */
export function shareText(d: Pick<CardData, 'gameTitle' | 'title' | 'game' | 'challenge'>): string {
  const dare = d.challenge ? ' この きろくに ちょうせんしてね！' : ''
  return `「${d.gameTitle}」で ${d.title}${dare} ${HASHTAGS}${onPublicSite() ? `\n${shareLink(d.game)}` : ''}`
}

/** 分かち書き（スペース）のところで折り返す */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/(\s+)/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line + w
    if (ctx.measureText(next.trim()).width > maxW && line.trim()) {
      lines.push(line.trim())
      line = w.trimStart()
    } else line = next
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

/** 入りきる大きさまで字を小さくして、折り返して書く。書いた高さを返す */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, minSize: number, maxLines: number): number {
  let s = size
  let lines: string[] = []
  for (; s >= minSize; s -= 4) {
    ctx.font = `900 ${s}px ${FONT}`
    lines = wrap(ctx, text, maxW)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) break
  }
  const lh = s * 1.22
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lh))
  return lines.slice(0, maxLines).length * lh
}

export async function makeCard(d: CardData): Promise<Blob> {
  await Promise.all([
    document.fonts?.load(`900 64px 'Zen Maru Gothic'`).catch(() => undefined),
    document.fonts?.load(`700 32px 'Zen Maru Gothic'`).catch(() => undefined),
    loadPikuru(d.face),
  ])
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext('2d')!

  // 地
  ctx.fillStyle = '#ffe7b8'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = 'rgba(255, 138, 61, 0.12)'
  for (let i = 0; i < 9; i++) {
    ctx.beginPath()
    ctx.arc(90 + ((i * 137) % 900), 60 + ((i * 251) % 980), 26 + (i % 3) * 10, 0, Math.PI * 2)
    ctx.fill()
  }

  // 上：アプリの名前と日付
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `900 50px ${FONT}`
  const nameW = ctx.measureText('ピクルくんとあそぼ').width
  ctx.beginPath()
  ctx.roundRect(56, 52, nameW + 64, 92, 46)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  ctx.fillText('ピクルくんとあそぼ', 88, 116)
  const date = d.date ?? new Date()
  ctx.textAlign = 'right'
  ctx.fillStyle = '#4f6a5f'
  ctx.font = `700 38px ${FONT}`
  ctx.fillText(`${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`, SIZE - 60, 112)

  // まんなか：コートの色の板に、ゲームの名前と結果
  const px = 56
  const py = 182
  const pw = SIZE - 112
  const ph = 560
  ctx.beginPath()
  ctx.roundRect(px, py, pw, ph, 44)
  ctx.fillStyle = '#2f5d9a'
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  // キッチンの線（飾り）
  ctx.fillStyle = 'rgba(61, 143, 122, 0.55)'
  ctx.fillRect(px + 5, py + ph - 150, pw - 10, 145)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(px + 5, py + ph - 154, pw - 10, 8)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#d4f03c'
  const tx = px + 52
  let ty = py + 100
  ty += fitText(ctx, d.gameTitle, tx, ty, pw - 104, 58, 38, 1) + 34
  ctx.fillStyle = '#ffffff'
  const titleH = fitText(ctx, d.title, tx, ty + 30, pw - 104, 104, 56, 2)
  ty += titleH + 46
  if (d.sub) {
    ctx.fillStyle = '#ffe7b8'
    ctx.font = `700 40px ${FONT}`
    // 右下のピクルくんに かからない幅で
    fitText(ctx, d.sub, tx, ty, 560, 40, 28, 2)
  }

  // パドル（左下）とピクルくん（右下）
  drawPaddleArt(ctx, { x: 200, y: 800, faceLen: 190, angle: -Math.PI / 2 - 0.45, look: d.look, color: '#ff8a3d' })
  // 球
  const bx = 380
  const by = 860
  ctx.beginPath()
  ctx.arc(bx, by, 38, 0, Math.PI * 2)
  ctx.fillStyle = '#d4f03c'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#2e5a1c'
  ctx.stroke()
  ctx.fillStyle = '#2e5a1c'
  for (const [dx, dy] of [
    [-13, -9],
    [11, -11],
    [2, 14],
  ]) {
    ctx.beginPath()
    ctx.arc(bx + dx, by + dy, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  drawHawkArt(ctx, d.face, 840, 1030, 400, 0, false, d.wear)

  // 下：ハッシュタグ（公開URLで開いているときは URL も）
  ctx.textAlign = 'left'
  if (onPublicSite()) {
    ctx.font = `700 28px ${FONT}`
    ctx.fillStyle = '#4f6a5f'
    ctx.fillText(PUBLIC_URL.replace(/^https:\/\//, ''), 60, 1004)
  }
  ctx.fillStyle = '#2e5a1c'
  ctx.font = `700 34px ${FONT}`
  ctx.fillText(HASHTAGS, 60, 1050)

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))
}
