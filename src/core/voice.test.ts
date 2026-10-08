import { describe, expect, it } from 'vitest'
import { voiceKey } from './voiceKey'
import { allVoiceLines } from './voiceLines'

describe('声の一覧', () => {
  it('セリフごとにファイル名が重ならない', () => {
    const lines = allVoiceLines()
    expect(new Set(lines.map(voiceKey)).size).toBe(lines.length)
  })
  it('同じ文なら、いつも同じファイル名', () => {
    expect(voiceKey('タッチ！')).toBe(voiceKey('タッチ！'))
    expect(voiceKey('タッチ！')).not.toBe(voiceKey('タッチ'))
  })
  it('こども向けクイズの問題・選択肢・説明は全部ある（読み上げで使う）', () => {
    const lines = allVoiceLines()
    expect(lines).toContain('ソフトテニスの ボールは どれ？')
    expect(lines).toContain('しろい ゴムの ボール')
  })
})
