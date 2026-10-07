/**
 * ピクルくんジャンプ（ひとりで）。React に依存しない純粋な計算。
 * ピクルくんはコートを走り続け、右からピックルボールやネットが流れてくる。
 * タップでジャンプ。空中でもう一度タップすると2段目・3段目まで跳べる（地面に着くと戻る）。
 * 座標は m：ピクルくんの足もとが x=0、地面が y=0。右が +x、上が +y。
 */
import type { Level } from '../../core/players'

/** 空中で跳べる回数（地面からのジャンプを含めて3回） */
export const MAX_JUMPS = 3
export const GRAVITY = 24
/** 1段目・2段目・3段目の跳ぶ速さ（だんだん弱く） */
export const JUMP_V = [9.2, 8.2, 7.4]
/** ピクルくんの大きさ（当たり判定。見た目より少し小さくして、ぎりぎりはセーフにする） */
export const BODY = { w: 0.5, h: 0.95 }
export const BALL_R = 0.24

export type ObstacleKind = 'roll' | 'bounce' | 'fly-low' | 'fly-high' | 'drive' | 'net' | 'net-tall'

export interface Obstacle {
  kind: ObstacleKind
  x: number
  y: number
  vx: number
  vy: number
  /** ネットの高さ（ネットのとき） */
  h: number
  passed: boolean
}

export interface RunnerLevel {
  /** はじめの走る速さ（m/s） */
  speed: number
  /** 1秒ごとに速くなる量 */
  accel: number
  maxSpeed: number
  lives: number
  /** 次の障害までの間隔（秒）のはじめと、いちばん短いとき */
  gap: [number, number]
  kinds: ObstacleKind[]
}

export const RUNNER_LEVEL: Record<Level, RunnerLevel> = {
  chibi: { speed: 3.6, accel: 0.03, maxSpeed: 5, lives: 5, gap: [2.6, 1.8], kinds: ['roll', 'roll', 'bounce'] },
  kids: { speed: 4.4, accel: 0.04, maxSpeed: 6.5, lives: 3, gap: [2.2, 1.4], kinds: ['roll', 'bounce', 'fly-low', 'net'] },
  otona: { speed: 5.4, accel: 0.05, maxSpeed: 8, lives: 3, gap: [1.9, 1.1], kinds: ['roll', 'bounce', 'fly-low', 'fly-high', 'drive', 'net'] },
  senshu: { speed: 6.4, accel: 0.06, maxSpeed: 9.5, lives: 2, gap: [1.6, 0.9], kinds: ['roll', 'bounce', 'fly-low', 'fly-high', 'drive', 'net', 'net-tall'] },
}

export type RPhase = 'play' | 'over'

export interface RunnerState {
  level: Level
  t: number
  speed: number
  /** 走った距離（m） */
  dist: number
  /** ピクルくんの高さ・上下の速さ */
  y: number
  vy: number
  /** 今の空中で使ったジャンプの回数（地面に着くと 0） */
  jumps: number
  lives: number
  /** ぶつかったあと、しばらく当たらない（秒） */
  safe: number
  obstacles: Obstacle[]
  /** 次の障害が出るまで（秒） */
  next: number
  /** よけた数 */
  dodged: number
  phase: RPhase
}

export type REvent = { type: 'jump'; n: number } | { type: 'land' } | { type: 'hit'; livesLeft: number } | { type: 'dodge'; kind: ObstacleKind } | { type: 'over' }

/** 画面の右端（ここから出てくる）とうしろ（ここで消える） */
export const SPAWN_X = 11
const DESPAWN_X = -3

export function createRunner(level: Level): RunnerState {
  const lv = RUNNER_LEVEL[level]
  return { level, t: 0, speed: lv.speed, dist: 0, y: 0, vy: 0, jumps: 0, lives: lv.lives, safe: 0, obstacles: [], next: 1.4, dodged: 0, phase: 'play' }
}

/** タップ：跳べれば跳ぶ（3段まで） */
export function jump(s: RunnerState, ev: REvent[] = []): boolean {
  if (s.phase !== 'play' || s.jumps >= MAX_JUMPS) return false
  s.vy = JUMP_V[s.jumps]
  s.jumps += 1
  ev.push({ type: 'jump', n: s.jumps })
  return true
}

