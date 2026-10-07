/**
 * ゲームの画面と外枠（Play・じゅんばんモード）をつなぐ。
 * ゲームは終わったら finish() で記録を知らせる（ミッション・じゅんばんモードの順位に使う）。
 */
import { createContext, useContext } from 'react'
import type { Side } from '../core/players'
import type { Reward } from '../core/progress'
import type { PaddleLook } from '../ui/paddleArt'
import { DEFAULT_LOOKS } from '../ui/paddleArt'
import type { CutArt } from '../ui/hawkArt'
import type { GameId } from './games'

export interface GameResult {
  /** そのゲームの記録（走った m・点・回数など）。ふたりのゲームでは無いこともある */
  value?: number
  /** ふたりのゲームの勝った人（ひきわけは null） */
  winner?: Side | null
}

export interface ShareRequest {
  side: Side
  title: string
  sub?: string
  face: CutArt
}

export interface PlayContextValue {
  game: GameId
  /** じゅんばんモード：みんな同じ並びの乱数（seed）と、短めのルールで遊ぶ。結果画面はモードの側で出す */
  contest?: { seed: number }
  paddles: [PaddleLook, PaddleLook]
  finish: (r: GameResult) => void
  /** このゲームで もらった ごほうび（結果画面に出す） */
  rewards: Reward[]
  /** きねんカードを作る（おうちの人の確認のあと） */
  share?: (req: ShareRequest) => void
}

const fallback: PlayContextValue = { game: 'rally', paddles: DEFAULT_LOOKS, finish: () => {}, rewards: [] }

export const PlayContext = createContext<PlayContextValue>(fallback)

export const usePlay = () => useContext(PlayContext)
