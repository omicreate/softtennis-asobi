/**
 * キッチン カーリング（ふたり・チームでも）。React に依存しない純粋な計算。
 * 場は幅100・高さ180。まんなか（ネットの所）に的があり、下の人（0）と上の人（1）が自分の側から交代で投げる。
 * 指をうしろに引いて はなすと、反対向きに飛ぶ（ぱちんこ）。ボールは だんだん遅くなって止まる。
 * ボール同士は はじき合う。場の外に出たボールは なくなる。
 * 1エンド＝1人4球。全部投げたら、的のまんなかに いちばん近いボールの側が、相手のいちばん近いボールより
 * 近いボールの数だけ点をとる（カーリングと同じ数え方）。3エンドの合計で勝ち（同点なら もう1エンド）。
 */
import type { Level, Side } from '../../core/players'

export const FIELD_W = 100
export const FIELD_H = 180
export const BALL_R = 3.6
export const CENTER = { x: FIELD_W / 2, y: FIELD_H / 2 }
/** 的の輪（いちばん外の輪の中だけ点になる） */
export const RINGS = [5, 11, 18]
export const HOUSE = RINGS[RINGS.length - 1]
/** 1エンドで1人が投げる数・エンドの数 */
export const STONES = 4
export const ENDS = 3
/** だんだん遅くなる（単位/秒²） */
export const DECEL = 34
export const MAX_SPEED = 115
const RESTITUTION = 0.9

export interface Stone {
  id: number
  side: Side
  x: number
  y: number
  vx: number
  vy: number
}

export type CuPhase = 'aim' | 'moving' | 'endScore' | 'over'

export interface CuState {
  levels: [Level, Level]
  stones: Stone[]
  /** いま投げる人 */
  turn: Side
  /** このエンドで投げた数 */
  thrown: [number, number]
  end: number
  /** エンドを始める人（エンドごとに交代） */
  starter: Side
  score: [number, number]
  /** エンドの点の記録 */
  ends: [number, number][]
  phase: CuPhase
  wait: number
  nextId: number
  lastEnd: { side: Side | null; points: number } | null
}

export type CuEvent =
  | { type: 'throw'; side: Side }
  | { type: 'hit'; speed: number }
  | { type: 'out'; side: Side }
  | { type: 'rest' }
  | { type: 'end'; side: Side | null; points: number; score: [number, number] }
  | { type: 'over'; winner: Side | null }

/** 投げる位置（自分の側の はし） */
export function launchPoint(side: Side) {
  return { x: FIELD_W / 2, y: side === 0 ? FIELD_H - 12 : 12 }
}

export function createCurling(levels: [Level, Level]): CuState {
  return { levels, stones: [], turn: 0, thrown: [0, 0], end: 1, starter: 0, score: [0, 0], ends: [], phase: 'aim', wait: 0, nextId: 1, lastEnd: null }
}

/**
 * 引いた量（指を動かした向きと長さ。場の単位）から、投げる速さ。
 * 引いた向きと反対へ飛ぶ。長く引くほど強い（上限あり）。
 */
export function launchVelocity(dx: number, dy: number): { vx: number; vy: number } {
  const len = Math.hypot(dx, dy)
  const speed = Math.min(MAX_SPEED, len * 2.4)
  if (len < 1e-6) return { vx: 0, vy: 0 }
  return { vx: (-dx / len) * speed, vy: (-dy / len) * speed }
}

/** 止まる位置（ほかのボールに当たらなければ） */
export function restPoint(x: number, y: number, vx: number, vy: number) {
  const v = Math.hypot(vx, vy)
  if (v < 1e-6) return { x, y }
  const d = (v * v) / (2 * DECEL)
  return { x: x + (vx / v) * d, y: y + (vy / v) * d }
}

