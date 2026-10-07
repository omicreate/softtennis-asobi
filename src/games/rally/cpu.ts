/**
 * ホークアイ先生（コンピューター）の動き。人と同じく「指」を動かしてエンジンに伝える（ズルはしない）。
 * 球の行き先を先読みして動き、近づいたらネットの方へ振る。
 * 強さ（反応の速さ・動く速さ・ねらいのズレ・振りの強さ）は、相手に選んだレベルで決まる。
 */
import type { Level, Side } from '../../core/players'
import { COURT, inCourt, sideOf, toNet } from './court'
import { FINGER_LEAD } from './engine'
import type { RallyEngine } from './engine'
import { REACH_Z, stepBall } from './physics'
import type { Ball } from './physics'

export interface CpuSkill {
  /** 球の向きが変わってから動き出すまで（秒） */
  react: number
  /** 動く速さの上限（m/s） */
  speed: number
  /** ねらいのズレ（m）。大きいほど空振りする */
  error: number
  /** 振る速さ（m/s）の範囲。大きいほど深く速い球 */
  swing: [number, number]
  /** アウトになる球を見送る */
  judgeOut: boolean
  /** ネットからどれくらい後ろで構えるか（m） */
  depth: number
  /** わざと届かない（空振りする）割合。小さい子が相手でも点が取れるように */
  whiff: number
}

export const CPU_SKILL: Record<Level, CpuSkill> = {
  chibi: { react: 0.4, speed: 3.3, error: 1.2, swing: [0, 4], judgeOut: false, depth: 10.0, whiff: 0.3 },
  kids: { react: 0.3, speed: 4.8, error: 0.8, swing: [0, 8], judgeOut: false, depth: 10.6, whiff: 0.2 },
  otona: { react: 0.2, speed: 6.8, error: 0.45, swing: [3, 12], judgeOut: true, depth: 11.2, whiff: 0.1 },
  senshu: { react: 0.14, speed: 9.5, error: 0.24, swing: [4, 16], judgeOut: true, depth: 11.4, whiff: 0.04 },
}

export interface HitPlan {
  x: number
  y: number
  /** 打つまでの時間（秒） */
  t: number
}

/**
 * 球をコピーして先の動きを計算し、どこで打つかを決める（純粋関数）。
 * null＝打たない（自分に来ていない・アウトになるので見送る）
 */
export function planHit(e: RallyEngine, side: Side, homeY: number, judgeOut: boolean): HitPlan | null {
  if (e.phase !== 'play' || e.state.lastHitter === side) return null
  const b: Ball = { ...e.ball }
  const s = toNet(side)
  if (b.vy * s >= 0) return null
  const real = e.opts.mode === 'real' && e.opts.kind === 'versus'
  // サービスは1回跳ねてからレシーブする（ダイレクトは失ポイント。第32条(2)）
  const mustBounce = real && e.state.shot === 0
  const h = 1 / 60
  const path: { x: number; y: number; z: number; t: number; bounces: number }[] = []
  let first: { x: number; y: number; t: number } | null = null
  let second: { t: number } | null = null
  let cross: { x: number; y: number; t: number; bounces: number } | null = null
  for (let t = h; t < 4; t += h) {
    const py = b.y
    const bounce = stepBall(b, h)
    path.push({ x: b.x, y: b.y, z: b.z, t, bounces: b.bounces })
    if (bounce && b.bounces === 1) first = { ...bounce, t }
    if (bounce && b.bounces >= 2) {
      second = { t }
      break
    }
    if (!cross && sideOf(b.y) === side && (py - homeY) * (b.y - homeY) <= 0 && b.z <= REACH_Z) cross = { x: b.x, y: homeY, t, bounces: b.bounces }
  }
  // アウトになる球は見送る（跳ねる前に打つと、入っていなくても続いてしまう）
  if (judgeOut && first && sideOf(first.y) === side && !inCourt(first.x, first.y)) return null
  if (cross && cross.bounces < 2) {
    const volley = cross.bounces === 0
    const ok = !volley || !mustBounce
    if (ok) return cross
  }
  // 構えた場所では届かない・打てないとき：1回跳ねたあと、2回目が来る前の場所まで動いて打つ
  if (first && sideOf(first.y) === side) {
    const tEnd = second ? second.t : first.t + 1.2
    const tHit = first.t + (tEnd - first.t) * 0.45
    const p = path.find((q) => q.t >= tHit && q.bounces === 1)
    if (p && sideOf(p.y) === side) return { x: p.x, y: p.y, t: p.t }
  }
  return null
}

