/**
 * ボールキャッチ（ひとり）。React に依存しない純粋な計算。
 * 空から いろいろなボールが落ちてくる。穴のあいたピックルボールだけを、かごで受ける。
 * テニスボールなど ほかのボールを受けると ライフが へる（ピックルボールの見分けかたを覚える）。
 * 場は幅100・高さ160。かごは下にあり、指で左右に動かす。
 */
import type { Level } from '../../core/players'

export const FIELD_W = 100
export const FIELD_H = 160
export const ITEM_R = 4.6
/** かごの口の高さ（ここを通りすぎたら受けたか決める） */
export const BASKET_Y = FIELD_H - 18
export const GAME_TIME = 45
/** じゅんばんモードは短く */
export const CONTEST_TIME = 30

export type ItemKind = 'pickle' | 'gold' | 'tennis' | 'soccer' | 'basket' | 'baseball' | 'shuttle'

export const GOOD: ItemKind[] = ['pickle', 'gold']

export const ITEM_NAME: Record<ItemKind, string> = {
  pickle: 'ピックルボール',
  gold: 'きんの ピックルボール',
  tennis: 'テニスボール',
  soccer: 'サッカーボール',
  basket: 'バスケットボール',
  baseball: 'やきゅうの ボール',
  shuttle: 'バドミントンの シャトル',
}

export interface CatchLevel {
  /** かごの幅 */
  basket: number
  /** 落ちる速さ（単位/秒）のはじめ */
  speed: number
  /** 次のボールまでの間（秒）のはじめ */
  gap: number
  lives: number
  /** 出るボールと、その出やすさ */
  mix: [ItemKind, number][]
}

export const CATCH_LEVEL: Record<Level, CatchLevel> = {
  chibi: {
    basket: 32,
    speed: 32,
    gap: 1.05,
    lives: 5,
    mix: [
      ['pickle', 66],
      ['gold', 4],
      ['soccer', 15],
      ['basket', 15],
    ],
  },
  kids: {
    basket: 27,
    speed: 40,
    gap: 0.9,
    lives: 4,
    mix: [
      ['pickle', 58],
      ['gold', 4],
      ['tennis', 16],
      ['soccer', 11],
      ['basket', 11],
    ],
  },
  otona: {
    basket: 23,
    speed: 50,
    gap: 0.75,
    lives: 3,
    mix: [
      ['pickle', 52],
      ['gold', 4],
      ['tennis', 26],
      ['baseball', 10],
      ['shuttle', 8],
    ],
  },
  senshu: {
    basket: 20,
    speed: 58,
    gap: 0.64,
    lives: 3,
    mix: [
      ['pickle', 50],
      ['gold', 4],
      ['tennis', 32],
      ['baseball', 7],
      ['shuttle', 7],
    ],
  },
}

export interface Item {
  id: number
  kind: ItemKind
  x: number
  y: number
  vy: number
  /** くるくる回る（見た目） */
  spin: number
  done: boolean
}

export interface CatchState {
  level: Level
  basketX: number
  items: Item[]
  score: number
  caught: number
  lives: number
  t: number
  timeLimit: number
  next: number
  nextId: number
  phase: 'ready' | 'play' | 'over'
  wait: number
}

export type CatchEvent =
  | { type: 'good'; kind: ItemKind; points: number; score: number }
  | { type: 'bad'; kind: ItemKind; lives: number }
  | { type: 'miss'; kind: ItemKind }
  | { type: 'over'; score: number; caught: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function createCatch(level: Level, timeLimit = GAME_TIME): CatchState {
  return { level, basketX: FIELD_W / 2, items: [], score: 0, caught: 0, lives: CATCH_LEVEL[level].lives, t: 0, timeLimit, next: 0.6, nextId: 1, phase: 'ready', wait: 1.6 }
}

export function moveBasket(s: CatchState, x: number): void {
  const half = CATCH_LEVEL[s.level].basket / 2
  s.basketX = clamp(x, half, FIELD_W - half)
}

function pick(mix: [ItemKind, number][], r: number): ItemKind {
  const total = mix.reduce((a, [, w]) => a + w, 0)
  let x = r * total
  for (const [k, w] of mix) {
    if ((x -= w) < 0) return k
  }
  return mix[0][0]
}

/** かごで受けたか（ボールの中心が かごの口の幅の中） */
export function inBasket(s: CatchState, x: number): boolean {
  return Math.abs(x - s.basketX) <= CATCH_LEVEL[s.level].basket / 2 + ITEM_R * 0.4
}

export function stepCatch(s: CatchState, dt: number, rand: () => number = Math.random): CatchEvent[] {
  const ev: CatchEvent[] = []
  if (s.phase === 'over') return ev
  if (s.phase === 'ready') {
    s.wait -= dt
    if (s.wait <= 0) s.phase = 'play'
    return ev
  }
  const lv = CATCH_LEVEL[s.level]
  s.t += dt
  // だんだん速く、多く
  const k = Math.min(1, s.t / 40)
  s.next -= dt
  if (s.next <= 0) {
    const kind = pick(lv.mix, rand())
    const speed = lv.speed * (1 + 0.45 * k) * (0.85 + rand() * 0.3)
    s.items.push({ id: s.nextId++, kind, x: 8 + rand() * (FIELD_W - 16), y: -ITEM_R * 2, vy: speed, spin: rand() * Math.PI * 2, done: false })
    s.next = lv.gap * (1 - 0.3 * k) * (0.75 + rand() * 0.5)
  }
  for (const it of s.items) {
    const before = it.y
    it.y += it.vy * dt
    it.spin += dt * 2
    if (!it.done && before < BASKET_Y && it.y >= BASKET_Y) {
      if (inBasket(s, it.x)) {
        it.done = true
        if (GOOD.includes(it.kind)) {
          const points = it.kind === 'gold' ? 3 : 1
          s.score += points
          s.caught += 1
          ev.push({ type: 'good', kind: it.kind, points, score: s.score })
        } else {
          s.lives -= 1
          ev.push({ type: 'bad', kind: it.kind, lives: s.lives })
          if (s.lives <= 0) {
            s.phase = 'over'
            ev.push({ type: 'over', score: s.score, caught: s.caught })
            return ev
          }
        }
      }
    }
    if (!it.done && it.y > FIELD_H + ITEM_R) {
      it.done = true
      if (GOOD.includes(it.kind)) ev.push({ type: 'miss', kind: it.kind })
    }
  }
  // 受けたボールは かごの中へ消える。落ちきったものも消す
  s.items = s.items.filter((it) => !(it.done && (it.y > BASKET_Y + 6 || it.y > FIELD_H + ITEM_R)))
  if (s.t >= s.timeLimit) {
    s.phase = 'over'
    ev.push({ type: 'over', score: s.score, caught: s.caught })
  }
  return ev
}
