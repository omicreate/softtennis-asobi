/**
 * ゲームごとの「じこベスト」とメダル（どう・ぎん・きん）。長く遊ぶ目標にする。
 * ひとりで遊んだとき（と、ふたりで協力する ディンク）の記録だけを数える。じゅんばんモードはハンデや時間が
 * ちがうので数えない。目標の数はレベルに関係なく同じ（ミッションと同じ考え方。小さい子はやさしいレベルで届く）。
 */
import type { GameId } from '../shell/games'
import { LEVEL_INFO, LEVELS } from './players'

export type MedalLevel = 0 | 1 | 2 | 3

export interface MedalRule {
  /** どう・ぎん・きん に いる記録 */
  need: [number, number, number]
  /** 小さいほど良い（反応の時間・ずれ） */
  low?: boolean
}

export const MEDAL_RULES: Partial<Record<GameId, MedalRule>> = {
  lift: { need: [5, 15, 30] },
  target: { need: [3, 6, 9] },
  /** ピクルくんに かった レベル（1 ちびっこ・2 キッズ・3 おとな・4 せんしゅ） */
  sensei: { need: [1, 3, 4] },
  reaction: { need: [700, 500, 380], low: true },
}

export const MEDAL_GAMES = Object.keys(MEDAL_RULES) as GameId[]
export const MEDAL_NAME = ['', 'どう', 'ぎん', 'きん'] as const
export const MEDAL_MARK = ['', '🥉', '🥈', '🥇'] as const
/** メダルを とったときの ほし（きんは 2こ） */
export const MEDAL_STARS = [0, 1, 1, 2] as const

/** a は b より良い記録か（b が無ければ いつも良い） */
export function isBetter(game: GameId, a: number, b: number | undefined): boolean {
  if (b === undefined) return true
  return MEDAL_RULES[game]?.low ? a < b : a > b
}

/** その記録で とれる メダル */
export function medalFor(game: GameId, value: number | undefined): MedalLevel {
  const rule = MEDAL_RULES[game]
  if (!rule || value === undefined) return 0
  let m: MedalLevel = 0
  rule.need.forEach((n, i) => {
    if (rule.low ? value <= n : value >= n) m = (i + 1) as MedalLevel
  })
  return m
}

/** ピクルくんと ラリー：かったときの レベルを記録の数にする */
export const senseiValue = (level: (typeof LEVELS)[number]) => LEVELS.indexOf(level) + 1

/** 記録を文字にする（ホームのカード・きろくの一覧） */
export function recordText(game: GameId, v: number): string {
  switch (game) {
    case 'sensei':
      return `${LEVEL_INFO[LEVELS[Math.max(0, Math.min(3, v - 1))]].label}で かった`
    case 'reaction':
      return `${(v / 1000).toFixed(3)}びょう`
    case 'lift':
      return `${v}かい`
    case 'target':
      return `${v}きゅう`
    default:
      return `${v}てん`
  }
}

/** つぎの メダルまでの 目標（きんを とっていたら null） */
export function nextGoal(game: GameId, best: number | undefined): { medal: MedalLevel; need: number } | null {
  const rule = MEDAL_RULES[game]
  if (!rule) return null
  const now = medalFor(game, best)
  if (now >= 3) return null
  return { medal: (now + 1) as MedalLevel, need: rule.need[now as 0 | 1 | 2] }
}
