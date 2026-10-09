/**
 * 効果音は ElevenLabs の効果音生成で作った mp3（public/sfx/。scripts/build-sfx.mjs が作る）を鳴らす。
 * 起動時に読んでおき（loadSfx）、読みこみが間に合わないときは鳴らさない（プログラムで作った電子音では代わりにしない）。
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

/** 効果音の名前（public/sfx/<名前>.mp3） */
export const SFX_NAMES = ['pop', 'bounce', 'ok', 'ng', 'whistle', 'tick', 'go', 'fanfare'] as const
type SfxName = (typeof SFX_NAMES)[number]

const BASE = `${import.meta.env.BASE_URL}sfx/`
const buffers = new Map<SfxName, AudioBuffer>()
let loading: Promise<void> | null = null

/** 効果音の mp3 を読んでおく（起動時に1回。音が出せるようになる前でも読める） */
export function loadSfx(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const a = audioContext()
      if (!a) return
      await Promise.all(
        SFX_NAMES.map(async (n) => {
          try {
            const res = await fetch(`${BASE}${n}.mp3`)
            buffers.set(n, await a.decodeAudioData(await res.arrayBuffer()))
          } catch {
            // 読めなかった音は鳴らさない
          }
        }),
      )
    })()
  }
  return loading
}

function play(name: SfxName, vol = 1, rate = 1) {
  const a = audio()
  if (!a) return
  const buf = buffers.get(name)
  if (!buf) {
    void loadSfx()
    return
  }
  const src = a.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(gain).connect(a.destination)
  src.start()
}

export const sfx = {
  /** ラケットで打った音（軟式球の「ポン」）。強く打つほど少し高く・大きく */
  pop(strength = 0.5) {
    play('pop', 0.55 + strength * 0.45, 0.92 + strength * 0.16)
  },
  /** ボールがはねた音 */
  bounce() {
    play('bounce', 0.8)
  },
  /** 正解 */
  ok() {
    play('ok', 0.9)
  },
  /** まちがい・お手つき */
  ng() {
    play('ng', 0.9)
  },
  /** 審判の笛 */
  whistle() {
    play('whistle', 1)
  },
  /** ボタンを押した */
  tick() {
    play('tick', 0.6)
  },
  /** 合図（はやタッチ・リアクション） */
  go() {
    play('go', 0.7)
  },
  /** 勝ち・記録 */
  fanfare() {
    play('fanfare', 0.9)
  },
}
