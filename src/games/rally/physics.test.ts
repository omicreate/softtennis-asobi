import { describe, expect, it } from 'vitest'
import { COURT, inKitchen } from './court'
import { contact, G, launch, planShot, powerFromSwing, predictLanding, stepBall } from './physics'
import type { Ball } from './physics'

const N = COURT.NET_Y
const ballAt = (x: number, y: number, z = 0.8): Ball => ({ x, y, z, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 })

/** 打ってから最初に跳ねるまで進める */
function flyToBounce(b: Ball) {
  let maxZ = b.z
  let zAtNet = Infinity
  for (let i = 0; i < 4000; i++) {
    const prevY = b.y
    const hit = stepBall(b, 1 / 240)
    maxZ = Math.max(maxZ, b.z)
    if ((prevY - N) * (b.y - N) <= 0) zAtNet = b.z
    if (hit) return { at: hit, maxZ, zAtNet }
  }
  throw new Error('跳ねなかった')
}

describe('打つ強さと落ちる場所', () => {
  it('キッチンライン近くで止めて当てる＝相手のキッチンに落ちる（ディンク）', () => {
    const from = { x: 3, y: N + COURT.KITCHEN + 0.2 }
    const shot = planShot(from, 0, powerFromSwing(0), 0, 0, { keepIn: false })
    expect(inKitchen(shot.target.y)).toBe(true)
    expect(shot.target.y).toBeLessThan(N)
  })
  it('ベースラインから止めて当てると、キッチンの外まで返る', () => {
    const shot = planShot({ x: 3, y: COURT.L }, 0, 0, 0, 0, { keepIn: false })
    expect(inKitchen(shot.target.y)).toBe(false)
    expect(shot.target.y).toBeGreaterThan(0)
  })
  it('速く振るほど奥へ。強すぎると外に出る', () => {
    const from = { x: 3, y: COURT.L }
    const mid = planShot(from, 0, powerFromSwing(6), 0, 0, { keepIn: false })
    const deep = planShot(from, 0, powerFromSwing(12), 0, 0, { keepIn: false })
    const over = planShot(from, 0, powerFromSwing(17), 0, 0, { keepIn: false })
    expect(deep.target.y).toBeLessThan(mid.target.y)
    expect(over.target.y).toBeLessThan(0)
  })
  it('小さい子（keepIn）は強く振ってもコートに入る', () => {
    const shot = planShot({ x: 0.2, y: COURT.L }, 0, 1.4, -1, -8, { keepIn: true })
    expect(shot.target.y).toBeGreaterThan(0)
    expect(shot.target.x).toBeGreaterThanOrEqual(0)
    expect(shot.target.x).toBeLessThanOrEqual(COURT.W)
  })
  it('小さい子のサーブは対角のサービスコートに入る', () => {
    const shot = planShot({ x: 4.5, y: COURT.L + 0.4 }, 0, 0, 0, 0, { keepIn: true, serve: true })
    expect(inKitchen(shot.target.y)).toBe(false)
    expect(shot.target.x).toBeLessThan(COURT.W / 2)
  })
  it('上の人が打つと下の陣地に落ちる', () => {
    const shot = planShot({ x: 3, y: 0 }, 1, 0.5, 0, 0, { keepIn: false })
    expect(shot.target.y).toBeGreaterThan(N)
  })
})

describe('球の飛び方', () => {
  it('狙った場所に落ち、ネットにかからない', () => {
    for (const [fromY, power] of [
      [COURT.L, 1],
      [COURT.L, 0],
      [N + COURT.KITCHEN, 0],
      [N + 0.4, 1],
    ]) {
      const b = ballAt(3, fromY)
      const shot = planShot(b, 0, power, 0.3, 0, { keepIn: false })
      launch(b, shot.target, shot.T, 1)
      expect(predictLanding(b).y).toBeCloseTo(shot.target.y, 1)
      const { at, zAtNet } = flyToBounce(b)
      expect(at.y).toBeCloseTo(shot.target.y, 1)
      expect(at.x).toBeCloseTo(shot.target.x, 1)
      expect(zAtNet).toBeGreaterThan(COURT.NET_H)
    }
  })
  it('受ける人のレベルで遅くしても、落ちる場所は同じ', () => {
    const a = ballAt(3, COURT.L)
    const b = ballAt(3, COURT.L)
    const shot = planShot(a, 0, 0.6, 0, 0, { keepIn: false })
    launch(a, shot.target, shot.T, 1)
    launch(b, shot.target, shot.T, 0.55)
    expect(flyToBounce(b).at.y).toBeCloseTo(flyToBounce(a).at.y, 1)
  })
  it('重力は正の値', () => {
    expect(G).toBeGreaterThan(0)
  })
})

describe('パドルに当たる', () => {
  const paddle = { x: 3, y: 12, vx: 0, vy: 0, width: 1.4 }
  it('球がパドルの線を横切ったら当たる（速くてもすり抜けない）', () => {
    const b = ballAt(3.3, 12.4, 0.5)
    const off = contact({ x: 3.3, y: 11.2 }, b, paddle, paddle, 0, 0.32)
    expect(off).not.toBeNull()
    expect(off!).toBeGreaterThan(0)
  })
  it('横に外れていれば当たらない', () => {
    const b = ballAt(5, 12.05, 0.5)
    expect(contact({ x: 5, y: 11.9 }, b, paddle, paddle, 0, 0.32)).toBeNull()
  })
  it('ネットの向こう（相手の陣地）の球は打てない（PBK-0028）', () => {
    const near = { ...paddle, y: N + 0.3 }
    const b = ballAt(3, N - 0.2, 0.5)
    expect(contact({ x: 3, y: N - 0.4 }, b, near, near, 0, 0.6)).toBeNull()
  })
})
