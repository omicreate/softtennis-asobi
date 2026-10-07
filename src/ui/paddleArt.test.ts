import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOKS, DESIGNS, SHAPES } from './paddleArt'

describe('ラケットの かたち', () => {
  it('どの形もルールの範囲（全長720mm以内・フェイス面積120平方インチ以内。競技規則 第16条）', () => {
    for (const [id, s] of Object.entries(SHAPES)) {
      const length = s.faceCm * (1 + s.grip)
      const area = (Math.PI / 4) * s.faceCm * s.faceCm * s.ratio
      expect(length, id).toBeLessThanOrEqual(72)
      expect(area, id).toBeLessThanOrEqual(120 * 2.54 * 2.54)
    }
  })
  it('スタンダードは実物に近い比率（頭31cm×24cm、のど＋グリップ37cm）', () => {
    expect(SHAPES.std.ratio).toBeCloseTo(24 / 31, 6)
    expect(SHAPES.std.grip).toBeCloseTo(37 / 31, 6)
  })
  it('はじめのラケットは、下の人オレンジ・上の人あお', () => {
    expect(DEFAULT_LOOKS.map((l) => DESIGNS[l.design].base)).toEqual(['#ff8a3d', '#3d9be9'])
  })
})
