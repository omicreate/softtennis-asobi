import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOKS, DESIGNS, SHAPES } from './paddleArt'

describe('パドルの かたち', () => {
  it('どの形も公式ルールの大きさ（長さ＋幅61cm以内・長さ43.18cm以内。PBK-0044・3.D.2）', () => {
    for (const [id, s] of Object.entries(SHAPES)) {
      const length = s.faceCm * (1 + s.grip)
      const width = s.faceCm * s.ratio
      expect(length + width, id).toBeLessThanOrEqual(61 + 0.05)
      expect(length, id).toBeLessThanOrEqual(43.18 + 0.05)
    }
  })
  it('スタンダードは原画のパドル（面28cm×20cm・握り13cm）', () => {
    expect(SHAPES.std.ratio).toBeCloseTo(20 / 28, 6)
    expect(SHAPES.std.grip).toBeCloseTo(13 / 28, 6)
  })
  it('はじめのパドルは、下の人オレンジ・上の人あお', () => {
    expect(DEFAULT_LOOKS.map((l) => DESIGNS[l.design].base)).toEqual(['#ff8a3d', '#3d9be9'])
  })
})
