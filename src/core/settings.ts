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
  /** ほんかくルールの点の数え方（サイドアウト方式／ラリー・スコアリング） */
  rallyScoring: 'sideout' | 'rally'
  /** ひとりで遊ぶときのレベル */
  soloLevel: Level
  /** パドルの見た目（0＝下の人・ひとりのとき、1＝上の人） */
  paddles: [PaddleLook, PaddleLook]
  /** 遊んだ回数を匿名で送る（おうちの方へ で切りかえ。公開版でだけ送る） */
  counter: boolean
  /** れんだ つなひきを 2人ずつのチームで遊ぶ */
  tugTeam: boolean
  /** よみあい サーブで1人が選ぶ時間（秒） */
  srTime: number
  /** よみあい サーブの遊び方（face＝机に置いて向かい合う／pass＝1台を手わたし） */
  srStyle: 'face' | 'pass'
  /** ピクルくん さがし（ひとりで）の遊び方（wally＝さがせ！ピクルくん／diff＝まちがいさがし） */
  sagasuMode: 'wally' | 'diff'
  /** つづけて遊んだら「きゅうけい しよう」と声をかける時間（分。0＝声をかけない） */
  breakMin: number
}

const defaults: Settings = { sound: true, speak: true, levels: ['kids', 'otona'], rallyRules: 'easy', rallyTarget: 5, rallyScoring: 'sideout', soloLevel: 'kids', paddles: DEFAULT_LOOKS, counter: true, tugTeam: false, srTime: 20, srStyle: 'face', sagasuMode: 'wally', breakMin: 30 }

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
