import { beforeEach, describe, expect, it } from 'vitest'
import { GAMES } from '../shell/games'
import { ITEMS, STARTER_ITEMS, WELCOME_STARS } from './items'
import { ALL_MISSIONS, BONUS_STARS, dayKey, missionsFor, RECORD } from './missions'
import { __setProgress, buy, getProgress, medalCount, recordPlay, recordStart, toggleWear, todayMissions } from './progress'
import { isBetter, MEDAL_GAMES, MEDAL_RULES, medalFor, nextGoal, senseiValue, recordText } from './records'
import type { Progress } from './progress'

const DAY = '2026-10-07'

function fresh(): Progress {
  return {
    stars: WELCOME_STARS,
    owned: [...STARTER_ITEMS],
    wear: {},
    plays: {},
    days: [],
    mission: { day: DAY, progress: [0, 0, 0], done: [false, false, false], bonus: false },
    cleared: 0,
    parties: 0,
    best: {},
    medals: {},
    recent: [],
  }
}

beforeEach(() => __setProgress(fresh()))

describe('きょうの ミッション', () => {
  it('日付で毎日3つ決まり、同じ日は同じ', () => {
    expect(missionsFor(DAY)).toEqual(missionsFor(DAY))
    const ms = missionsFor(DAY)
    expect(ms).toHaveLength(3)
    // ①と②で同じゲームにならない
    if (ms[0].game) expect(ms[1].game).not.toBe(ms[0].game)
  })

  it('1か月のあいだに、いろいろなミッションが出る', () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 31; d++) for (const m of missionsFor(`2026-12-${String(d).padStart(2, '0')}`)) seen.add(m.id)
    expect(seen.size).toBeGreaterThan(10)
  })

  it('ミッションに出てくるゲームは、ぜんぶ実在する', () => {
    const ids = new Set(GAMES.map((g) => g.id))
    for (const m of ALL_MISSIONS) if (m.game) expect(ids.has(m.game), m.id).toBe(true)
    // 記録のミッションは ひとりで遊ぶゲーム
    for (const m of RECORD) expect(GAMES.find((g) => g.id === m.game)?.players, m.id).toBe(1)
  })

  it('dayKey は端末の日付（YYYY-MM-DD）', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('達成すると ほしが1つ。3つ全部で おまけ', () => {
    const defs = missionsFor(DAY)
    const before = getProgress().stars
    // どのミッションでも達成できるように、それぞれに合った記録を送る
    for (const def of defs) {
      for (let i = 0; i < def.need + 1; i++) {
        if (def.kind === 'party') recordPlay({ type: 'party' }, DAY)
        else if (def.kind === 'two') recordPlay({ type: 'finish', game: 'rally', two: true }, DAY)
        else recordPlay({ type: 'finish', game: def.game ?? 'lift', value: def.need, two: false }, DAY)
      }
    }
    const p = getProgress()
    expect(p.mission.done).toEqual([true, true, true])
    expect(p.mission.bonus).toBe(true)
    expect(p.stars).toBe(before + 3 + BONUS_STARS)
    expect(p.cleared).toBe(3)
    // もう一度遊んでも増えない
    recordPlay({ type: 'finish', game: 'lift', value: 999, two: false }, DAY)
    expect(getProgress().stars).toBe(before + 3 + BONUS_STARS)
  })

  it('日付が変わると、新しいミッションになる', () => {
    recordPlay({ type: 'finish', game: 'lift', value: 999, two: false }, DAY)
    const next = '2026-10-08'
    const t = todayMissions(getProgress(), next)
    expect(t.state.day).toBe(next)
    expect(t.state.progress).toEqual([0, 0, 0])
  })
})

