import { describe, expect, it } from 'vitest'
import { GAMES } from './games'
import { HOWTO, howtoSpeech } from './howto'

describe('あそびかた・ルールのページ', () => {
  it('どのゲームにも、あそびかた・ルール・レベルのちがい・くわしいルールがある', () => {
    for (const g of GAMES) {
      const h = HOWTO[g.id]
      expect(h.play.length, g.id).toBeGreaterThan(0)
      expect(h.rules.length, g.id).toBeGreaterThan(0)
      expect(h.levels.length, g.id).toBeGreaterThan(0)
      expect(h.detail.length, g.id).toBeGreaterThan(0)
    }
  })
  it('ルールにかかわるゲームは、くわしいルールに根拠（競技規則の条番号）を書いている', () => {
    for (const id of ['rally', 'sensei', 'hayatouch', 'target'] as const) {
      expect(HOWTO[id].detail.join(' '), id).toMatch(/第\d+条/)
    }
  })
  it('読み上げる文に、絵文字は入れない（声にしたときに変な音にならないように）', () => {
    for (const g of GAMES) for (const t of howtoSpeech(g.id)) expect(t, t).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
