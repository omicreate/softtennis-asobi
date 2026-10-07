/**
 * セリフの文から音声ファイル名を決める（FNV-1a 32bit）。
 * scripts/build-voice.mjs とアプリの両方で同じ計算をして、同じ文なら同じファイルを指す。
 */
export function voiceKey(text: string): string {
  let h = 0x811c9dc5
  for (const ch of text.normalize('NFC')) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
