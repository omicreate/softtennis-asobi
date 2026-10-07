/**
 * ピタッと 10びょう（ひとり・ハイスコア）。React に依存しない純粋な計算。
 * ピクルくんが ロブを高く打ち上げる。10秒ちょうどで落ちてくるので、ぴったりの時にタップしてキャッチ。
 * 時計は とちゅうで見えなくなる（レベルで見えなくなる時刻が変わる）。3回のうち いちばん近い記録で競う。
 * 記録は 10秒とのずれ（ms。小さいほど良い）。
 */
import type { Level } from '../../core/players'

export const GOAL = 10
export const TRIES = 3
/** 時計が見えなくなる時刻（秒）。小さい子ほど長く見える */
export const HIDE_AT: Record<Level, number> = { chibi: 7, kids: 5.5, otona: 3, senshu: 1.5 }
/** 押さないまま この時刻をこえたら、その回は おしまい */
export const LIMIT = 20

export type S10Phase = 'idle' | 'run' | 'shown' | 'over'

export interface S10State {
  level: Level
  phase: S10Phase
  t: number
  results: number[]
  last: { at: number; diff: number } | null
}

export type S10Event = { type: 'start' } | { type: 'stop'; at: number; diff: number } | { type: 'over'; best: number }

export function createS10(level: Level): S10State {
  return { level, phase: 'idle', t: 0, results: [], last: null }
}

export const best = (s: S10State) => (s.results.length ? Math.min(...s.results) : 0)

/** タップ：待っているときは打ち上げ、飛んでいるときはキャッチ */
export function tapS10(s: S10State, ev: S10Event[] = []): void {
  if (s.phase === 'idle') {
    s.phase = 'run'
    s.t = 0
    ev.push({ type: 'start' })
  } else if (s.phase === 'run') {
    finish(s, s.t, ev)
  }
}

function finish(s: S10State, at: number, ev: S10Event[]) {
  const diff = Math.round(Math.abs(at - GOAL) * 1000)
  s.results.push(diff)
  s.last = { at, diff }
  ev.push({ type: 'stop', at, diff })
  if (s.results.length >= TRIES) {
    s.phase = 'over'
    ev.push({ type: 'over', best: best(s) })
  } else {
    s.phase = 'shown'
    s.t = 0
  }
}

export function stepS10(s: S10State, dt: number): S10Event[] {
  const ev: S10Event[] = []
  if (s.phase === 'run') {
    s.t += dt
    if (s.t >= LIMIT) finish(s, s.t, ev)
  } else if (s.phase === 'shown') {
    s.t += dt
    if (s.t >= 1.8) {
      s.phase = 'idle'
      s.t = 0
    }
  }
  return ev
}

/** 時計が見えているか */
export const visible = (s: S10State) => s.phase !== 'run' || s.t < HIDE_AT[s.level]

/** 秒を「9.87」の形に */
export const clock = (t: number) => t.toFixed(2)
