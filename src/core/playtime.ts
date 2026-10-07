/**
 * つづけて遊んだ時間をはかり、「ちょっと きゅうけい しよう」と声をかける時期を決める。
 * はかるのはゲームの画面を見ているあいだだけ（一時停止中・別のアプリを見ているあいだは数えない）。
 * 10分以上 はなれていたら、きゅうけいしたとみなして0に戻す。端末の外には何も送らない。
 */
import { getSettings } from './settings'

/** これだけ はなれていたら、きゅうけいしたとみなす（ミリ秒） */
const REST_MS = 10 * 60 * 1000
/** 「あと 1かい だけ」を押したら、つぎに声をかけるまでの時間（秒） */
export const ONE_MORE_SEC = 5 * 60

let played = 0
let hiddenAt: number | null = null

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else {
      if (hiddenAt !== null && Date.now() - hiddenAt >= REST_MS) played = 0
      hiddenAt = null
    }
  })
}

/** 遊んだ秒数を足す（ゲームの画面が1秒ごとに呼ぶ） */
export function addPlayed(sec: number): void {
  played += sec
}

export function playedSec(): number {
  return played
}

/** いま声をかける時期か（0分の設定なら いつも false） */
export function breakDue(limitMin = getSettings().breakMin): boolean {
  return limitMin > 0 && played >= limitMin * 60
}

/** 「きゅうけい する」を選んだ */
export function tookBreak(): void {
  played = 0
}

/** 「あと 1かい だけ」：少しあとで また声をかける */
export function oneMore(limitMin = getSettings().breakMin): void {
  played = Math.max(0, limitMin * 60 - ONE_MORE_SEC)
}

/** テスト用 */
export function __setPlayed(sec: number): void {
  played = sec
}
