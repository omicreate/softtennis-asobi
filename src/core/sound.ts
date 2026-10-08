/**
 * 効果音は Web Audio で合成する（音声ファイルを持たない＝軽い・オフラインでも鳴る）。
 * iOS は指で触れるまで音が出ないので、最初のタップで unlockAudio() を呼ぶ。
 */
import { getSettings } from './settings'

let ctx: AudioContext | null = null

/** 音を鳴らす土台（効果音と声で共通。設定に関係なく作る） */
export function audioContext(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 効果音用（「おと なし」のときは鳴らさない） */
function audio(): AudioContext | null {
  return getSettings().sound ? audioContext() : null
}

export function unlockAudio(): void {
  const a = audioContext()
  if (!a) return
  // 無音を1回鳴らして iOS の制限を外す
  const buf = a.createBuffer(1, 1, 22050)
  const src = a.createBufferSource()
  src.buffer = buf
  src.connect(a.destination)
  src.start(0)
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, endFreq?: number) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(start: number, dur: number, freq: number, vol = 0.3) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const len = Math.max(1, Math.floor(a.sampleRate * dur))
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.2
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(t)
}

export const sfx = {
  /** ラケットで打った「ポコッ」（ソフトテニスらしい乾いた音） */
  pop(strength = 0.5) {
    noise(0, 0.05, 1800 + strength * 900, 0.45)
    tone(900 + strength * 300, 0, 0.07, 'triangle', 0.18, 500)
  },
  bounce() {
    tone(260, 0, 0.09, 'sine', 0.18, 140)
  },
  ok() {
    tone(660, 0, 0.12, 'triangle', 0.2)
    tone(880, 0.1, 0.12, 'triangle', 0.2)
    tone(1320, 0.2, 0.22, 'triangle', 0.2)
  },
  ng() {
    tone(330, 0, 0.18, 'square', 0.08, 220)
    tone(220, 0.16, 0.26, 'square', 0.08, 150)
  },
  whistle() {
    tone(2100, 0, 0.32, 'sine', 0.12, 2300)
  },
  tick() {
    tone(1200, 0, 0.05, 'sine', 0.12)
  },
  go() {
    tone(1568, 0, 0.18, 'triangle', 0.22)
  },
  fanfare() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle', 0.2))
    tone(1047, 0.48, 0.5, 'triangle', 0.18)
  },
}
