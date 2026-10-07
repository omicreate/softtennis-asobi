import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../core/players'
import { mulberry32 } from '../../core/rng'
import { courtBox, decoyLook, DIFF, feet, hitDiff, makeDiff, makeWally, REAL, sameLook, WALLY, zoneOf } from './sagasu'

describe('さがせ！ピクルくん', () => {
  it('ほんものは1人だけ。にせものは どれも どこかがちがう', () => {
    const rand = mulberry32(1)
    for (const lv of LEVELS) {
      for (let k = 0; k < 20; k++) {
        const r = makeWally(lv, 100, 150, rand)
        const reals = r.scene.people.filter((p) => sameLook(p.look, REAL))
        expect(reals.map((p) => p.id), lv).toEqual([r.target])
        expect(r.scene.people.length, lv).toBeGreaterThanOrEqual(WALLY[lv].people * 0.8)
      }
    }
  })

  it('ほんものの場所（キッチン・サービスコート・コートの そと）は、足もとで決まる', () => {
    const rand = mulberry32(2)
    const seen = new Set<string>()
    for (let k = 0; k < 60; k++) {
      const r = makeWally('kids', 100, 150, rand)
      const p = r.scene.people.find((x) => x.id === r.target)!
      expect(zoneOf(r.scene.court, feet(p).x, feet(p).y)).toBe(r.zone)
      seen.add(r.zone)
    }
    expect([...seen].sort()).toEqual(['kitchen', 'outside', 'service'])
  })

  it('キッチンはネットから 2.13m（コートの長さ 13.41m に対して）', () => {
    const c = courtBox(100, 150)
    expect(c.k / c.h).toBeCloseTo(2.13 / 13.41, 6)
    expect(c.w / c.h).toBeCloseTo(0.455, 3)
    expect(zoneOf(c, c.x + c.w / 2, c.y + c.h / 2)).toBe('kitchen')
    expect(zoneOf(c, c.x + c.w / 2, c.y + 1)).toBe('service')
    expect(zoneOf(c, c.x - 1, c.y + c.h / 2)).toBe('outside')
  })

  it('ちびっこの にせものは ちがいが多く、せんしゅは1か所だけ', () => {
    const rand = mulberry32(3)
    const diffCount = (l: ReturnType<typeof decoyLook>) => (Object.keys(REAL) as (keyof typeof REAL)[]).filter((k) => l[k] !== REAL[k]).length
    for (let k = 0; k < 50; k++) {
      expect(diffCount(decoyLook('chibi', WALLY.chibi.changes, rand))).toBeGreaterThanOrEqual(2)
      expect(diffCount(decoyLook('senshu', WALLY.senshu.changes, rand))).toBeLessThanOrEqual(1)
    }
  })

  it('同じ種なら同じ場面（じゅんばんモードで公平に）', () => {
    const a = makeWally('otona', 100, 150, mulberry32(42))
    const b = makeWally('otona', 100, 150, mulberry32(42))
    expect(a).toEqual(b)
  })
})

describe('まちがいさがし', () => {
  it('レベルの数だけ ちがいがあり、場所が重ならない', () => {
    const rand = mulberry32(4)
    for (const lv of LEVELS) {
      for (let k = 0; k < 20; k++) {
        const r = makeDiff(lv, 100, 85, rand)
        expect(r.diffs.length, lv).toBe(DIFF[lv].diffs)
        expect(new Set(r.diffs.map((d) => d.id)).size).toBe(r.diffs.length)
      }
    }
  })

  it('上の絵は もとのまま、下の絵にだけ ちがいが入る', () => {
    const r = makeDiff('kids', 100, 85, mulberry32(5))
    const looks = (s: typeof r.a) => JSON.stringify([s.people.map((p) => p.look), s.things.map((t) => [t.id, t.color]), s.kitchenColor, s.net])
    expect(looks(r.a)).not.toBe(looks(r.b))
    // もとの絵の人・物は、ちがいを入れても書きかわらない
    const again = makeDiff('kids', 100, 85, mulberry32(5))
    expect(looks(again.a)).toBe(looks(r.a))
  })

  it('タップした所が ちがいの丸に入っていれば見つけた（見つけた物は もう数えない）', () => {
    const r = makeDiff('otona', 100, 85, mulberry32(6))
    const d = r.diffs[0]
    expect(hitDiff(r.diffs, new Set(), d.x, d.y)).toBe(d.id)
    expect(hitDiff(r.diffs, new Set([d.id]), d.x, d.y)).not.toBe(d.id)
    expect(hitDiff(r.diffs, new Set(), -50, -50)).toBeNull()
  })
})
