import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { GAMES } from '../games'
import { defaultTeams, pickGames, pointsFor, ranks, standings, teamTotals, totals } from './scoring'

const POOL = GAMES.filter((g) => g.party).map((g) => g.id)

describe('じゅんばんモード', () => {
  it('使うゲームは ひとりで遊ぶゲームで、記録の単位がある', () => {
    expect(POOL.length).toBeGreaterThanOrEqual(4)
    for (const g of GAMES.filter((x) => x.party)) {
      expect(g.players).toBe(1)
      expect(g.unit).toBeTruthy()
    }
  })

  it('全部出るまで同じゲームは出ない。続けて同じゲームにもならない', () => {
    for (let seed = 1; seed < 30; seed++) {
      const gs = pickGames(POOL, POOL.length * 2, mulberry32(seed))
      expect(new Set(gs.slice(0, POOL.length)).size).toBe(POOL.length)
      for (let i = 1; i < gs.length; i++) expect(gs[i]).not.toBe(gs[i - 1])
    }
  })

  it('順位：大きい記録が上。同じ記録は同じ順位', () => {
    expect(ranks([10, 30, 20])).toEqual([3, 1, 2])
    expect(ranks([5, 5, 1])).toEqual([1, 1, 3])
    expect(pointsFor(1)).toBe(3)
    expect(pointsFor(3)).toBe(1)
    expect(pointsFor(4)).toBe(0)
  })

  it('合計点と優勝', () => {
    // 3人・2ラウンド
    const scores = [
      [100, 50, 80],
      [3, 9, 9],
    ]
    expect(totals(scores, 3)).toEqual([3 + 1, 1 + 3, 2 + 3])
    const st = standings(scores, 3)
    expect(st[0]).toEqual({ player: 2, total: 5, rank: 1 })
    expect(st.map((s) => s.rank)).toEqual([1, 2, 2])
  })

  it('まだ全員が遊んでいないラウンドは数えない', () => {
    expect(totals([[10, 20], [5]], 2)).toEqual([2, 3])
  })
})

describe('じゅんばんモード（小さいほど良い記録・チーム戦）', () => {
  it('反応の時間やずれは、小さい記録が上', () => {
    expect(ranks([250, 180, 300], true)).toEqual([2, 1, 3])
    // 1ラウンド目は大きいほど良い、2ラウンド目は小さいほど良い
    // 1ラウンド目：20が1位（3点）・10が2位（2点）。2ラウンド目：200が1位・300が2位
    expect(totals([[10, 20], [300, 200]], 2, [false, true])).toEqual([4, 6])
  })

  it('チームの点：メンバーの点を足す。人数がちがうときは そろえる', () => {
    // 3人：0と2がチーム0、1がチーム1
    const scores = [[30, 20, 10]]
    // 点：3・2・1 → チーム0は 3+1=4（2人）、チーム1は 2（1人）→ 2人にそろえて 4
    expect(teamTotals(scores, [0, 1, 0])).toEqual([4, 4])
    expect(teamTotals([[30, 20, 10, 5]], [0, 0, 1, 1])).toEqual([5, 1])
    expect(defaultTeams(5)).toEqual([0, 1, 0, 1, 0])
  })
})
