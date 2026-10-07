/** おとなも むちゅうの5本（ラインぎわ ストップ・キッチン カーリング・よみあい サーブ・リアクション ボレー・ピタッと 10びょう） */
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../core/rng'
import { BALL_R, CENTER, createCurling, ENDS, launchPoint, restPoint, scoreEnd, stepCurling, STONES, throwStone } from './curling/curling'
import type { CuEvent, CuState, Stone } from './curling/curling'
import { badness, createLs, judge, LINE, LINE_W, makeRoll, posAt, restPos, stepLs, stopBall, TIME_SCALE } from './linestop/linestop'
import type { LsEvent } from './linestop/linestop'
import { createRx, FOUL_MS, stepRx, tapRx, totals, TRIES as RX_TRIES } from './reaction/reaction'
import type { RxEvent } from './reaction/reaction'
import { choose, createSr, currentStep, finishStep, isFinal, ROUNDS, SPOT_POINTS, SPOTS, stepSr, toggleDouble } from './serveread/serveread'
import type { Spot, SrEvent, SrState } from './serveread/serveread'
import type { Side } from '../core/players'
import { createS10, HIDE_AT, stepS10, tapS10, TRIES as S10_TRIES, visible } from './stop10/stop10'

const DT = 1 / 60

describe('ラインぎわ ストップ', () => {
  it('ラインに触れたらイン（真下＝中心で見る）。上から重なって見えても、真下が外ならアウト', () => {
    expect(judge(LINE + 1).kind).toBe('line')
    expect(judge(LINE + LINE_W).kind).toBe('line')
    // ボールの はしはラインに重なるが、中心はラインの外
    expect(judge(LINE + LINE_W + 2).kind).toBe('out')
    const c = judge(LINE - 10)
    expect(c.kind).toBe('in')
    if (c.kind === 'in') expect(c.gap).toBeCloseTo(10 - 0.8, 6)
    expect(badness({ kind: 'line' })).toBeLessThan(badness({ kind: 'in', gap: 1 }))
    expect(badness({ kind: 'in', gap: 300 })).toBeLessThan(badness({ kind: 'out', over: 0.1 }))
  })

  it('ころがりは、決めた所で自然に止まる', () => {
    const rand = mulberry32(4)
    for (let i = 0; i < 50; i++) {
      const r = makeRoll(rand)
      expect(posAt(r, 999)).toBeCloseTo(restPos(r), 6)
    }
  })

  it('同じ球でも、ちびっこの方はゆっくり進む', () => {
    expect(TIME_SCALE.chibi).toBeLessThan(TIME_SCALE.senshu)
    const s = createLs(['chibi', 'senshu'], mulberry32(1))
    stepLs(s, 2)
    stepLs(s, 0.5)
    expect(s.lanes[0].pos).toBeLessThan(s.lanes[1].pos)
  })

  it('ラインに近く止めた人の勝ち。先に3本で終わり', () => {
    const s = createLs(['otona', 'otona'], mulberry32(2))
    const ev: LsEvent[] = []
    for (let i = 0; i < 4000 && s.phase !== 'over'; i++) {
      // 下の人は ラインの10cm手前で止める。上の人は止めない（たいていアウト）
      if (s.phase === 'roll' && !s.lanes[0].stopped && s.lanes[0].pos >= LINE - 10) stopBall(s, 0, ev)
      ev.push(...stepLs(s, DT))
    }
    expect(ev.find((e) => e.type === 'over')).toMatchObject({ winner: 0 })
    expect(s.wins[0]).toBe(3)
  })
})

function playThrow(s: CuState, dx: number, dy: number): CuEvent[] {
  const ev: CuEvent[] = []
  throwStone(s, s.turn, dx, dy, ev)
  for (let i = 0; i < 3000 && s.phase === 'moving'; i++) ev.push(...stepCurling(s, DT))
  return ev
}

