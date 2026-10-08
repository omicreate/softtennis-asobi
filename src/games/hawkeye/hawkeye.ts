/**
 * ホークアイの め（ひとりで）：上から見たコートを一瞬だけ見せ、消えたあとに質問に答える。
 * 「ホークアイ」＝試合を上から見渡せる目（ホークアイ先生の名前の由来）を、遊びにしたもの。
 * React に依存しない純粋な関数（問題を作る・答えを判定する）。
 *
 * コートはダブルスのコート（横 10.97m・縦 23.77m。競技規則 第5条）。上が相手、下が自分たち。
 * 左右は、自分たち（画面の手前）から見た左右（ソフトテニスIQの用語ルールと同じ）。
 * 陣形の名前：雁行陣（1人が前・1人が後ろ）／ダブル前衛（2人とも前）／ダブル後衛（2人とも後ろ）。
 */
import type { Level } from '../../core/players'

export const W = 10.97
export const L = 23.77
export const NET = L / 2
/** サービスライン（ネットから 6.40m）。前衛の目安の線 */
export const SERVICE = 6.4

/** 1回の遊びの問題の数 */
export const QUESTIONS = 10

export type Kind = 'ball2' | 'ball4' | 'net3' | 'back2' | 'formation'

export interface Player {
  team: 'ours' | 'opp'
  role: '前' | '後'
  x: number
  y: number
}

export interface Choice {
  id: string
  label: string
}

export interface Question {
  kind: Kind
  players: Player[]
  ball: { x: number; y: number } | null
  prompt: string
  choices: Choice[]
  /** 選択肢の並べ方（cols 列。ball4 は 2×2 の地図のように並べる） */
  cols: number
  answer: string
  /** 答えあわせのひとこと */
  explain: string
}

/** 見せる時間（秒） */
export const SHOW_SEC: Record<Level, number> = { chibi: 3, kids: 2.4, otona: 1.6, senshu: 1.0 }

/** レベルごとに出す問題の種類 */
const KINDS: Record<Level, Kind[]> = {
  chibi: ['ball2'],
  kids: ['ball2', 'net3', 'back2'],
  otona: ['ball4', 'net3', 'formation'],
  senshu: ['ball4', 'formation', 'net3', 'formation'],
}

const between = (rand: () => number, a: number, b: number) => a + rand() * (b - a)

/** 相手のペア（陣形つき）。y は上が 0 */
function oppPair(rand: () => number, formation: 'gankou' | 'double-front' | 'double-back'): Player[] {
  const front = () => between(rand, NET - SERVICE + 0.8, NET - 1.2)
  const back = () => between(rand, -0.6, 2.2)
  const leftX = () => between(rand, 1.2, W / 2 - 0.8)
  const rightX = () => between(rand, W / 2 + 0.8, W - 1.2)
  const leftFirst = rand() < 0.5
  const [x1, x2] = leftFirst ? [leftX(), rightX()] : [rightX(), leftX()]
  switch (formation) {
    case 'gankou':
      return [
        { team: 'opp', role: '前', x: x1, y: front() },
        { team: 'opp', role: '後', x: x2, y: back() },
      ]
    case 'double-front':
      return [
        { team: 'opp', role: '前', x: x1, y: front() },
        { team: 'opp', role: '前', x: x2, y: front() },
      ]
    case 'double-back':
      return [
        { team: 'opp', role: '後', x: x1, y: back() },
        { team: 'opp', role: '後', x: x2, y: back() },
      ]
  }
}

/** 自分たちのペア（雁行陣。見せるだけ） */
function ourPair(rand: () => number): Player[] {
  return [
    { team: 'ours', role: '前', x: between(rand, 2, W - 2), y: between(rand, NET + 1.4, NET + 3.5) },
    { team: 'ours', role: '後', x: between(rand, 2, W - 2), y: between(rand, L - 1.5, L + 0.5) },
  ]
}

const FORMATION_NAME = { gankou: '雁行陣', 'double-front': 'ダブル前衛', 'double-back': 'ダブル後衛' } as const

/** ちびっこ・キッズには、前衛・後衛に読みがなをそえる */
const pos = (level: Level, word: '前衛' | '後衛') => (level === 'chibi' || level === 'kids' ? `${word}（${word === '前衛' ? 'ぜんえい' : 'こうえい'}）` : word)

