/**
 * リアクション ボレー（ひとり・ハイスコア）。React に依存しない純粋な計算。
 * ピクルマシンから、いつ来るか分からないタイミングで球が飛んでくる。見えたらすぐタップでボレー。
 * 球が見えてからタップまでの時間（反応）を5回はかり、平均で競う（小さいほど良い）。
 * 見える前にタップしたら「フライング」で、その回は 1.000秒。
 * おとな・せんしゅは、ときどき「フェイント」（オレンジの球。さわったらフライング）がまざる。
 * レベルの手加減は、はやタッチと同じ「押した時刻に足す遅れ」（players.ts の pressDelay）。
 */
import { LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'

export const TRIES = 5
export const FOUL_MS = 1000
/** 球が見えてから、これ以上タップしなければ「おそい」（その回は この時間） */
export const SLOW_MS = 1500
export const FAKE_RATE: Record<Level, number> = { chibi: 0, kids: 0, otona: 0.2, senshu: 0.3 }

export type RxPhase = 'ready' | 'wait' | 'fake' | 'go' | 'shown' | 'over'

export interface RxState {
  level: Level
  phase: RxPhase
  /** いまの場面の経過（秒） */
  t: number
  /** wait の長さ（秒）と、フェイントを出すか */
  waitFor: number
  fakeAt: number | null
  /** 1回ずつの結果（ms。フライング・おそいも入る） */
  results: number[]
  fouls: number
  last: { ms: number; kind: 'ok' | 'foul' | 'slow' } | null
}

export type RxEvent = { type: 'ball' } | { type: 'fake' } | { type: 'hit'; ms: number } | { type: 'foul' } | { type: 'slow' } | { type: 'over'; avg: number; score: number }

function plan(s: RxState, rand: () => number) {
  s.waitFor = 1.3 + rand() * 2.4
  s.fakeAt = rand() < FAKE_RATE[s.level] ? 0.5 + rand() * Math.max(0.2, s.waitFor - 1.1) : null
}

export function createRx(level: Level, rand: () => number = Math.random): RxState {
  const s: RxState = { level, phase: 'ready', t: 0, waitFor: 2, fakeAt: null, results: [], fouls: 0, last: null }
  plan(s, rand)
  return s
}

/** 平均（ms）と、レベルの遅れを足した記録（ms。小さいほど良い） */
export function totals(s: RxState): { avg: number; score: number } {
  const avg = s.results.length ? Math.round(s.results.reduce((a, b) => a + b, 0) / s.results.length) : 0
  return { avg, score: avg + LEVEL_INFO[s.level].pressDelay }
}

function record(s: RxState, ms: number, kind: 'ok' | 'foul' | 'slow', ev: RxEvent[], rand: () => number) {
  s.results.push(ms)
  if (kind === 'foul') s.fouls += 1
  s.last = { ms, kind }
  if (s.results.length >= TRIES) {
    s.phase = 'over'
    const t = totals(s)
    ev.push({ type: 'over', ...t })
    return
  }
  s.phase = 'shown'
  s.t = 0
  plan(s, rand)
}

/** タップ */
export function tapRx(s: RxState, ev: RxEvent[] = [], rand: () => number = Math.random): void {
  if (s.phase === 'wait' || s.phase === 'fake') {
    ev.push({ type: 'foul' })
    record(s, FOUL_MS, 'foul', ev, rand)
  } else if (s.phase === 'go') {
    const ms = Math.round(s.t * 1000)
    ev.push({ type: 'hit', ms })
    record(s, ms, 'ok', ev, rand)
  }
}

export function stepRx(s: RxState, dt: number, rand: () => number = Math.random): RxEvent[] {
  const ev: RxEvent[] = []
  if (s.phase === 'over') return ev
  s.t += dt
  switch (s.phase) {
    case 'ready':
      if (s.t >= 1.4) {
        s.phase = 'wait'
        s.t = 0
      }
      break
    case 'wait':
      if (s.fakeAt !== null && s.t >= s.fakeAt) {
        s.phase = 'fake'
        ev.push({ type: 'fake' })
      } else if (s.t >= s.waitFor) {
        s.phase = 'go'
        s.t = 0
        ev.push({ type: 'ball' })
      }
      break
    case 'fake':
      // フェイントは 0.6秒で消えて、また待つ
      if (s.t >= s.fakeAt! + 0.6) {
        s.phase = 'wait'
        s.fakeAt = null
        s.waitFor = Math.max(s.waitFor, s.t + 0.8)
      }
      break
    case 'go':
      if (s.t * 1000 >= SLOW_MS) {
        ev.push({ type: 'slow' })
        record(s, SLOW_MS, 'slow', ev, rand)
      }
      break
    case 'shown':
      // 結果を少し見せてから次へ
      if (s.t >= 1.2) {
        s.phase = 'wait'
        s.t = 0
      }
      break
  }
  return ev
}

/** ms を「0.245びょう」の形に */
export const secText = (ms: number) => `${(ms / 1000).toFixed(3)}びょう`
