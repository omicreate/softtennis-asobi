/**
 * この端末の あそびの記録：ほし・持っている物・きせかえ・遊んだ回数・スタンプ（遊んだ日）・きょうのミッション。
 * 端末の中（localStorage）だけに保存する。外には送らない（回数の集計は counter.ts が別に、匿名で送る）。
 */
import { useSyncExternalStore } from 'react'
import type { GameId } from '../shell/games'
import type { AccessoryId, Wear } from '../ui/accessories'
import { ACCESSORIES } from '../ui/accessories'
import { itemById, ITEMS, STARTER_ITEMS, WELCOME_STARS } from './items'
import type { Item, Special } from './items'
import { advance, BONUS_STARS, dayKey, missionsFor } from './missions'
import type { MissionDef, PlayEvent } from './missions'
import { isBetter, MEDAL_RULES, MEDAL_STARS, medalFor } from './records'
import type { MedalLevel } from './records'
import { load, save } from './storage'

export interface MissionState {
  day: string
  progress: number[]
  done: boolean[]
  bonus: boolean
}

export interface Progress {
  stars: number
  owned: string[]
  wear: Wear
  /** ゲームごとの 遊んだ回数（はじめた回数） */
  plays: Record<string, number>
  /** 遊んだ日（スタンプ）。新しい順ではなく古い順 */
  days: string[]
  mission: MissionState
  /** クリアしたミッションの合計 */
  cleared: number
  /** じゅんばんモードを最後まで遊んだ回数 */
  parties: number
  /** ゲームごとの じこベスト（records.ts の MEDAL_RULES にあるゲームだけ） */
  best: Record<string, number>
  /** ゲームごとの とった メダル（0〜3） */
  medals: Record<string, MedalLevel>
  /** さいきん はじめたゲーム（新しい順に3つ。ホームの「また あそぶ」） */
  recent: GameId[]
}

export type Reward =
  | { type: 'mission'; text: string; stars: number }
  | { type: 'bonus'; stars: number }
  | { type: 'item'; item: Item }
  | { type: 'welcome'; stars: number }
  | { type: 'medal'; game: GameId; medal: MedalLevel; stars: number }

const KEY = 'progress'

function fresh(day: string): MissionState {
  return { day, progress: [0, 0, 0], done: [false, false, false], bonus: false }
}

function initial(): Progress {
  return { stars: WELCOME_STARS, owned: [...STARTER_ITEMS], wear: {}, plays: {}, days: [], mission: fresh(dayKey()), cleared: 0, parties: 0, best: {}, medals: {}, recent: [] }
}

function restore(): { p: Progress; isNew: boolean } {
  const saved = load<Partial<Progress> | null>(KEY, null)
  if (!saved) return { p: initial(), isNew: true }
  const base = initial()
  const p: Progress = { ...base, ...saved, mission: saved.mission ?? base.mission, best: saved.best ?? {}, medals: saved.medals ?? {}, recent: saved.recent ?? [] }
  // はじめから持っている物は いつも持っている（あとで増えたときも）
  p.owned = [...new Set([...STARTER_ITEMS, ...(saved.owned ?? [])])]
  return { p, isNew: false }
}

const restored = restore()
let current: Progress = restored.p
const listeners = new Set<() => void>()
const rewardListeners = new Set<(r: Reward[]) => void>()
/** はじめて開いたときの プレゼントを、最初の画面で知らせる */
let pendingWelcome = restored.isNew

function commit(next: Progress): void {
  current = next
  save(KEY, current)
  listeners.forEach((l) => l())
}

function emit(rewards: Reward[]): Reward[] {
  if (rewards.length) rewardListeners.forEach((l) => l(rewards))
  return rewards
}

