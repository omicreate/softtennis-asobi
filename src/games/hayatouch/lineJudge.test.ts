import { describe, expect, it } from 'vitest'
import { makeLineCase, touchesLine } from './lineJudge'

/** 0〜1 の値を順に返す（テスト用の乱数） */
const seq = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}

describe('ラインジャッジのお題', () => {
  it('どのお題も、球が線に触れているかどうかと答えが食い違わない', () => {
    for (let i = 0; i < 2000; i++) {
      const c = makeLineCase(i % 2 === 0)
      const touch = touchesLine(c.center)
      switch (c.kind) {
        case 'side':
        case 'base':
          // ラインに触れればイン、離れていればアウト（第36条2）
          expect(c.answer).toBe(touch ? 'in' : 'out')
          break
        case 'service-serve':
          // サービスはサービスラインに触れればイン、奥に落ちたらフォールト（第27条(1)・第36条2）
          expect(c.answer).toBe(touch ? 'in' : 'out')
          expect([c.a, c.b].sort()).toEqual(['back', 'service'])
          break
        case 'service-rally':
          // ラリー中はサービスラインは関係ない
          expect(c.answer).toBe('in')
          break
        case 'center-serve':
          // 対角のサービスコート（センターラインを含む）に入ればイン。となりのサービスコートはフォールト（第26条・第27条）
          expect(c.answer).toBe(touch ? 'in' : 'out')
          expect([c.a, c.b].sort()).toEqual(['other-service', 'target'])
          break
      }
    }
  })
  it('サイドラインに少し重なった球はイン', () => {
    // 種類＝side、重なり、触れる、反転なし
    const c = makeLineCase(false, seq(0, 0.5, 0.2, 0.9))
    expect(c.kind).toBe('side')
    expect(touchesLine(c.center)).toBe(true)
    expect(c.answer).toBe('in')
  })
  it('離れた球はアウト。すきまは目で見えるくらい（おとなは1.2cm以上）', () => {
    const c = makeLineCase(false, seq(0, 0, 0.9, 0.9))
    expect(c.answer).toBe('out')
    expect(touchesLine(c.center)).toBe(false)
    expect(c.center - 3.3 - 5).toBeGreaterThanOrEqual(1.2 - 1e-9)
  })
  it('おとな向けには、まぎらわしいお題（ラリー中のサービスライン・センターライン）は出さない', () => {
    for (let i = 0; i < 500; i++) {
      const c = makeLineCase(false)
      expect(['service-rally', 'center-serve']).not.toContain(c.kind)
    }
  })
})