describe('キッチン カーリング', () => {
  it('引いた反対へ飛んで、予想どおりの所に止まる', () => {
    const s = createCurling(['otona', 'otona'])
    // 下の人：下へ引く → 上へ飛ぶ
    const p = launchPoint(0)
    const pull = { dx: 0, dy: 25 }
    const v = { vx: 0, vy: -Math.min(115, 25 * 2.4) }
    const rest = restPoint(p.x, p.y, v.vx, v.vy)
    playThrow(s, pull.dx, pull.dy)
    expect(s.stones[0].x).toBeCloseTo(rest.x, 1)
    expect(s.stones[0].y).toBeCloseTo(rest.y, 0)
    expect(s.turn).toBe(1)
  })

  it('うしろ向きには投げられない', () => {
    const s = createCurling(['otona', 'otona'])
    expect(throwStone(s, 0, 0, -20)).toBe(false)
    expect(throwStone(s, 1, 0, 20)).toBe(false)
  })

  it('当てると、当てられたボールが動く', () => {
    const s = createCurling(['otona', 'otona'])
    const target: Stone = { id: 99, side: 1, x: CENTER.x, y: CENTER.y, vx: 0, vy: 0 }
    s.stones.push(target)
    // まっすぐ中心へ強めに
    const ev = playThrow(s, 0, 40)
    expect(ev.some((e) => e.type === 'hit')).toBe(true)
    const moved = s.stones.find((st) => st.id === 99)
    expect(!moved || moved.y < CENTER.y - 2).toBe(true)
  })

  it('点の数え方：いちばん近い側が、相手のいちばん近い球より近い数だけ', () => {
    const st = (side: 0 | 1, d: number): Stone => ({ id: Math.random(), side, x: CENTER.x + d, y: CENTER.y, vx: 0, vy: 0 })
    expect(scoreEnd([st(0, 1), st(0, 4), st(1, 6), st(0, 9)])).toEqual({ side: 0, points: 2 })
    expect(scoreEnd([st(1, 2), st(0, 3)])).toEqual({ side: 1, points: 1 })
    expect(scoreEnd([st(0, 40)])).toEqual({ side: null, points: 0 })
    expect(scoreEnd([st(0, 3), st(0, 8)])).toEqual({ side: 0, points: 2 })
    expect(BALL_R).toBeGreaterThan(0)
  })

  it(`1エンド${STONES}球ずつ・${ENDS}エンドで終わる`, () => {
    const s = createCurling(['otona', 'otona'])
    const ev: CuEvent[] = []
    for (let i = 0; i < 200 && s.phase !== 'over'; i++) {
      if (s.phase === 'aim') ev.push(...playThrow(s, (i % 5) - 2, s.turn === 0 ? 26 : -26))
      else ev.push(...stepCurling(s, DT))
      while (s.phase === 'endScore') ev.push(...stepCurling(s, DT))
    }
    expect(ev.filter((e) => e.type === 'end').length).toBeGreaterThanOrEqual(ENDS)
    expect(s.phase).toBe('over')
  })
})

describe('よみあい サーブ', () => {
  /** いまの段どりの人が選んで「きめた」まで（選ぶ所は who→spot で決める） */
  function playServe(s: SrState, pickFor: (side: Side, kind: 'first' | 'last') => Spot | null, ev: SrEvent[] = []) {
    while (s.phase === 'intro') ev.push(...stepSr(s, DT))
    let guard = 0
    while (s.phase === 'pick' && guard++ < 100) {
      const st = currentStep(s)!
      const spot = pickFor(st.side, st.kind)
      if (spot) choose(s, st.side, spot)
      if (!finishStep(s, st.side, ev)) {
        // 選ばなかったら時間ぎれまで待つ
        while (s.phase === 'pick' && currentStep(s) === st) ev.push(...stepSr(s, 0.5))
      }
    }
    return ev
  }
  const toNext = (s: SrState, ev: SrEvent[] = []) => {
    while (s.phase === 'reveal') ev.push(...stepSr(s, DT))
    return ev
  }

  it('3択。点は そと3・まんなか2・からだ1', () => {
    expect(SPOTS).toHaveLength(3)
    expect(SPOT_POINTS).toEqual({ wide: 3, center: 2, body: 1 })
  })

  it('サーブ側 → レシーブ側 → さいごの かけひき（サーブ側 → レシーブ側）の順に、1人ずつ選ぶ', () => {
    const s = createSr(20)
    const order: string[] = []
    playServe(s, (side, kind) => {
      order.push(`${side}-${kind}`)
      return 'wide'
    })
    expect(order).toEqual(['0-first', '1-first', '0-last', '1-last'])
    // 番でない人は選べない
    const t = createSr(20)
    while (t.phase === 'intro') stepSr(t, DT)
    expect(choose(t, 1, 'body')).toBe(false)
    expect(choose(t, 0, 'body')).toBe(true)
  })

  it('てわたし：さいごの かけひきは なく、サーブ側 → レシーブ側の 2回だけ選ぶ', () => {
    const s = createSr(20, false)
    const order: string[] = []
    playServe(s, (side, kind) => {
      order.push(`${side}-${kind}`)
      return 'wide'
    })
    expect(order).toEqual(['0-first', '1-first'])
    expect(s.last).toMatchObject({ read: true, gainer: 1, points: 3 })
    toNext(s)
    expect(s.steps.map((x) => x.kind)).toEqual(['first', 'first'])
  })

  it('読まれなければサーブ側、読まれたらレシーブ側が、ねらった所の点をとる', () => {
    const s = createSr(20)
    playServe(s, (side) => (side === 0 ? 'wide' : 'body'))
    expect(s.last).toMatchObject({ read: false, gainer: 0, points: 3 })
    toNext(s)
    // 2回目は上の人のサーブ。読まれる
    playServe(s, () => 'center')
    expect(s.last).toMatchObject({ server: 1, read: true, gainer: 0, points: 2 })
    expect(s.score).toEqual([5, 0])
  })

  it('さいごの かけひきで選びなおせる', () => {
    const s = createSr(20)
    playServe(s, (side, kind) => (side === 1 ? (kind === 'first' ? 'body' : 'wide') : 'wide'))
    expect(s.last).toMatchObject({ read: true, gainer: 1 })
  })

  it('さいごのラウンドは2倍。2ばいカードは とれたら2倍、とれなかったら むだ（1回だけ）', () => {
    const s = createSr(20)
    // ラウンド1・2 は ひきわけになるように（読まれない、同じ点）
    for (let i = 0; i < 4; i++) {
      playServe(s, (side) => (side === s.server ? 'center' : 'body'))
      toNext(s)
    }
    expect(s.round).toBe(3)
    expect(isFinal(s)).toBe(true)
    // ファイナル：サーブ側（下）が2ばいカード。読まれない → 3 × 2(ファイナル) × 2(カード) = 12
    while (s.phase === 'intro') stepSr(s, DT)
    toggleDouble(s, 0)
    playServe(s, (side) => (side === 0 ? 'wide' : 'body'))
    expect(s.last).toMatchObject({ gainer: 0, points: 12 })
    expect(s.doubleUsed[0]).toBe(true)
    toNext(s)
    // 上の人がカードを使って読まれた → カードは むだ（レシーブ側の下の人が 1×2）
    toggleDouble(s, 1)
    playServe(s, () => 'body')
    expect(s.last).toMatchObject({ gainer: 0, points: 2 })
    expect(s.doubleUsed[1]).toBe(true)
    expect(toggleDouble(s, 1)).toBe(false)
  })

  it('3ラウンドで終わる。同点ならサドンデス', () => {
    const s = createSr(20)
    const ev: SrEvent[] = []
    for (let i = 0; i < 6; i++) {
      playServe(s, (side) => (side === s.server ? 'center' : 'body'), ev)
      toNext(s, ev)
    }
    // 2人とも 2点ずつ×2回 ＋ ファイナルで4点ずつ → 同点 → サドンデス
    expect(s.phase).toBe('pick')
    expect(s.round).toBe(ROUNDS + 1)
    // サドンデスは上の人のサーブから。下の人が読んで +2×2、次は上の人が読んで +1×2
    playServe(s, () => 'center', ev)
    toNext(s, ev)
    playServe(s, () => 'body', ev)
    toNext(s, ev)
    expect(ev.find((e) => e.type === 'over')).toMatchObject({ winner: 0 })
  })

  it('時間ぎれまで選ばなかったら、かわりに選ぶ', () => {
    const s = createSr(15)
    playServe(s, () => null)
    expect(s.last?.auto).toEqual([true, true])
    expect(SPOTS).toContain(s.last?.serve)
  })
})

