import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../core/rng'
import { dealRound, judgeOutcome, majorityWord, starsFor, tally, TALK_HINTS, wolfWord, wordFor } from './nise'
import { DECKS, WORDS } from './words'

describe('にせホークアイ先生の お題', () => {
  it('どの組も2つのことばが ちがう。同じ山に同じ組は ない', () => {
    for (const d of DECKS) {
      const seen = new Set<string>()
      for (const p of WORDS[d]) {
        expect(p.a.text, d).not.toBe(p.b.text)
        const key = [p.a.text, p.b.text].sort().join('/')
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
      expect(WORDS[d].length, d).toBeGreaterThanOrEqual(8)
      expect(TALK_HINTS[d].length, d).toBeGreaterThan(3)
    }
  })

  it('「え」のお題は どれも絵がある（字が読めない子のため）', () => {
    for (const p of WORDS.e) {
      expect(p.a.pic, p.a.text).toBeTruthy()
      expect(p.b.pic, p.b.text).toBeTruthy()
    }
  })

  it('ソフテニ用語は、どれも答えあわせの「ちがい」がある。ルールの用語には条番号がある', () => {
    for (const p of WORDS.soft) expect(p.tip, `${p.a.text}/${p.b.text}`).toBeTruthy()
    const rule = ['ツーバウンズ', 'フォールト', 'ファーストサービス', 'デュース', 'ネットタッチ', 'ゲーム', 'サービスライン']
    for (const p of WORDS.soft.filter((x) => rule.includes(x.a.text))) expect(p.tip, p.a.text).toMatch(/第\d+条/)
  })
})

describe('にせホークアイ先生の 進めかた', () => {
  it('1人だけ（にせホークアイ先生）お題がちがう', () => {
    const rand = mulberry32(7)
    for (let n = 3; n <= 6; n++) {
      for (let k = 0; k < 20; k++) {
        const r = dealRound('kotoba', n, rand)
        expect(r.wolf).toBeGreaterThanOrEqual(0)
        expect(r.wolf).toBeLessThan(n)
        const words = Array.from({ length: n }, (_, i) => wordFor(r, i).text)
        const odd = words.filter((w) => w !== majorityWord(r).text)
        expect(odd).toEqual([wolfWord(r).text])
        expect(words[r.wolf]).toBe(wolfWord(r).text)
      }
    }
  })

  it('同じ遊びの間は、出し切るまで同じ組を出さない', () => {
    const rand = mulberry32(3)
    const used = new Set<string>()
    const n = WORDS.e.length
    const pairs = Array.from({ length: n }, () => dealRound('e', 4, rand, used).pair)
    expect(new Set(pairs).size).toBe(n)
    // 出し切ったら また出る
    expect(dealRound('e', 4, rand, used).pair).toBeGreaterThanOrEqual(0)
  })

  it('かち・まけと ほし', () => {
    const r = { deck: 'e' as const, pair: 0, majority: 'a' as const, wolf: 2, players: 4 }
    // ちがう人をさした → にせホークアイ先生の かち（にせホークアイ先生に ほし2つ）
    const missed = judgeOutcome(r, 1)
    expect(missed).toEqual({ winner: 'nise', how: 'missed' })
    expect(starsFor(r, missed)).toEqual([0, 0, 2, 0])
    // 見やぶった → みんなの かち（にせホークアイ先生以外に1つずつ）
    const caught = judgeOutcome(r, 2, false)
    expect(caught).toEqual({ winner: 'minna', how: 'caught' })
    expect(starsFor(r, caught)).toEqual([1, 1, 0, 1])
    // ばれたけれど、みんなのお題を言い当てた → ぎゃくてん
    expect(judgeOutcome(r, 2, true)).toEqual({ winner: 'nise', how: 'reverse' })
    // ちがう人をさしたときは、言い当てても関係ない
    expect(judgeOutcome(r, 0, true)).toEqual({ winner: 'nise', how: 'missed' })
  })

  it('こっそり とうひょう：いちばん多い人が1人なら その人、同じ数なら もう一度', () => {
    expect(tally([2, 2, 0, 2], 4)).toEqual({ counts: [1, 0, 3, 0], top: 2 })
    expect(tally([1, 0, 1, 0], 4).top).toBeNull()
    expect(tally([1, 2, 0], 3).top).toBeNull()
  })
})
