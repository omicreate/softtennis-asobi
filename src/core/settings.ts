import { useSyncExternalStore } from 'react'
import { DEFAULT_LOOKS } from '../ui/paddleArt'
import type { PaddleLook } from '../ui/paddleArt'
import type { Level } from './players'
import { load, save } from './storage'

export interface Settings {
  sound: boolean
  speak: boolean
  /** 前回えらんだレベル（下の人・上の人） */
  levels: [Level, Level]
  /** ラリーたいけつのルール（かんたん／ほんかく）と何点先取か */
  rallyRules: 'easy' | 'real'
  rallyTarget: number
  /** ほんかくルールのゲーム数（1・3・5ゲームマッチ） */
  rallyGames: 1 | 3 | 5
  /** ひとりで遊ぶときのレベル */
  soloLevel: Level
  /** ラケットの見た目（0＝下の人・ひとりのとき、1＝上の人） */
  paddles: [PaddleLook, PaddleLook]
  /** 遊んだ回数を匿名で送る（おうちの方へ で切りかえ。公開版でだけ送る） */
  counter: boolean
  /** つづけて遊んだら「きゅうけい しよう」と声をかける時間（分。0＝声をかけない） */
  breakMin: number
}

const defaults: Settings = { sound: true, speak: true, levels: ['kids', 'otona'], rallyRules: 'easy', rallyTarget: 5, rallyGames: 1, soloLevel: 'kids', paddles: DEFAULT_LOOKS, counter: true, breakMin: 30 }

let current: Settings = { ...defaults, ...load<Partial<Settings>>('settings', {}) }
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  save('settings', current)
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