/** 投げる（引いた量で）。投げられたら true */
export function throwStone(s: CuState, side: Side, dx: number, dy: number, ev: CuEvent[] = []): boolean {
  if (s.phase !== 'aim' || side !== s.turn) return false
  const { vx, vy } = launchVelocity(dx, dy)
  // 自分の側から相手の方へ向かう球だけ（うしろ向きには投げられない）
  if ((side === 0 && vy >= -5) || (side === 1 && vy <= 5)) return false
  const p = launchPoint(side)
  s.stones.push({ id: s.nextId++, side, x: p.x, y: p.y, vx, vy })
  s.thrown[side] += 1
  s.phase = 'moving'
  ev.push({ type: 'throw', side })
  return true
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** エンドの点：中心にいちばん近いボールの側が、相手のいちばん近いボールより近い数だけ */
export function scoreEnd(stones: Stone[]): { side: Side | null; points: number } {
  const inHouse = stones.filter((st) => dist(st, CENTER) <= HOUSE + BALL_R).sort((a, b) => dist(a, CENTER) - dist(b, CENTER))
  if (!inHouse.length) return { side: null, points: 0 }
  const side = inHouse[0].side
  const best = (sd: Side) => inHouse.find((st) => st.side === sd)
  const other = best(side === 0 ? 1 : 0)
  const limit = other ? dist(other, CENTER) : Infinity
  const points = inHouse.filter((st) => st.side === side && dist(st, CENTER) < limit).length
  return { side, points }
}

export function stepCurling(s: CuState, dt: number): CuEvent[] {
  const ev: CuEvent[] = []
  if (s.phase === 'over' || s.phase === 'aim') return ev
  if (s.phase === 'endScore') {
    s.wait -= dt
    if (s.wait <= 0) nextEnd(s, ev)
    return ev
  }
  // 動いているボール（小さく区切って、すり抜けないように）
  const fastest = Math.max(0, ...s.stones.map((st) => Math.hypot(st.vx, st.vy)))
  const n = Math.max(1, Math.min(12, Math.ceil((fastest * dt) / (BALL_R * 0.5))))
  const h = dt / n
  for (let k = 0; k < n; k++) {
    for (const st of s.stones) {
      const v = Math.hypot(st.vx, st.vy)
      if (v === 0) continue
      const nv = Math.max(0, v - DECEL * h)
      st.vx *= nv / v
      st.vy *= nv / v
      st.x += st.vx * h
      st.y += st.vy * h
    }
    // ぶつかる（同じ重さ）
    for (let i = 0; i < s.stones.length; i++) {
      for (let j = i + 1; j < s.stones.length; j++) {
        const a = s.stones[i]
        const b = s.stones[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d >= BALL_R * 2 || d < 1e-9) continue
        const nx = dx / d
        const ny = dy / d
        // めりこみを戻す
        const push = (BALL_R * 2 - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        if (rel <= 0) continue
        const imp = ((1 + RESTITUTION) / 2) * rel
        a.vx -= imp * nx
        a.vy -= imp * ny
        b.vx += imp * nx
        b.vy += imp * ny
        ev.push({ type: 'hit', speed: rel })
      }
    }
  }
  // 場の外に出たボールは なくなる
  for (const st of s.stones) {
    if (st.x < -BALL_R || st.x > FIELD_W + BALL_R || st.y < -BALL_R || st.y > FIELD_H + BALL_R) ev.push({ type: 'out', side: st.side })
  }
  s.stones = s.stones.filter((st) => st.x >= -BALL_R && st.x <= FIELD_W + BALL_R && st.y >= -BALL_R && st.y <= FIELD_H + BALL_R)

  if (s.stones.every((st) => st.vx === 0 && st.vy === 0)) {
    ev.push({ type: 'rest' })
    afterRest(s, ev)
  }
  return ev
}

function afterRest(s: CuState, ev: CuEvent[]) {
  if (s.thrown[0] >= STONES && s.thrown[1] >= STONES) {
    const r = scoreEnd(s.stones)
    if (r.side !== null) s.score[r.side] += r.points
    s.ends.push([r.side === 0 ? r.points : 0, r.side === 1 ? r.points : 0])
    s.lastEnd = r
    s.phase = 'endScore'
    s.wait = 2.8
    ev.push({ type: 'end', side: r.side, points: r.points, score: [s.score[0], s.score[1]] })
    return
  }
  // 交代（相手がもう投げきっていたら、続けて投げる）
  const other: Side = s.turn === 0 ? 1 : 0
  s.turn = s.thrown[other] < STONES ? other : s.turn
  s.phase = 'aim'
}

function nextEnd(s: CuState, ev: CuEvent[]) {
  const done = s.end >= ENDS && s.score[0] !== s.score[1]
  if (done) {
    s.phase = 'over'
    ev.push({ type: 'over', winner: s.score[0] > s.score[1] ? 0 : 1 })
    return
  }
  s.end += 1
  s.starter = s.starter === 0 ? 1 : 0
  s.turn = s.starter
  s.thrown = [0, 0]
  s.stones = []
  s.lastEnd = null
  s.phase = 'aim'
}
