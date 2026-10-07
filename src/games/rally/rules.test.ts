import { describe, expect, it } from 'vitest'
import { COURT, inKitchen, inServiceCourt, serveHalf } from './court'
import { judgeBounce, judgeHit } from './rules'
import type { RallyState } from './rules'

const N = COURT.NET_Y
const base = (over: Partial<RallyState> = {}): RallyState => ({ lastHitter: 0, shot: 3, bounces: 1, serverX: 4.5, ...over })

describe('コート', () => {
  it('キッチンを囲むラインはキッチン（PBK-0002）', () => {
    expect(inKitchen(N + COURT.KITCHEN)).toBe(true)
    expect(inKitchen(N - COURT.KITCHEN)).toBe(true)
    expect(inKitchen(N + COURT.KITCHEN + 0.01)).toBe(false)
  })
  it('サーブの側：点が0か偶数なら右、奇数なら左（PBK-0036）', () => {
    // 下の人は上を向いているので右＝x が大きい側
    expect(serveHalf(0, 0)).toBe('high')
    expect(serveHalf(0, 3)).toBe('low')
    // 上の人は下を向いているので右＝x が小さい側
    expect(serveHalf(1, 4)).toBe('low')
    expect(serveHalf(1, 5)).toBe('high')
  })
  it('サーブは対角のサービスコートへ（ラインはイン、キッチンは除く）', () => {
    // 下の人が右（x 大）から → 上の陣地の x 小さい側
    expect(inServiceCourt(0, 4.5, 1.0, 2.0)).toBe(true)
    expect(inServiceCourt(0, 4.5, COURT.W / 2, 2.0)).toBe(true)
    expect(inServiceCourt(0, 4.5, 4.5, 2.0)).toBe(false)
    expect(inServiceCourt(0, 4.5, 1.0, N - 1.0)).toBe(false)
  })
})

describe('跳ねたときの判定', () => {
  it('ラインに触れた球はイン（PBK-0029）', () => {
    expect(judgeBounce(base({ lastHitter: 0 }), { x: 0, y: 0 }, 'easy')).toBeNull()
    expect(judgeBounce(base({ lastHitter: 0 }), { x: COURT.W, y: 3 }, 'easy')).toBeNull()
  })
  it('外に落ちたら打った人の失点', () => {
    expect(judgeBounce(base({ lastHitter: 0 }), { x: 3, y: -0.05 }, 'easy')).toEqual({ loser: 0, reason: 'out' })
    expect(judgeBounce(base({ lastHitter: 1 }), { x: 6.2, y: 10 }, 'easy')).toEqual({ loser: 1, reason: 'out' })
  })
  it('2回目に跳ねたら、その陣地の人の失点（PBK-0013）', () => {
    expect(judgeBounce(base({ lastHitter: 0, bounces: 2 }), { x: 3, y: 2 }, 'easy')).toEqual({ loser: 1, reason: 'double-bounce' })
  })
  it('ほんかく：サーブがキッチンラインに落ちたらフォルト（PBK-0021）', () => {
    const s = base({ lastHitter: 0, shot: 0, serverX: 4.5 })
    expect(judgeBounce(s, { x: 1.5, y: N - COURT.KITCHEN }, 'real')).toEqual({ loser: 0, reason: 'serve-kitchen' })
    // かんたんではそのまま続く
    expect(judgeBounce(s, { x: 1.5, y: N - COURT.KITCHEN }, 'easy')).toBeNull()
  })
  it('ほんかく：サーブが対角に入らなければフォルト（PBK-0010）', () => {
    const s = base({ lastHitter: 0, shot: 0, serverX: 4.5 })
    expect(judgeBounce(s, { x: 4.5, y: 2 }, 'real')).toEqual({ loser: 0, reason: 'serve-wrong-court' })
    expect(judgeBounce(s, { x: 1.5, y: 2 }, 'real')).toBeNull()
  })
  it('ほんかく：ラリー中の返球はキッチンに落ちてもイン', () => {
    expect(judgeBounce(base({ lastHitter: 0, shot: 4 }), { x: 3, y: N - 1 }, 'real')).toBeNull()
  })
})

describe('打ったときの判定（ほんかく）', () => {
  it('リターンを跳ねる前に打ったら2バウンドルール違反（PBK-0012）', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 0, bounces: 0 }), 1, 1.0, 'real')).toEqual({ loser: 1, reason: 'two-bounce' })
  })
  it('3球目も跳ねてから', () => {
    expect(judgeHit(base({ lastHitter: 1, shot: 1, bounces: 0 }), 0, 13, 'real')).toEqual({ loser: 0, reason: 'two-bounce' })
  })
  it('4球目からはボレーしてよい。ただしキッチンの中では反則（PBK-0015）', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 2, bounces: 0 }), 1, 1.0, 'real')).toBeNull()
    expect(judgeHit(base({ lastHitter: 0, shot: 2, bounces: 0 }), 1, N - 1.0, 'real')).toEqual({ loser: 1, reason: 'kitchen-volley' })
  })
  it('跳ねた球ならキッチンの中で打ってよい（PBK-0014）', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 5, bounces: 1 }), 1, N - 1.0, 'real')).toBeNull()
  })
  it('かんたんルールでは打ったときの反則はない', () => {
    expect(judgeHit(base({ lastHitter: 0, shot: 0, bounces: 0 }), 1, N - 1.0, 'easy')).toBeNull()
  })
})
