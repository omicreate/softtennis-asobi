/**
 * 背景を抜いたホークアイ先生の絵（原画から scripts/build-art.mjs で作る：public/hawk/cut-*.png）。
 * ゲームの中（審判・ボールマシン・応援・合図・走る姿など）に出す。
 * コレクションで つけた小物（ui/accessories.ts）も重ねて描く。絵そのものは変えない。
 */
import { useEffect, useRef } from 'react'
import { getProgress, useProgress } from '../core/progress'
import { ART_SIZE, drawWear, setGlow } from './accessories'
import type { Wear } from './accessories'
import type { Face } from './Hawk'

export type CutArt = Face | 'full' | 'run'

const ALT: Record<CutArt, string> = {
  think: 'かんがえる ホークアイ先生',
  ok: 'よろこぶ ホークアイ先生',
  eh: 'おどろく ホークアイ先生',
  oops: 'ドンマイの ホークアイ先生',
  full: 'ホークアイ先生',
  run: 'はしる ホークアイ先生',
}

const src = (art: CutArt) => `${import.meta.env.BASE_URL}hawk/cut-${art}.png`

const hasWear = (w: Wear) => Object.values(w).some(Boolean)

/**
 * 画面の部品として出す（高さを決めると幅は絵の比率どおり）。
 * 小物をつけていないときは絵（img）、つけているときは小物ごと canvas に描く（大きさは同じ）。
 * wear を渡すとその小物（コレクションの試着など）、渡さないと いま つけている小物。
 */
export function HawkCut({ art, height, className, wear }: { art: CutArt; height: number; className?: string; wear?: Wear }) {
  const progress = useProgress()
  const w = wear ?? progress.wear
  if (!hasWear(w)) {
    return <img className={`hawk-cut ${className ?? ''}`} src={src(art)} alt={ALT[art]} style={{ height }} draggable={false} />
  }
  return <WornCut art={art} height={height} className={className} wear={w} />
}

function WornCut({ art, height, className, wear }: { art: CutArt; height: number; className?: string; wear: Wear }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [nw, nh] = ART_SIZE[art]
  const width = Math.round((height * nw) / nh)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => {
      const img = hawkImage(art)
      const ctx = c.getContext('2d')
      if (!img || !ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      c.width = Math.round(width * dpr)
      c.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const k = height / nh
      ctx.save()
      ctx.scale(k, k)
      // キラキラの光の分、少し内側に描く
      const pad = wear.aura ? 0.06 : 0
      ctx.translate(nw * pad, nh * pad)
      ctx.scale(1 - pad * 2, 1 - pad * 2)
      setGlow(ctx, wear, nh)
      ctx.drawImage(img, 0, 0, nw, nh)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      drawWear(ctx, art, wear)
      ctx.restore()
    }
    draw()
    const img = cachedImage(art)
    img.addEventListener('load', draw)
    return () => img.removeEventListener('load', draw)
  }, [art, height, width, nw, nh, wear])

  return <canvas ref={ref} role="img" aria-label={ALT[art]} className={`hawk-cut ${className ?? ''}`} style={{ height, width }} />
}

const cache = new Map<CutArt, HTMLImageElement>()

function cachedImage(art: CutArt): HTMLImageElement {
  let img = cache.get(art)
  if (!img) {
    img = new Image()
    img.src = src(art)
    cache.set(art, img)
  }
  return img
}

/** canvas に描くための絵（読み込みが終わるまでは null） */
export function hawkImage(art: CutArt): HTMLImageElement | null {
  const img = cachedImage(art)
  return img.complete && img.naturalWidth > 0 ? img : null
}

/** 読み込みが終わるのを待つ（きねんカードを作るとき） */
export function loadPikuru(art: CutArt): Promise<HTMLImageElement> {
  const img = cachedImage(art)
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(img)
  return img.decode().then(() => img)
}

/** 使う絵を前もって読み込む */
export function preloadHawk(): void {
  for (const a of ['think', 'ok', 'eh', 'oops', 'full', 'run'] as CutArt[]) hawkImage(a)
}

/**
 * canvas に描く。(x, y) は足もと（下の中央）、h は高さ（px）。
 * wear を省くと、いま つけている小物を重ねる。
 */
export function drawHawkArt(
  ctx: CanvasRenderingContext2D,
  art: CutArt,
  x: number,
  y: number,
  h: number,
  tilt = 0,
  flip = false,
  wear: Wear = getProgress().wear,
): boolean {
  const img = hawkImage(art)
  if (!img) return false
  const [nw, nh] = ART_SIZE[art]
  const w = (h * nw) / nh
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  if (flip) ctx.scale(-1, 1)
  setGlow(ctx, wear, h)
  ctx.drawImage(img, -w / 2, -h, w, h)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  if (hasWear(wear)) {
    ctx.translate(-w / 2, -h)
    ctx.scale(h / nh, h / nh)
    drawWear(ctx, art, wear, performance.now() / 1000)
  }
  ctx.restore()
  return true
}
