/**
 * エアピックル（ふたり）。エアホッケーのピックルボール版。React に依存しない純粋な計算。
 * 場は幅100・高さ170（下が0の人、上が1の人）。上下の壁のまんなかにゴールがある。
 * パドルは上から見た面（原画の形）。当たり判定は面の形に近い「両はしの丸い棒」。
 * 手加減：レベルでパドルの大きさ・自分のゴールの幅・自分に向かってくる球の速さの上限が変わる。
 */
import { FACE_RATIO } from '../../ui/paddleArt'
import type { Level, Side } from '../../core/players'

export const FIELD_W = 100
export const FIELD_H = 170
export const BALL_R = 3.4
export const TARGET = 5

export interface AirLevel {
  /** パドルの面の長さ */
  paddle: number
  /** 自分のゴールの幅（小さい子は狭い＝入れられにくい） */
  goal: number
  /** 自分に向かってくる球の速さの上限（単位/秒） */
  maxSpeed: number
}

export const AIR_LEVEL: Record<Level, AirLevel> = {
  chibi: { paddle: 30, goal: 30, maxSpeed: 75 },
  kids: { paddle: 26, goal: 34, maxSpeed: 95 },
  otona: { paddle: 22, goal: 38, maxSpeed: 120 },
  senshu: { paddle: 19, goal: 40, maxSpeed: 140 },
}

/** 打ったあとの球は、これより遅くならない（止まって取れなくならないように） */
const MIN_SPEED = 12
const FRICTION = 0.35
const WALL_E = 0.9
const HIT_E = 0.85
/** パドルが1秒に動ける距離（指を速く動かしても、球をすり抜けないように） */
const PADDLE_MAX = 420

export interface AirPaddle {
  x: number
  y: number
  vx: number
  vy: number
  /** 指の位置（ここへ向かって動く） */
  tx: number
  ty: number
  /** 面の長さと幅 */
  len: number
  wid: number
}

export type AirPhase = 'ready' | 'play' | 'goal' | 'over'

export interface AirState {
  levels: [Level, Level]
  ball: { x: number; y: number; vx: number; vy: number }
  paddles: [AirPaddle, AirPaddle]
  score: [number, number]
  phase: AirPhase
  /** ready・goal の残り時間 */
  wait: number
  /** 一度でも打ったか（打つ前は球が止まっていてよい） */
  hit: boolean
  lastScorer: Side | null
}

export type AirEvent = { type: 'hit'; side: Side; speed: number } | { type: 'wall' } | { type: 'goal'; scorer: Side; score: [number, number] } | { type: 'go' } | { type: 'over'; winner: Side }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function homeY(side: Side, len: number) {
  return side === 0 ? FIELD_H - len / 2 - 14 : len / 2 + 14
}

function makePaddle(side: Side, level: Level): AirPaddle {
  const len = AIR_LEVEL[level].paddle
  const y = homeY(side, len)
  return { x: FIELD_W / 2, y, vx: 0, vy: 0, tx: FIELD_W / 2, ty: y, len, wid: len * FACE_RATIO }
}

export function createAir(levels: [Level, Level]): AirState {
  return {
    levels,
    ball: { x: FIELD_W / 2, y: FIELD_H / 2, vx: 0, vy: 0 },
    paddles: [makePaddle(0, levels[0]), makePaddle(1, levels[1])],
    score: [0, 0],
    phase: 'ready',
    wait: 3,
    hit: false,
    lastScorer: null,
  }
}

export function goalWidth(s: AirState, side: Side): number {
  return AIR_LEVEL[s.levels[side]].goal
}

/** パドルが動ける範囲（自分の半分の中。まんなかの線は少しだけこえない） */
export function paddleBounds(p: AirPaddle, side: Side) {
  const halfX = p.wid / 2
  const halfY = p.len / 2
  const x0 = halfX
  const x1 = FIELD_W - halfX
  const [y0, y1] = side === 0 ? [FIELD_H / 2 + halfY + 1, FIELD_H - halfY - 2] : [halfY + 2, FIELD_H / 2 - halfY - 1]
  return { x0, x1, y0, y1 }
}

/** 指の位置を伝える（場の座標） */
export function aim(s: AirState, side: Side, x: number, y: number): void {
  const p = s.paddles[side]
  const b = paddleBounds(p, side)
  p.tx = clamp(x, b.x0, b.x1)
  p.ty = clamp(y, b.y0, b.y1)
}

/** 球の中心から、パドル（両はしの丸い棒）までの いちばん近い点 */
function closest(p: AirPaddle, x: number, y: number): [number, number] {
  const half = Math.max(0, p.len / 2 - p.wid / 2)
  return [p.x, clamp(y, p.y - half, p.y + half)]
}

function capSpeed(s: AirState) {
  const b = s.ball
  // 向かっている側の人のレベルで上限を決める（下へ向かう＝0の人へ）
  const toward: Side = b.vy > 0 ? 0 : 1
  const max = AIR_LEVEL[s.levels[toward]].maxSpeed
  const v = Math.hypot(b.vx, b.vy)
  if (v > max) {
    b.vx *= max / v
    b.vy *= max / v
  } else if (s.hit && v < MIN_SPEED) {
    const k = v > 1e-6 ? MIN_SPEED / v : 0
    if (k) {
      b.vx *= k
      b.vy *= k
    } else b.vy = toward === 0 ? MIN_SPEED : -MIN_SPEED
  }
}

