/**
 * ラリーの手応えの演出（見た目だけ。判定や点には関わらない）。
 *   残像 …… 飛んでいる球のうしろに うすい尾。強く打った球はオレンジ
 *   はじけ …… 打った所・的に入った所で、光の粒が はじける
 *   ゆれ …… 強く打ったときだけ、画面を少しゆらす
 *   文字 …… 「2れんぞく！」などを、その場から浮かせて消す
 *   速さ …… 自分が打った球の速さ（km/h）を打点から浮かせる。振る速さが球の速さになったと分かるように
 *   ため …… 強く打った瞬間だけ、球をほんの一瞬止める（ヒットストップ）
 * 「動きを減らす」設定（prefers-reduced-motion）のときは、ゆれ・粒・ためを出さない。
 */
import type { Vec } from './physics'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  color: string
}

interface Ring {
  x: number
  y: number
  age: number
  life: number
  color: string
  size: number
}

interface Pop {
  x: number
  y: number
  text: string
  age: number
  life: number
  color: string
  /** 文字の大きさの倍率 */
  size: number
}

interface TrailPoint {
  x: number
  y: number
  age: number
}

/** 強い打球とみなす振りの強さ（physics の powerFromSwing。1＝深く速い球） */
export const STRONG_POWER = 0.95
const TRAIL_LIFE = 0.16
const SHAKE_TIME = 0.18
/** 強く打ったときに球を止める時間（秒）。長いと遅れて感じるので短く */
export const HIT_STOP = 0.06

export const FX_COLOR = { hit: '#fff1a8', strong: '#ff8a3d', good: '#d8f04c', sensei: '#3fd08f' }

function reducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export class RallyFx {
  private sparks: Spark[] = []
  private rings: Ring[] = []
  private pops: Pop[] = []
  private trail: TrailPoint[] = []
  private shakeT = 0
  private shakeAmp = 0
  private stopT = 0
  /** 球の尾をオレンジにする（強い打球のあいだ） */
  private hot = false
  private readonly calm: boolean
  private readonly rand: () => number

  constructor(rand: () => number = Math.random, calm = reducedMotion()) {
    this.rand = rand
    this.calm = calm
  }

  /** 打った：打点で はじける。強い打球は大きく・オレンジ・少しゆれる */
  hit(at: Vec, power: number, mine: boolean): void {
    const strong = power >= STRONG_POWER
    this.hot = strong
    this.trail = []
    const color = strong ? FX_COLOR.strong : mine ? FX_COLOR.hit : FX_COLOR.sensei
    this.rings.push({ x: at.x, y: at.y, age: 0, life: strong ? 0.35 : 0.25, color, size: strong ? 1.6 : 1.0 })
    this.burst(at, strong ? 14 : 6, color, strong ? 7 : 4)
    if (strong && mine) {
      this.shake(5)
      if (!this.calm) this.stopT = HIT_STOP
    }
  }

  /** 自分が打った球の速さを、打点から浮かせる。強い球はオレンジで大きく */
  speed(at: Vec, kmh: number, strong: boolean): void {
    this.pops.push({ x: at.x, y: at.y, text: `${kmh}km/h`, age: 0, life: 0.9, color: strong ? FX_COLOR.strong : FX_COLOR.hit, size: strong ? 0.8 : 0.6 })
  }

  /** ヒットストップ中か。止めている間は true（進行を止める側が毎フレーム呼ぶ） */
  holding(dt: number): boolean {
    if (this.stopT <= 0) return false
    this.stopT -= dt
    return true
  }

  /** 的に入った・ラリーの節目：大きめの はじけ */
  celebrate(at: Vec, text?: string): void {
    this.rings.push({ x: at.x, y: at.y, age: 0, life: 0.5, color: FX_COLOR.good, size: 2.4 })
    this.burst(at, 18, FX_COLOR.good, 6)
    if (text) this.pops.push({ x: at.x, y: at.y, text, age: 0, life: 1.1, color: FX_COLOR.good, size: 1 })
  }

  /** 新しいポイント・新しい球：残像を消す */
  reset(): void {
    this.trail = []
    this.hot = false
    this.stopT = 0
  }

  private burst(at: Vec, n: number, color: string, speed: number): void {
    if (this.calm) return
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2
      const v = speed * (0.4 + this.rand() * 0.6)
      this.sparks.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.35 + this.rand() * 0.25, color })
    }
  }

  private shake(px: number): void {
    if (this.calm) return
    this.shakeT = SHAKE_TIME
    this.shakeAmp = px
  }

  /** 毎フレーム。ball は見えている球（見えないときは null） */
  update(dt: number, ball: Vec | null): void {
    for (const p of this.sparks) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - Math.min(1, dt * 4)
      p.vy *= 1 - Math.min(1, dt * 4)
    }
    this.sparks = this.sparks.filter((p) => p.age < p.life)
    for (const r of this.rings) r.age += dt
    this.rings = this.rings.filter((r) => r.age < r.life)
    for (const p of this.pops) p.age += dt
    this.pops = this.pops.filter((p) => p.age < p.life)
    for (const t of this.trail) t.age += dt
    this.trail = this.trail.filter((t) => t.age < TRAIL_LIFE)
    if (ball) this.trail.push({ x: ball.x, y: ball.y, age: 0 })
    this.shakeT = Math.max(0, this.shakeT - dt)
  }

  /** 画面のゆれ（px）。描く前に ctx をずらす */
  offset(): Vec {
    if (this.shakeT <= 0) return { x: 0, y: 0 }
    const k = (this.shakeT / SHAKE_TIME) * this.shakeAmp
    return { x: (this.rand() * 2 - 1) * k, y: (this.rand() * 2 - 1) * k }
  }

  /** 球の下に描く（残像） */
  drawUnder(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, s: number): void {
    const n = this.trail.length
    if (n < 2) return
    ctx.lineCap = 'round'
    for (let i = 1; i < n; i++) {
      const a = this.trail[i - 1]
      const b = this.trail[i]
      const k = 1 - b.age / TRAIL_LIFE
      ctx.beginPath()
      ctx.moveTo(X(a.x), Y(a.y))
      ctx.lineTo(X(b.x), Y(b.y))
      ctx.strokeStyle = this.hot ? `rgba(255, 138, 61, ${0.55 * k})` : `rgba(255, 241, 168, ${0.4 * k})`
      ctx.lineWidth = Math.max(2, (this.hot ? 0.3 : 0.2) * s * k)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }

  /** 球の上に描く（はじけ・輪・文字） */
  drawOver(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, s: number): void {
    for (const r of this.rings) {
      const k = r.age / r.life
      ctx.beginPath()
      ctx.arc(X(r.x), Y(r.y), (0.3 + k * r.size) * s, 0, Math.PI * 2)
      ctx.strokeStyle = r.color
      ctx.globalAlpha = 1 - k
      ctx.lineWidth = Math.max(2, 0.12 * s * (1 - k))
      ctx.stroke()
    }
    for (const p of this.sparks) {
      const k = p.age / p.life
      ctx.globalAlpha = 1 - k
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(X(p.x), Y(p.y), Math.max(1.5, 0.09 * s * (1 - k * 0.5)), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    for (const p of this.pops) {
      const k = p.age / p.life
      // はじめに ぽんと大きくなり、上へ浮きながら消える
      const grow = Math.min(1, p.age / 0.12)
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      ctx.font = `900 ${Math.round(Math.max(18, 0.9 * s) * p.size * (0.6 + 0.4 * grow))}px "Zen Maru Gothic", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const y = Y(p.y) - k * 1.6 * s
      ctx.lineWidth = Math.max(3, 0.16 * s)
      ctx.strokeStyle = '#12302b'
      ctx.strokeText(p.text, X(p.x), y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, X(p.x), y)
    }
    ctx.globalAlpha = 1
  }

  /** テスト用：いま出ている粒・輪・文字の数 */
  counts(): { sparks: number; rings: number; pops: number; trail: number } {
    return { sparks: this.sparks.length, rings: this.rings.length, pops: this.pops.length, trail: this.trail.length }
  }
}