export function getProgress(): Progress {
  return current
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

/** ごほうびが出たら呼ばれる（画面に知らせを出す） */
export function onReward(cb: (r: Reward[]) => void): () => void {
  rewardListeners.add(cb)
  return () => rewardListeners.delete(cb)
}

/** はじめて開いたか（プレゼントの知らせを1回だけ出す） */
export function takeWelcome(): boolean {
  const w = pendingWelcome
  pendingWelcome = false
  return w
}

/** 日付が変わっていたら、きょうのミッションに入れかえる */
function withToday(p: Progress, day: string): Progress {
  return p.mission.day === day ? p : { ...p, mission: fresh(day) }
}

/** きょうのミッション（定義と進み具合） */
export function todayMissions(p: Progress = current, day = dayKey()): { defs: MissionDef[]; state: MissionState } {
  const q = withToday(p, day)
  return { defs: missionsFor(day), state: q.mission }
}

/** ゲームを はじめた：回数とスタンプ */
export function recordStart(game: GameId | 'party', day = dayKey()): Reward[] {
  let p = withToday(current, day)
  const days = p.days.includes(day) ? p.days : [...p.days, day].slice(-400)
  const recent = game === 'party' ? p.recent : [game, ...p.recent.filter((g) => g !== game)].slice(0, 3)
  p = { ...p, plays: { ...p.plays, [game]: (p.plays[game] ?? 0) + 1 }, days, recent }
  const rewards = grantSpecials(p)
  commit(rewards.p)
  return emit(rewards.list)
}

/** ゲームが おわった／じゅんばんモードを さいごまで遊んだ：ミッションを進める */
export function recordPlay(ev: PlayEvent, day = dayKey()): Reward[] {
  let p = withToday(current, day)
  const defs = missionsFor(day)
  const m = { ...p.mission, progress: [...p.mission.progress], done: [...p.mission.done] }
  const list: Reward[] = []
  let stars = p.stars
  let cleared = p.cleared
  defs.forEach((def, i) => {
    if (m.done[i]) return
    m.progress[i] = advance(def, m.progress[i], ev)
    if (m.progress[i] >= def.need) {
      m.done[i] = true
      stars += 1
      cleared += 1
      list.push({ type: 'mission', text: def.text, stars: 1 })
    }
  })
  if (!m.bonus && m.done.every(Boolean)) {
    m.bonus = true
    stars += BONUS_STARS
    list.push({ type: 'bonus', stars: BONUS_STARS })
  }
  p = { ...p, mission: m, stars, cleared, parties: ev.type === 'party' ? p.parties + 1 : p.parties }
  // じこベストと メダル（ひとりで遊んだときなど、record がついた記録だけ）
  if (ev.type === 'finish' && ev.record && ev.value !== undefined && MEDAL_RULES[ev.game]) {
    const g = ev.game
    const best = isBetter(g, ev.value, p.best[g]) ? ev.value : p.best[g]
    const had = p.medals[g] ?? 0
    const now = medalFor(g, best)
    let got = 0
    for (let m = had + 1; m <= now; m++) {
      got += MEDAL_STARS[m]
      list.push({ type: 'medal', game: g, medal: m as MedalLevel, stars: MEDAL_STARS[m] })
    }
    p = { ...p, best: { ...p.best, [g]: best }, medals: { ...p.medals, [g]: Math.max(had, now) as MedalLevel }, stars: p.stars + got }
  }
  const sp = grantSpecials(p)
  commit(sp.p)
  return emit([...list, ...sp.list])
}

/** とくべつな ごほうびの条件を満たしたか */
export function specialMet(s: Special, p: Progress): boolean {
  switch (s) {
    case 'stamps7':
      return p.days.length >= 7
    case 'stamps14':
      return p.days.length >= 14
    case 'party':
      return p.parties >= 1
    case 'missions10':
      return p.cleared >= 10
    case 'medals9':
      return medalCount(p) >= 9
  }
}

/** とった メダルの数（どう1・ぎん2・きん3 として足す） */
export function medalCount(p: Progress = current): number {
  return Object.values(p.medals).reduce<number>((a, m) => a + (m ?? 0), 0)
}

function grantSpecials(p: Progress): { p: Progress; list: Reward[] } {
  const got = ITEMS.filter((i) => i.special && !p.owned.includes(i.id) && specialMet(i.special, p))
  if (!got.length) return { p, list: [] }
  return { p: { ...p, owned: [...p.owned, ...got.map((i) => i.id)] }, list: got.map((item) => ({ type: 'item' as const, item })) }
}

export type BuyResult = 'ok' | 'owned' | 'short' | 'special'

/** ほしと こうかん */
export function buy(id: string): BuyResult {
  const item = itemById(id)
  if (!item) return 'short'
  if (current.owned.includes(id)) return 'owned'
  if (item.special) return 'special'
  if (current.stars < item.price) return 'short'
  commit({ ...current, stars: current.stars - item.price, owned: [...current.owned, id] })
  return 'ok'
}

/** 小物をつける／はずす（同じ場所には1つだけ） */
export function toggleWear(id: AccessoryId): void {
  if (!current.owned.includes(`wear:${id}`)) return
  const slot = ACCESSORIES[id].slot
  const wear = { ...current.wear }
  if (wear[slot] === id) delete wear[slot]
  else wear[slot] = id
  commit({ ...current, wear })
}

export function owns(id: string, p: Progress = current): boolean {
  return p.owned.includes(id)
}

/** 記録を全部けす（おうちの方へ のページから） */
export function resetProgress(): void {
  commit(initial())
}

/** テスト用：状態を入れかえる */
export function __setProgress(p: Progress): void {
  current = p
}