export function makeObstacle(kind: ObstacleKind, speed: number, rand: () => number): Obstacle {
  const base = { kind, x: SPAWN_X, vx: -speed, vy: 0, h: 0, passed: false }
  switch (kind) {
    case 'roll':
      return { ...base, y: BALL_R }
    case 'bounce':
      // はずみながら来る球。高さはその時しだい（ジャンプのタイミングが大事）
      return { ...base, y: 1.2 + rand() * 1.0, vy: 0 }
    case 'fly-low':
      // 低く飛んでくる球：ジャンプでこえる
      return { ...base, y: 0.55, vx: -speed * 1.15 }
    case 'fly-high':
      // 高く飛んでくる球：跳ばずに走ればくぐれる（跳ぶと当たる）
      return { ...base, y: BODY.h + BALL_R + 0.4, vx: -speed * 1.15 }
    case 'drive':
      // 速いドライブ
      return { ...base, y: 0.45, vx: -speed * 1.7 }
    case 'net':
      return { ...base, y: 0, h: 0.92 }
    case 'net-tall':
      // 高いネット：2段・3段ジャンプでこえる
      return { ...base, y: 0, h: 2.3 }
  }
}

/** 当たったか（ピクルくんの四角と、球の丸／ネットの四角） */
export function hits(s: RunnerState, o: Obstacle): boolean {
  const x0 = -BODY.w / 2
  const x1 = BODY.w / 2
  const y0 = s.y + 0.05
  const y1 = s.y + BODY.h
  if (o.kind === 'net' || o.kind === 'net-tall') {
    const nw = 0.12
    return o.x + nw > x0 && o.x - nw < x1 && o.h > y0
  }
  const cx = Math.min(x1, Math.max(x0, o.x))
  const cy = Math.min(y1, Math.max(y0, o.y))
  const r = BALL_R * 0.85
  return (o.x - cx) ** 2 + (o.y - cy) ** 2 < r * r
}

export function stepRunner(s: RunnerState, dt: number, rand: () => number = Math.random): REvent[] {
  const ev: REvent[] = []
  if (s.phase !== 'play') return ev
  const lv = RUNNER_LEVEL[s.level]
  s.t += dt
  s.speed = Math.min(lv.maxSpeed, lv.speed + lv.accel * s.t)
  s.dist += s.speed * dt
  s.safe = Math.max(0, s.safe - dt)

  // ピクルくん
  if (s.y > 0 || s.vy > 0) {
    s.vy -= GRAVITY * dt
    s.y += s.vy * dt
    if (s.y <= 0) {
      s.y = 0
      s.vy = 0
      s.jumps = 0
      ev.push({ type: 'land' })
    }
  }

  // 障害を出す（だんだん間隔が短くなる）
  s.next -= dt
  if (s.next <= 0) {
    const kind = lv.kinds[Math.floor(rand() * lv.kinds.length)]
    s.obstacles.push(makeObstacle(kind, s.speed, rand))
    const k = Math.min(1, s.t / 60)
    const gap = lv.gap[0] + (lv.gap[1] - lv.gap[0]) * k
    s.next = gap * (0.8 + rand() * 0.5)
  }

  // 障害を動かす
  for (const o of s.obstacles) {
    o.x += o.vx * dt
    if (o.kind === 'bounce') {
      o.vy -= GRAVITY * 0.6 * dt
      o.y += o.vy * dt
      if (o.y <= BALL_R) {
        o.y = BALL_R
        o.vy = Math.sqrt(2 * GRAVITY * 0.6 * 1.6)
      }
    }
    if (!o.passed && s.safe === 0 && hits(s, o)) {
      o.passed = true
      s.lives -= 1
      s.safe = 1.2
      ev.push({ type: 'hit', livesLeft: s.lives })
      if (s.lives <= 0) {
        s.phase = 'over'
        ev.push({ type: 'over' })
        return ev
      }
    } else if (!o.passed && o.x < -BODY.w) {
      o.passed = true
      s.dodged += 1
      ev.push({ type: 'dodge', kind: o.kind })
    }
  }
  s.obstacles = s.obstacles.filter((o) => o.x > DESPAWN_X)
  return ev
}
