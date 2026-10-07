/**
 * きょうの ミッション。日付から毎日3つ決まる（どの端末でも、その日は同じミッション）。
 * ①かんたん（あそぶだけ） ②きろく（ひとりで遊ぶゲームの目標） ③いっしょに（ふたり・みんなで）
 * 目標の数はレベルに関係なく同じ。レベルでゲームの難しさが変わるので、小さい子でも届く数にしている。
 */
import type { GameId } from '../shell/games'
import { hashString } from './rng'

export type MissionKind = 'play' | 'value' | 'any' | 'two' | 'party'

export interface MissionDef {
  id: string
  /** 読み上げる・画面に出す文（ひらがな中心） */
  text: string
  kind: MissionKind
  /** いくつで達成か（play・any・two・party は回数、value はそのゲームの記録） */
  need: number
  game?: GameId
}

export const EASY: MissionDef[] = [
  { id: 'any-3', text: 'ゲームを 3かい あそぼう', kind: 'any', need: 3 },
  { id: 'play-lift', text: 'ポンポン リフティングで あそぼう', kind: 'play', need: 1, game: 'lift' },
  { id: 'play-target', text: 'ねらってショットで あそぼう', kind: 'play', need: 1, game: 'target' },
  { id: 'play-pikuru', text: 'ピクルくんと ラリーで あそぼう', kind: 'play', need: 1, game: 'pikuru' },
  { id: 'play-reaction', text: 'リアクション ボレーで あそぼう', kind: 'play', need: 1, game: 'reaction' },
]

export const RECORD: MissionDef[] = [
  { id: 'lift-10', text: 'リフティングを 10かい つづけよう', kind: 'value', need: 10, game: 'lift' },
  { id: 'target-3', text: 'ねらってショットで 3こ いれよう', kind: 'value', need: 3, game: 'target' },
]

export const TOGETHER: MissionDef[] = [
  { id: 'two-1', text: 'ふたりで あそぶ ゲームを 1かい あそぼう', kind: 'two', need: 1 },
  { id: 'quiz-1', text: 'ピクルくんクイズで あそぼう', kind: 'play', need: 1, game: 'quiz' },
  { id: 'rally-1', text: 'ラリーたいけつで しょうぶしよう', kind: 'play', need: 1, game: 'rally' },
  { id: 'party-1', text: 'じゅんばんモードで あそぼう', kind: 'party', need: 1 },
  { id: 'ishin-1', text: 'いしんでんしん ダブルスで あそぼう', kind: 'play', need: 1, game: 'ishin' },
]

export const ALL_MISSIONS = [...EASY, ...RECORD, ...TOGETHER]

/** 1日に全部クリアしたときの おまけ */
export const BONUS_STARS = 2

/** 端末の時刻での日付（YYYY-MM-DD） */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** その日の3つ。①と②で同じゲームにならないようにする */
export function missionsFor(day: string): MissionDef[] {
  const h = hashString(day)
  const a = EASY[h % EASY.length]
  let b = RECORD[(h >>> 8) % RECORD.length]
  if (a.game && a.game === b.game) b = RECORD[((h >>> 8) + 1) % RECORD.length]
  const c = TOGETHER[(h >>> 16) % TOGETHER.length]
  return [a, b, c]
}

/** record＝じこベスト・メダルに数える（ひとりで遊んだとき・ディンク。じゅんばんモードは数えない） */
export type PlayEvent = { type: 'finish'; game: GameId; value?: number; two: boolean; record?: boolean } | { type: 'party' }

/** 1回遊んだあとの進み具合 */
export function advance(def: MissionDef, current: number, ev: PlayEvent): number {
  if (ev.type === 'party') return def.kind === 'party' ? current + 1 : current
  switch (def.kind) {
    case 'any':
      return current + 1
    case 'two':
      return ev.two ? current + 1 : current
    case 'play':
      return ev.game === def.game ? current + 1 : current
    case 'value':
      return ev.game === def.game && ev.value !== undefined ? Math.max(current, ev.value) : current
    case 'party':
      return current
  }
}