export function makeQuestion(level: Level, i: number, rand: () => number = Math.random): Question {
  const kinds = KINDS[level]
  const kind = kinds[Math.floor(rand() * kinds.length)]
  const ours = ourPair(rand)
  switch (kind) {
    case 'ball2': {
      const right = rand() < 0.5
      const ball = { x: right ? between(rand, W / 2 + 0.8, W - 0.8) : between(rand, 0.8, W / 2 - 0.8), y: between(rand, 2, NET - 2) }
      return {
        kind,
        players: [...oppPair(rand, 'gankou'), ...ours],
        ball,
        prompt: 'ボールは どっちに おちた？',
        choices: [
          { id: 'left', label: 'ひだり' },
          { id: 'right', label: 'みぎ' },
        ],
        cols: 2,
        answer: right ? 'right' : 'left',
        explain: right ? 'みぎがわに おちたよ' : 'ひだりがわに おちたよ',
      }
    }
    case 'ball4': {
      const right = rand() < 0.5
      const deep = rand() < 0.5
      const ball = {
        x: right ? between(rand, W / 2 + 0.8, W - 0.8) : between(rand, 0.8, W / 2 - 0.8),
        y: deep ? between(rand, 0.8, NET - SERVICE - 0.8) : between(rand, NET - SERVICE + 0.8, NET - 0.8),
      }
      const id = `${deep ? 'back' : 'front'}-${right ? 'right' : 'left'}`
      const name = `${deep ? 'おく（サービスラインの むこう）' : 'まえ（サービスラインの てまえ）'}の ${right ? 'みぎ' : 'ひだり'}`
      return {
        kind,
        players: [...oppPair(rand, 'gankou'), ...ours],
        ball,
        prompt: 'ボールは どこに おちた？',
        // 地図のように並べる：上の列＝おく、下の列＝まえ
        choices: [
          { id: 'back-left', label: 'おく・ひだり' },
          { id: 'back-right', label: 'おく・みぎ' },
          { id: 'front-left', label: 'まえ・ひだり' },
          { id: 'front-right', label: 'まえ・みぎ' },
        ],
        cols: 2,
        answer: id,
        explain: `${name}に おちたよ`,
      }
    }
    case 'net3': {
      // 相手の前衛（雁行陣）の位置：左・まんなか・右
      const zone = Math.floor(rand() * 3)
      const x = [between(rand, 0.8, W / 3 - 0.5), between(rand, W / 3 + 0.5, (W * 2) / 3 - 0.5), between(rand, (W * 2) / 3 + 0.5, W - 0.8)][zone]
      const opp = oppPair(rand, 'gankou')
      opp[0].x = x
      // 後衛は前衛と反対側の奥に（重ならないように）
      opp[1].x = zone === 0 ? between(rand, W / 2, W - 1.2) : zone === 2 ? between(rand, 1.2, W / 2) : between(rand, 1.2, W - 1.2)
      const ids = ['left', 'center', 'right']
      const names = ['ひだり', 'まんなか', 'みぎ']
      return {
        kind,
        players: [...opp, ...ours],
        ball: null,
        prompt: `あいての ${pos(level, '前衛')}は どこに いた？`,
        choices: ids.map((id, k) => ({ id, label: names[k] })),
        cols: 3,
        answer: ids[zone],
        explain: `あいての 前衛は ${names[zone]}に いたよ`,
      }
    }
    case 'back2': {
      const opp = oppPair(rand, 'gankou')
      const right = opp[1].x >= W / 2
      return {
        kind,
        players: [...opp, ...ours],
        ball: null,
        prompt: `あいての ${pos(level, '後衛')}は どっちに いた？`,
        choices: [
          { id: 'left', label: 'ひだり' },
          { id: 'right', label: 'みぎ' },
        ],
        cols: 2,
        answer: right ? 'right' : 'left',
        explain: `あいての 後衛は ${right ? 'みぎ' : 'ひだり'}の おくに いたよ`,
      }
    }
    case 'formation': {
      const f = (['gankou', 'double-front', 'double-back'] as const)[Math.floor(rand() * 3)]
      return {
        kind,
        players: [...oppPair(rand, f), ...ours],
        ball: null,
        prompt: 'あいての 陣形は？',
        choices: [
          { id: 'gankou', label: '雁行陣（1人まえ・1人うしろ）' },
          { id: 'double-front', label: 'ダブル前衛（2人とも まえ）' },
          { id: 'double-back', label: 'ダブル後衛（2人とも うしろ）' },
        ],
        cols: 1,
        answer: f,
        explain: `あいては ${FORMATION_NAME[f]}だったよ`,
      }
    }
  }
}

export interface HeState {
  level: Level
  index: number
  phase: 'show' | 'ask' | 'result' | 'over'
  /** いまの場面の残り時間（秒） */
  timer: number
  question: Question
  picked: string | null
  correct: number
}

export function createHe(level: Level, rand: () => number = Math.random): HeState {
  return { level, index: 0, phase: 'show', timer: SHOW_SEC[level], question: makeQuestion(level, 0, rand), picked: null, correct: 0 }
}

export type HeEvent = { type: 'hide' } | { type: 'answer'; ok: boolean } | { type: 'next'; index: number } | { type: 'over'; correct: number }

/** 答えあわせを見せる時間（秒） */
export const RESULT_SEC = 1.8

export function stepHe(s: HeState, dt: number, rand: () => number = Math.random): HeEvent[] {
  const ev: HeEvent[] = []
  if (s.phase === 'show') {
    s.timer -= dt
    if (s.timer <= 0) {
      s.phase = 'ask'
      ev.push({ type: 'hide' })
    }
  } else if (s.phase === 'result') {
    s.timer -= dt
    if (s.timer <= 0) {
      s.index += 1
      if (s.index >= QUESTIONS) {
        s.phase = 'over'
        ev.push({ type: 'over', correct: s.correct })
      } else {
        s.question = makeQuestion(s.level, s.index, rand)
        s.picked = null
        s.phase = 'show'
        s.timer = SHOW_SEC[s.level]
        ev.push({ type: 'next', index: s.index })
      }
    }
  }
  return ev
}

/** 答える。見せている間・答えたあとは受けつけない */
export function answerHe(s: HeState, id: string): HeEvent[] {
  if (s.phase !== 'ask') return []
  const ok = id === s.question.answer
  s.picked = id
  if (ok) s.correct += 1
  s.phase = 'result'
  s.timer = RESULT_SEC
  return [{ type: 'answer', ok }]
}