export class Cpu {
  readonly side: Side
  readonly skill: CpuSkill
  private readonly rand: () => number
  private fx: number
  private fy: number
  private lastShot = -1
  private lastHitter: Side | null = null
  private since = 0
  private err = 0
  private swingV = 0
  private serveT = 0

  constructor(side: Side, skill: CpuSkill, rand: () => number = Math.random) {
    this.side = side
    this.skill = skill
    this.rand = rand
    this.fx = COURT.W / 2
    this.fy = this.homeY() - toNet(side) * FINGER_LEAD
  }

  /** 構える位置（ラケットの y） */
  private homeY(): number {
    return COURT.NET_Y - toNet(this.side) * this.skill.depth
  }

  private moveToward(x: number, y: number, dt: number): void {
    const dx = x - this.fx
    const dy = y - this.fy
    const d = Math.hypot(dx, dy)
    const max = this.skill.speed * dt
    if (d <= max) {
      this.fx = x
      this.fy = y
    } else {
      this.fx += (dx / d) * max
      this.fy += (dy / d) * max
    }
  }

  update(e: RallyEngine, dt: number): void {
    const s = toNet(this.side)
    const home = this.homeY()

    // サービス：構えてから少し待って、ネットへ向けて振る（振り終わっても出なければ構え直す）
    if (e.phase === 'serve' && e.server === this.side) {
      this.serveT += dt
      if (this.serveT < 1.0 || this.serveT > 1.6) {
        if (this.serveT > 1.6) this.serveT = 0.5
        this.moveToward(COURT.W / 2 + 1.2, home - s * FINGER_LEAD, dt)
      } else {
        this.fy += s * 8 * dt
      }
      e.setFinger(this.side, true, this.fx, this.fy)
      return
    }
    this.serveT = 0

    // 新しい球が来たら、ねらいのズレと振る強さを決め直す
    if (e.state.shot !== this.lastShot || e.state.lastHitter !== this.lastHitter) {
      this.lastShot = e.state.shot
      this.lastHitter = e.state.lastHitter
      this.since = 0
      this.err = (this.rand() * 2 - 1) * this.skill.error
      // ときどき、届かないところへ動いて空振りする
      if (this.rand() < this.skill.whiff) this.err = (this.rand() < 0.5 ? -1 : 1) * (e.paddles[this.side].width / 2 + 0.6)
      const [a, b] = this.skill.swing
      this.swingV = a + this.rand() * (b - a)
    }
    this.since += dt

    const plan = this.since >= this.skill.react ? planHit(e, this.side, home, this.skill.judgeOut) : null
    if (plan) {
      if (plan.t < 0.16) {
        // 当たる直前：横は合わせ続け、縦はネットの方へ振る
        this.moveToward(plan.x + this.err, this.fy, dt)
        this.fy += s * this.swingV * dt
      } else {
        this.moveToward(plan.x + this.err, plan.y - s * FINGER_LEAD, dt)
      }
    } else if (e.phase === 'play' && e.state.lastHitter === this.side) {
      // 打ったあとは構える位置へ戻る
      this.moveToward(COURT.W / 2, home - s * FINGER_LEAD, dt)
    }
    e.setFinger(this.side, true, this.fx, this.fy)
  }
}
