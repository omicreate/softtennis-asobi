import { describe, expect, it } from 'vitest'
import { LEVELS } from '../../core/players'
import { mulberry32 } from '../../core/rng'
import { answerHe, createHe, makeQuestion, NET, QUESTIONS, SERVICE, SHOW_SEC, stepHe, W } from './hawkeye'

describe('ホークアイの め：問題', () => {
  it('どのレベルでも、答えは選択肢の中にあり、選択肢は重ならない', () => {
    const rand = mulberry32(1)
    for (const lv of LEVELS) {
      for (let i = 0; i < 300; i++) {
        const q = makeQuestion(lv, i, rand)
        const ids = q.choices.map((c) => c.id)
        expect(new Set(ids).size, q.kind).toBe(ids.length)
        expect(ids, q.kind).toContain(q.answer)
      }
    }
  })
  it('ボールの問題：ボールは相手コートの中で、答えは落ちた側（左右は手前から見た左右）', () => {
    const rand = mulberry32(2)
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion('otona', i, rand)
      if (q.kind !== 'ball4') continue
      const b = q.ball!
      expect(b.y).toBeLessThan(NET)
      expect(b.y).toBeGreaterThan(0)
      const right = b.x >= W / 2
      const deep = b.y < NET - SERVICE
      expect(q.answer).toBe(`${deep ? 'back' : 'front'}-${right ? 'right' : 'left'}`)
    }
  })
  it('陣形の問題：雁行陣は前と後ろが1人ずつ、ダブル前衛は2人とも前、ダブル後衛は2人とも後ろ', () => {
    const rand = mulberry32(3)
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion('senshu', i, rand)
      if (q.kind !== 'formation') continue
      const opp = q.players.filter((p) => p.team === 'opp')
      const front = opp.filter((p) => p.y > NET - SERVICE).length
      expect(q.answer).toBe(front === 1 ? 'gankou' : front === 2 ? 'double-front' : 'double-back')
    }
  })
  it('前衛の問題：答えは、相手の前衛がいた3つの区切り（左・まんなか・右）', () => {
    const rand = mulberry32(4)
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion('kids', i, rand)
      if (q.kind !== 'net3') continue
      const front = q.players.find((p) => p.team === 'opp' && p.role === '前')!
      const zone = front.x < W / 3 ? 'left' : front.x < (W * 2) / 3 ? 'center' : 'right'
      expect(q.answer).toBe(zone)
    }
  })
  it('ちびっこは「どっちに おちた？」だけ', () => {
    const rand = mulberry32(5)
    for (let i = 0; i < 50; i++) expect(makeQuestion('chibi', i, rand).kind).toBe('ball2')
  })
})

describe('ホークアイの め：進み方', () => {
  it('見せる → 消える → 答える → 答えあわせ → 次。10問で終わる', () => {
    const rand = mulberry32(7)
    const s = createHe('kids', rand)
    let overCorrect = -1
    for (let n = 0; n < QUESTIONS; n++) {
      expect(s.phase).toBe('show')
      // 見せている間は答えられない
      expect(answerHe(s, s.question.answer)).toEqual([])
      for (let t = 0; t <= SHOW_SEC.kids + 0.05; t += 1 / 60) stepHe(s, 1 / 60, rand)
      expect(s.phase).toBe('ask')
      expect(answerHe(s, n % 2 === 0 ? s.question.answer : 'zzz')).toEqual([{ type: 'answer', ok: n % 2 === 0 }])
      for (let t = 0; t < 3; t += 1 / 60) {
        for (const e of stepHe(s, 1 / 60, rand)) if (e.type === 'over') overCorrect = e.correct
        if (s.phase !== 'result') break
      }
    }
    expect(s.phase).toBe('over')
    expect(overCorrect).toBe(QUESTIONS / 2)
  })
  it('せんしゅほど見せる時間が短い', () => {
    expect(SHOW_SEC.senshu).toBeLessThan(SHOW_SEC.otona)
    expect(SHOW_SEC.otona).toBeLessThan(SHOW_SEC.kids)
    expect(SHOW_SEC.kids).toBeLessThan(SHOW_SEC.chibi)
  })
})
