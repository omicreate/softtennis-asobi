/**
 * ポンポン リフティング（ひとり）。React に依存しない純粋な計算。
 * 上から見た場（幅100・高さ160）。ボールは高さ（z）を持ち、地面に影が落ちる。
 * ボールが落ちてきた瞬間（z が0になったとき）にパドルの面の上にあれば、ポンと はねる（1回）。
 * 面の外なら落ちて おしまい。はねるたびに少しずつ速く・遠くへ飛ぶようになる。
 * パドルは上から見た面（原画の形・比率）で、当たり判定もその面の形。
 */
import type { Level } from '../../core/players'
import { FACE_RATIO } from '../../ui/paddleArt'

export const FIELD_W = 100
export const FIELD_H = 160
export const BALL_R = 3.2
export const GRAVITY = 160
/** じゅんばんモードでも、ここまで続いたら おしまい（いつまでも終わらないように） */
export const MAX_COUNT = 99

export interface LiftLevel {
  /** パドルの面の長さ */
  paddle: number
  /** はじめの1回の空中の時間（秒） */
  air: number
  /** はじめに飛ぶ距離・いちばん遠いとき */
  spread: [number, number]
}

export const LIFT_LEVEL: Record<Level, LiftLevel> = {
  chibi: { paddle: 36, air: 1.6, spread: [4, 16] },
  kids: { paddle: 31, air: 1.4, spread: [6, 24] },
  otona: { paddle: 26, air: 1.2, spread: [8, 32] },
  senshu: { paddle: 22, air: 1.05, spread: [10, 40] },
}

export interface LiftState {
  level: Level
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number }
  paddle: { x: number; y: number; len: number; wid: number }
  count: number
  phase: 'ready' | 'play' | 'drop' | 'over'
  /** ready・drop の残り時間 */
  wait: number
}

export type LiftEvent = { type: 'pon'; count: number } | { type: 'drop' } | { type: 'over'; count: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function createLift(level: Level): LiftState {
  const len = LIFT_LEVEL[level].paddle
  const py = FIELD_H * 0.62
  return {
    level,
    // はじめはパドルの真上から落とす（1回目は かんたんに）
    ball: { x: FIELD_W / 2, y: py, z: 40, vx: 0, vy: 0, vz: 0 },
    paddle: { x: FIELD_W / 2, y: py, len, wid: len * FACE_RATIO },
    count: 0,
    phase: 'ready',
    wait: 1.6,
  }
}

/** パドルを動かす（面の中心。場の外には出ない） */
export function movePaddle(s: LiftState, x: number, y: number): void {
  const p = s.paddle
  p.x = clamp(x, p.wid / 2, FIELD_W - p.wid / 2)
  p.y = clamp(y, p.len / 2, FIELD_H - p.len / 2)
}

/** ボールの中心が面（角の丸い四角。上から見て縦長）の上にあるか。ボールの半径の分は大目に見る */
export function onFace(s: LiftState): boolean {
  const p = s.paddle
  const hw = p.wid / 2 + BALL_R * 0.6
  const hl = p.len / 2 + BALL_R * 0.6
  const r = p.wid * 0.36
  const dx = Math.abs(s.ball.x - p.x)
  const dy = Math.abs(s.ball.y - p.y)
  if (dx > hw || dy > hl) return false
  // 角の丸み
  const cx = dx - (hw - r)
  const cy = dy - (hl - r)
  if (cx > 0 && cy > 0) return cx * cx + cy * cy <= r * r
  return true
}

/** 1回の空中の時間（だんだん短く＝速く） */
export function airTime(s: LiftState): number {
  return LIFT_LEVEL[s.level].air * Math.max(0.68, 1 - s.count * 0.012)
}

function bounce(s: LiftState, rand: () => number) {
  const lv = LIFT_LEVEL[s.level]
  const T = airTime(s)
  const b = s.ball
  const p = s.paddle
  // 次に落ちる所：だんだん遠く。面のはしで打つと、そちらへ少し寄る
  const k = Math.min(1, s.count / 40)
  const dist = lv.spread[0] + (lv.spread[1] - lv.spread[0]) * k * (0.6 + 0.4 * rand())
  const a = rand() * Math.PI * 2
  let tx = b.x + Math.cos(a) * dist + (b.x - p.x) * 0.8
  let ty = b.y + Math.sin(a) * dist + (b.y - p.y) * 0.8
  tx = clamp(tx, 14, FIELD_W - 14)
  ty = clamp(ty, 26, FIELD_H - 22)
  b.vx = (tx - b.x) / T
  b.vy = (ty - b.y) / T
  b.vz = (GRAVITY * T) / 2
  b.z = 0
}

export function stepLift(s: LiftState, dt: number, rand: () => number = Math.random): LiftEvent[] {
  const ev: LiftEvent[] = []
  if (s.phase === 'over') return ev
  if (s.phase === 'ready') {
    s.wait -= dt
    if (s.wait <= 0) s.phase = 'play'
    return ev
  }
  const b = s.ball
  if (s.phase === 'drop') {
    // 落ちたボールが小さくはねて止まるまで
    b.x += b.vx * dt * 0.3
    b.y += b.vy * dt * 0.3
    b.vz -= GRAVITY * dt
    b.z = Math.max(0, b.z + b.vz * dt)
    s.wait -= dt
    if (s.wait <= 0) {
      s.phase = 'over'
      ev.push({ type: 'over', count: s.count })
    }
    return ev
  }
  b.vz -= GRAVITY * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.z += b.vz * dt
  if (b.z <= 0 && b.vz < 0) {
    if (onFace(s)) {
      s.count += 1
      ev.push({ type: 'pon', count: s.count })
      if (s.count >= MAX_COUNT) {
        s.phase = 'over'
        ev.push({ type: 'over', count: s.count })
        return ev
      }
      bounce(s, rand)
    } else {
      b.z = 0
      b.vz = 40
      s.phase = 'drop'
      s.wait = 1.1
      ev.push({ type: 'drop' })
    }
  }
  return ev
}
