import { describe, expect, it } from 'vitest'
import { COURT, inCourt, inServiceCourt, serveHalf } from './court'
import { judgeBounce, judgeHit } from './rules'
import type { RallyState } from './rules'

const N = COURT.NET_Y
const base = (over: Partial<RallyState> = {}): RallyState => ({ lastHitter: 0, shot: 3, bounces: 1, serverX: 6, ...over })

describe('コート（競技規則 第5条・第6条、シングルス 第2条）', () => {
  it('シングルスのコートは 23.77m × 8.23m、サービスラインはネットから 6.40m', () => {
    expect(COURT.L).toBeCloseTo(23.77, 6)
    expect(COURT.W).toBeCloseTo(8.23, 6)
    expect(COURT.SERVICE * 2).toBeCloseTo(12.8, 6)
  })
  it('ラインに触れたものはすべてイン（第36条2）', () => {
    expect(inCourt(0, 0)).toBe(true)
    expect(inCourt(COURT.W, COURT.L)).toBe(true)
    expect(inCourt(-0.01, 3)).toBe(false)
  })
  it('サービスはセンターマークの右側から始め、右・左交互（第26条）', () => {
    // 下の人は上を向いているので右＝x が大きい側
    expect(serveHalf(0, 0)).toBe('high')
    expect(serveHalf(0, 1)).toBe('low')
    // 上の人は下を向いているので右＝x が小さい側
    expect(serveHalf(1, 0)).toBe('low')
    expect(serveHalf(1, 3)).toBe('high')
  })
  it('サービスは対角線上のサービスコートへ（サービスライン・サービスセンターラインはイン）', () => {
    // 下の人が右（x 大）から → 上の陣地の x 小さい側
    expect(inServiceCourt(0, 6, 2, N - 3)).toBe(true)
    expect(inServiceCourt(0, 6, COURT.W / 2, N - 3)).toBe(true)
    expect(inServiceCourt(0, 6, 2, N - COURT.SERVICE)).toBe(true)
    expect(inServiceCourt(0, 6, 6, N - 3)).toBe(false)
    expect(inServiceCourt(0, 6, 2, N - COURT.SERVICE - 0.1)).toBe(false)
  })
})

describe('跳ねたときの判定', () => {
  it('外に落ちたら打った人の失ポイント（アウト。第37条(2)）', () => {
    expect(judgeBounce(base({ lastHitter: 0 }), { x: 3, y: -0.05 }, 'easy')).toEqual({ loser: 0, reason: 'out' })
    expect(judgeBounce(base({ lastHitter: 1 }), { x: 8.4, y: 18 }, 'easy')).toEqual({ loser: 1, reason: 'out' })
    expect(judgeBounce(base({ lastHitter: 0 }), { x: COURT.W, y: 0 }, 'easy')).toBeNull()
  })
  it('2回目に跳ねたら、その陣地の人の失ポイント（ツーバウンズ。第37条(3)）', () => {
    expect(judgeBounce(base({ lastHitter: 0, bounces: 2 }), { x: 3, y: 2 }, 'easy')).toEqual({ loser: 1, reason: 'double-bounce' })
  })
  it('ほんかく：サービスが対角のサービスコートに入らなければフォールト（第27条(1)）', () => {
    const s = base({ lastHitter: 0, shot: 0, serverX: 6 })
    expect(judgeBounce(s, { x: 6, y: N - 3 }, 'real')).toEqual({ loser: 0, reason: 'fault' })
    expect(judgeBounce(s, { x: 2, y: N - 8 }, 'real')).toEqual({ loser: 0, reason: 'fault' })
    expect(judgeBounce(s, { x: 2, y: N - 3 }, 'real')).toBeNull()
    // かんたんではコートに入れば続く
    expect(judgeBounce(s, { x: 2, y: N - 8 }, 'easy')).toBeNull()
  })
})

describe('打ったときの判定（ほんかく）', () => {
  it('サービスを跳ねる前に返したらダイレクト（第32条(2)）', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 0, bounces: 0 }), 1, 'real')).toEqual({ loser: 1, reason: 'direct' })
  })
  it('1回跳ねたサービスは打ってよい（第30条）', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 0, bounces: 1 }), 1, 'real')).toBeNull()
  })
  it('ラリー中はどこでボレーしてもよい', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 1, bounces: 0 }), 1, 'real')).toBeNull()
  })
  it('かんたんルールでは打ったときの反則はない', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 0, bounces: 0 }), 1, 'easy')).toBeNull()
  })
})
