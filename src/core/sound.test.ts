import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SFX_NAMES } from './sound'

const root = new URL('../../', import.meta.url)

describe('効果音（ElevenLabs で作った mp3）', () => {
  it('アプリが鳴らす音は、どれも public/sfx に mp3 がある', () => {
    for (const n of SFX_NAMES) expect(existsSync(new URL(`public/sfx/${n}.mp3`, root)), n).toBe(true)
  })

  it('作るスクリプトの表と、アプリが鳴らす音の名前がそろっている', () => {
    const src = readFileSync(new URL('scripts/build-sfx.mjs', root), 'utf8')
    const names = [...src.matchAll(/^ {2}([a-z]+): \['/gm)].map((m) => m[1])
    expect(names.sort()).toEqual([...SFX_NAMES].sort())
  })

  it('プログラムで音を作らない（電子音の合成を使わない）', () => {
    const src = readFileSync(new URL('src/core/sound.ts', root), 'utf8')
    expect(src).not.toMatch(/createOscillator|createBiquadFilter/)
  })
})
