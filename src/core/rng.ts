/**
 * いつも同じ並びになる乱数（mulberry32）。
 * じゅんばんモードでは、同じラウンドの人みんなに同じ並び（同じ障害・同じ球）を出して公平にする。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 文字列から数を作る（FNV-1a）。日付からその日のミッションを決めるときなどに使う */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