function serve(s: AirState, toward: Side | null) {
  s.ball = { x: FIELD_W / 2, y: toward === null ? FIELD_H / 2 : toward === 0 ? FIELD_H * 0.72 : FIELD_H * 0.28, vx: 0, vy: 0 }
  s.hit = false
  for (const side of [0, 1] as Side[]) {
    const p = s.paddles[side]
    p.x = p.tx = FIELD_W / 2
    p.y = p.ty = homeY(side, p.len)
    p.vx = p.vy = 0
  }
}

export function stepAir(s: AirState, dt: number): AirEvent[] {
  const ev: AirEvent[] = []
  if (s.phase === 'over') return ev
  if (s.phase === 'ready' || s.phase === 'goal') {
    s.wait -= dt
    // 待っている間もパドルは動かせる
    movePaddles(s, dt)
    if (s.wait <= 0) {
      if (s.phase === 'goal') serve(s, s.lastScorer === null ? null : s.lastScorer === 0 ? 1 : 0)
      s.phase = 'play'
      ev.push({ type: 'go' })
    }
    return ev
  }

  const before = s.paddles.map((p) => ({ x: p.x, y: p.y }))
  movePaddles(s, dt)
  const b = s.ball
  const n = Math.max(1, Math.min(10, Math.ceil((Math.hypot(b.vx, b.vy) * dt + PADDLE_MAX * dt) / (BALL_R * 0.6))))
  const h = dt / n
  // まさつ
  const f = Math.exp(-FRICTION * dt)
  b.vx *= f
  b.vy *= f
  for (let i = 1; i <= n; i++) {
    b.x += b.vx * h
    b.y += b.vy * h
    // パドル（この小さな時間の位置）
    for (const side of [0, 1] as Side[]) {
      const p = s.paddles[side]
      const px = before[side].x + (p.x - before[side].x) * (i / n)
      const py = before[side].y + (p.y - before[side].y) * (i / n)
      const q = { ...p, x: px, y: py }
      const [cx, cy] = closest(q, b.x, b.y)
      let dx = b.x - cx
      let dy = b.y - cy
      const d = Math.hypot(dx, dy)
      const r = p.wid / 2 + BALL_R
      if (d < r) {
        if (d < 1e-6) {
          dx = 0
          dy = side === 0 ? -1 : 1
        } else {
          dx /= d
          dy /= d
        }
        b.x = cx + dx * r
        b.y = cy + dy * r
        const rvx = b.vx - p.vx
        const rvy = b.vy - p.vy
        const vn = rvx * dx + rvy * dy
        if (vn < 0) {
          b.vx -= (1 + HIT_E) * vn * dx
          b.vy -= (1 + HIT_E) * vn * dy
          s.hit = true
          capSpeed(s)
          ev.push({ type: 'hit', side, speed: Math.hypot(b.vx, b.vy) })
        }
      }
    }
    // 横の壁
    if (b.x < BALL_R) {
      b.x = BALL_R
      b.vx = Math.abs(b.vx) * WALL_E
      ev.push({ type: 'wall' })
    } else if (b.x > FIELD_W - BALL_R) {
      b.x = FIELD_W - BALL_R
      b.vx = -Math.abs(b.vx) * WALL_E
      ev.push({ type: 'wall' })
    }
    // 上下：ゴールの口なら通す、それ以外は はね返す
    for (const side of [0, 1] as Side[]) {
      const wallY = side === 0 ? FIELD_H : 0
      const into = side === 0 ? b.y > FIELD_H - BALL_R : b.y < BALL_R
      if (!into) continue
      const inMouth = Math.abs(b.x - FIELD_W / 2) < goalWidth(s, side) / 2 - BALL_R * 0.3
      if (inMouth) {
        const scored = side === 0 ? b.y > FIELD_H + BALL_R : b.y < -BALL_R
        if (scored) {
          const scorer: Side = side === 0 ? 1 : 0
          s.score[scorer] += 1
          s.lastScorer = scorer
          ev.push({ type: 'goal', scorer, score: [s.score[0], s.score[1]] })
          if (s.score[scorer] >= TARGET) {
            s.phase = 'over'
            ev.push({ type: 'over', winner: scorer })
          } else {
            s.phase = 'goal'
            s.wait = 1.6
          }
          return ev
        }
      } else {
        b.y = side === 0 ? wallY - BALL_R : BALL_R
        b.vy = (side === 0 ? -1 : 1) * Math.abs(b.vy) * WALL_E
        ev.push({ type: 'wall' })
      }
    }
  }
  capSpeed(s)
  return ev
}

function movePaddles(s: AirState, dt: number) {
  for (const side of [0, 1] as Side[]) {
    const p = s.paddles[side]
    let dx = p.tx - p.x
    let dy = p.ty - p.y
    const d = Math.hypot(dx, dy)
    const max = PADDLE_MAX * Math.max(0, dt)
    if (d > max && d > 0) {
      dx *= max / d
      dy *= max / d
    }
    p.x += dx
    p.y += dy
    // 速さはなめらかにする（指のふるえで球が暴れないように）
    const vx = dx / Math.max(dt, 1e-3)
    const vy = dy / Math.max(dt, 1e-3)
    p.vx = p.vx * 0.4 + vx * 0.6
    p.vy = p.vy * 0.4 + vy * 0.6
  }
}
