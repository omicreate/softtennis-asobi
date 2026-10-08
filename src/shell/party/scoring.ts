/**
 * じゅんばんモード（2〜6人）の計算。React に依存しない。
 * 1台を順番に回して、同じゲームを1人ずつ遊び、記録で順位を決める（ふつうは大きいほど良い。
 * 反応の時間や10秒とのずれは小さいほど良い）。
 * ラウンドの順位で点をもらい（1位3点・2位2点・3位1点。同じ記録は同じ順位）、合計点で優勝を決める。
 * チーム戦：チームのメンバーの点を足す。人数がちがうときは、多い方の人数にそろえて（平均×人数）くらべる。
 * 同じラウンドでは、全員に同じ乱数の種（seed）を使う＝同じ障害・同じ球が出る。
 */
import type { Level } from '../../core/players'
import type { GameId } from '../games'

export interface PartyPlayer {
  name: string
  color: string
  level: Level
  /** チーム戦のチーム（0 か 1） */
  team?: number
}

export const ROUND_POINTS = [3, 2, 1]

/** ゲームを えらぶ（全部出るまで同じゲームは出さない） */
export function pickGames(pool: GameId[], rounds: number, rand: () => number): GameId[] {
  const out: GameId[] = []
  let bag: GameId[] = []
  while (out.length < rounds) {
    if (!bag.length) {
      bag = [...pool]
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      // 前のラウンドと同じゲームが続かないように
      if (bag.length > 1 && bag[bag.length - 1] === out[out.length - 1]) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]]
    }
    out.push(bag.pop()!)
  }
  return out
}

/** 順位（1から。low＝小さい記録ほど上。同じ記録は同じ順位） */
export function ranks(values: number[], low = false): number[] {
  return values.map((v) => 1 + values.filter((w) => (low ? w < v : w > v)).length)
}

export function pointsFor(rank: number): number {
  return ROUND_POINTS[rank - 1] ?? 0
}

/** ラウンドごとの記録から、合計点。low[i]＝そのラウンドは小さいほど良い。まだ全員が遊んでいないラウンドは数えない */
export function totals(scores: number[][], players: number, low: boolean[] = []): number[] {
  const t = Array.from({ length: players }, () => 0)
  scores.forEach((round, i) => {
    if (round.filter((v) => v !== undefined).length < players) return
    ranks(round, low[i]).forEach((r, p) => (t[p] += pointsFor(r)))
  })
  return t
}

/** 合計点の順位（優勝は1位の人。同点なら同じ順位） */
export function standings(scores: number[][], players: number, low: boolean[] = []): { player: number; total: number; rank: number }[] {
  const t = totals(scores, players, low)
  const r = ranks(t)
  return t.map((total, player) => ({ player, total, rank: r[player] })).sort((a, b) => a.rank - b.rank || a.player - b.player)
}

/** チームの点（人数がちがうときは 多い方の人数にそろえる。小数1けた） */
export function teamTotals(scores: number[][], teams: number[], low: boolean[] = []): [number, number] {
  const t = totals(scores, teams.length, low)
  const size = [0, 1].map((k) => teams.filter((x) => x === k).length)
  const most = Math.max(...size)
  const sum = [0, 1].map((k) => t.reduce((a, v, i) => a + (teams[i] === k ? v : 0), 0))
  return [0, 1].map((k) => (size[k] ? Math.round(((sum[k] * most) / size[k]) * 10) / 10 : 0)) as [number, number]
}

/** はじめのチーム分け：じゅんばんに 0・1・0・1… */
export const defaultTeams = (n: number) => Array.from({ length: n }, (_, i) => i % 2)

/** チーム戦の名前と色 */
export const TEAMS = [
  { name: 'ピクルス', color: '#4d8f2a' },
  { name: 'パドル', color: '#2f8a5f' },
] as const
