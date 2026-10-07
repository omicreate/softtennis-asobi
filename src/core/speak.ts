/**
 * 文字が読めない子のために、問題や説明を読み上げる。
 * ElevenLabs で前もって作った声（public/voice/）があればそれを鳴らし、なければ端末の読み上げで読む。
 * 文を配列で渡すと順に読む（クイズの選択肢は並びが毎回変わるので、1つずつの声をつなげる）。
 */
import { getSettings } from './settings'
import { audioContext } from './sound'
import { voiceKey } from './voiceKey'

const BASE = `${import.meta.env.BASE_URL}voice/`
let available: Set<string> | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
let current: AudioBufferSourceNode | null = null
/** 読み上げの番号。新しく読み始めたら古い続きは止める */
let token = 0

/** 用意してある声の一覧を読む（起動時に1回） */
export async function loadVoices(): Promise<void> {
  try {
    const res = await fetch(`${BASE}index.json`)
    if (res.ok) available = new Set((await res.json()) as string[])
  } catch {
    available = null
  }
}

function buffer(key: string): Promise<AudioBuffer | null> {
  let p = buffers.get(key)
  if (!p) {
    p = (async () => {
      const a = audioContext()
      if (!a) return null
      try {
        const res = await fetch(`${BASE}${key}.mp3`)
        return await a.decodeAudioData(await res.arrayBuffer())
      } catch {
        return null
      }
    })()
    buffers.set(key, p)
  }
  return p
}

function playBuffer(buf: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const a = audioContext()
    if (!a) return resolve()
    const src = a.createBufferSource()
    src.buffer = buf
    src.connect(a.destination)
    src.onended = () => resolve()
    current = src
    src.start()
  })
}

function synth(text: string): void {
  if (typeof speechSynthesis === 'undefined') return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ja-JP'
    u.rate = 0.95
    u.pitch = 1.1
    const ja = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ja'))
    if (ja) u.voice = ja
    speechSynthesis.speak(u)
  } catch {
    // 読み上げできなくても続ける
  }
}

export function speak(text: string | string[]): void {
  if (!getSettings().speak) return
  stopSpeaking()
  const parts = Array.isArray(text) ? text : [text]
  const keys = parts.map(voiceKey)
  if (!available || !keys.every((k) => available!.has(k))) {
    synth(parts.join('。'))
    return
  }
  const my = ++token
  void (async () => {
    for (const k of keys) {
      const buf = await buffer(k)
      if (my !== token) return
      if (!buf) {
        synth(parts.join('。'))
        return
      }
      await playBuffer(buf)
      if (my !== token) return
      await new Promise((r) => setTimeout(r, 180))
    }
  })()
}

export function stopSpeaking(): void {
  token++
  try {
    current?.stop()
  } catch {
    // もう止まっている
  }
  current = null
  try {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  } catch {
    // 何もしない
  }
}