describe('スタンプと ごほうび', () => {
  it('はじめた日にスタンプ（同じ日は1つ）と回数', () => {
    recordStart('lift', DAY)
    recordStart('lift', DAY)
    recordStart('rally', DAY)
    const p = getProgress()
    expect(p.days).toEqual([DAY])
    expect(p.plays).toEqual({ lift: 2, rally: 1 })
  })

  it('スタンプ7こで きんいろパドルが もらえる', () => {
    for (let d = 1; d <= 7; d++) recordStart('lift', `2026-10-${String(d).padStart(2, '0')}`)
    expect(getProgress().owned).toContain('design:gold')
  })

  it('ほしと こうかん。足りないときは こうかんできない。とくべつな物は こうかんできない', () => {
    __setProgress({ ...fresh(), stars: 3 })
    expect(buy('design:lime')).toBe('ok')
    expect(getProgress().stars).toBe(1)
    expect(buy('design:lime')).toBe('owned')
    expect(buy('design:rainbow')).toBe('short')
    expect(buy('design:sakura')).toBe('special')
  })

  // ホークアイ先生の小物は、原画の置き場所を測るまで止めている（items.ts の WEAR_ON）
  it.skip('小物は同じ場所に1つだけ。持っていない物はつけられない', () => {
    __setProgress({ ...fresh(), owned: [...STARTER_ITEMS, 'wear:glasses', 'wear:sunglasses'] })
    toggleWear('glasses')
    expect(getProgress().wear).toEqual({ eyes: 'glasses' })
    toggleWear('sunglasses')
    expect(getProgress().wear).toEqual({ eyes: 'sunglasses' })
    toggleWear('sunglasses')
    expect(getProgress().wear).toEqual({})
    toggleWear('crown')
    expect(getProgress().wear).toEqual({})
  })

  it('一覧：id が重ならない。はじめから持っている物と、こうかん・とくべつ の物がある', () => {
    const ids = ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(STARTER_ITEMS).toContain('design:orange')
    expect(STARTER_ITEMS).toContain('shape:std')
    expect(ITEMS.filter((i) => i.special).length).toBeGreaterThanOrEqual(4)
    // はじめの プレゼントで、何か1つは こうかんできる
    expect(ITEMS.some((i) => !i.special && i.price > 0 && i.price <= WELCOME_STARS)).toBe(true)
  })
})

describe('じこベストと メダル', () => {
  it('メダルの目標は どう＜ぎん＜きん の順（小さいほど良いゲームは逆）。メダルのあるゲームは ぜんぶ実在する', () => {
    const ids = new Set(GAMES.map((g) => g.id))
    for (const g of MEDAL_GAMES) {
      expect(ids.has(g), g).toBe(true)
      const [a, b, c] = MEDAL_RULES[g]!.need
      if (MEDAL_RULES[g]!.low) expect(a > b && b > c, g).toBe(true)
      else expect(a < b && b < c, g).toBe(true)
    }
  })

  it('記録で メダルが決まる（反応の時間は 小さいほど良い）', () => {
    expect(medalFor('lift', 3)).toBe(0)
    expect(medalFor('lift', 5)).toBe(1)
    expect(medalFor('lift', 999)).toBe(3)
    expect(medalFor('reaction', 900)).toBe(0)
    expect(medalFor('reaction', 450)).toBe(2)
    expect(isBetter('reaction', 400, 500)).toBe(true)
    expect(isBetter('lift', 4, 5)).toBe(false)
    expect(nextGoal('lift', 6)).toEqual({ medal: 2, need: 15 })
    expect(nextGoal('lift', 40)).toBeNull()
    expect(recordText('sensei', senseiValue('otona'))).toBe('おとなで かった')
  })

  it('ひとりで遊んだ記録だけ じこベストに。メダルを とると ほし（きんは2こ）。とびこえたメダルの分も もらえる', () => {
    const before = getProgress().stars
    // じゅんばんモードなど record が無い記録は数えない
    recordPlay({ type: 'finish', game: 'target', value: 9, two: false }, DAY)
    expect(getProgress().best.target).toBeUndefined()
    const got = recordPlay({ type: 'finish', game: 'lift', value: 16, two: false, record: true }, DAY)
    expect(getProgress().best.lift).toBe(16)
    expect(getProgress().medals.lift).toBe(2)
    expect(got.filter((r) => r.type === 'medal').map((r) => (r.type === 'medal' ? r.medal : 0))).toEqual([1, 2])
    // 悪い記録では下がらない
    recordPlay({ type: 'finish', game: 'lift', value: 3, two: false, record: true }, DAY)
    expect(getProgress().best.lift).toBe(16)
    recordPlay({ type: 'finish', game: 'lift', value: 40, two: false, record: true }, DAY)
    expect(getProgress().medals.lift).toBe(3)
    const medalStars = 1 + 1 + 2
    const missionStars = getProgress().cleared + (getProgress().mission.bonus ? BONUS_STARS : 0)
    expect(getProgress().stars).toBe(before + medalStars + missionStars)
    expect(medalCount()).toBe(3)
  })

  it('メダルを 9こ あつめると チャンピオンの パドル', () => {
    recordPlay({ type: 'finish', game: 'lift', value: 999, two: false, record: true }, DAY)
    recordPlay({ type: 'finish', game: 'target', value: 999, two: false, record: true }, DAY)
    recordPlay({ type: 'finish', game: 'reaction', value: 100, two: false, record: true }, DAY)
    expect(getProgress().owned).toContain('design:champion')
  })

  it('さいきん はじめたゲームは 新しい順に3つ（じゅんばんモードは入れない）', () => {
    for (const g of ['lift', 'target', 'reaction', 'lift', 'rally'] as const) recordStart(g, DAY)
    recordStart('party', DAY)
    expect(getProgress().recent).toEqual(['rally', 'lift', 'reaction'])
  })
})