describe('リアクション ボレー', () => {
  it('球が見えてからタップまでの時間を5回はかる。早すぎたらフライング', () => {
    const rand = mulberry32(3)
    const s = createRx('kids', rand)
    const ev: RxEvent[] = []
    let i = 0
    while (s.phase !== 'over' && i++ < 100000) {
      ev.push(...stepRx(s, DT, rand))
      // 1回目はフライング、あとは球が見えて 0.25秒後
      if (s.results.length === 0 && s.phase === 'wait' && s.t > 0.5) tapRx(s, ev, rand)
      else if (s.phase === 'go' && s.t >= 0.25) tapRx(s, ev, rand)
    }
    expect(s.results).toHaveLength(RX_TRIES)
    expect(s.results[0]).toBe(FOUL_MS)
    expect(s.fouls).toBe(1)
    const t = totals(s)
    expect(t.score).toBe(t.avg + 100)
  })

  it('おとな・せんしゅにはフェイントがまざる', () => {
    let fakes = 0
    for (let seed = 1; seed < 40; seed++) {
      const rand = mulberry32(seed)
      const s = createRx('senshu', rand)
      for (let i = 0; i < 600; i++) for (const e of stepRx(s, DT, rand)) if (e.type === 'fake') fakes++
    }
    expect(fakes).toBeGreaterThan(3)
  })
})

describe('ピタッと 10びょう', () => {
  it('10秒とのずれを3回はかり、いちばん近い記録が残る', () => {
    const s = createS10('otona')
    const stops = [9.5, 10.12, 10.6]
    for (const at of stops) {
      tapS10(s)
      while (s.t + DT < at) stepS10(s, DT)
      s.t = at
      tapS10(s)
      while (s.phase === 'shown') stepS10(s, DT)
    }
    expect(s.results).toEqual([500, 120, 600])
    expect(s.phase).toBe('over')
    expect(S10_TRIES).toBe(3)
  })

  it('時計は とちゅうで見えなくなる（せんしゅほど早い）', () => {
    expect(HIDE_AT.senshu).toBeLessThan(HIDE_AT.chibi)
    const s = createS10('otona')
    tapS10(s)
    stepS10(s, 2)
    expect(visible(s)).toBe(true)
    stepS10(s, 2)
    expect(visible(s)).toBe(false)
  })
})
