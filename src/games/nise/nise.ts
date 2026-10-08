/**
 * にせホークアイ先生は だれだ？（ホークアイ先生人狼。ワードウルフ型）。React に依存しない純粋な計算。
 *
 * 1回の流れ：
 *   ① 1台を手わたしで回し、1人ずつ こっそり お題を見る。1人だけ（にせホークアイ先生）お題がちがう。
 *      にせホークアイ先生は、自分が にせものだと知らない（画面の形は全員同じ）
 *   ② 決めた時間、お題のことを話す（お題の ことばそのものは言わない）
 *   ③ 「せーの」で、にせホークアイ先生だと思う人を ゆびさす。いちばん多く さされた人を画面で選ぶ（同じ数なら、少し話してもう一度）
 *      ゆびさしの代わりに、1台を回して1人ずつ こっそり とうひょうもできる（人を指ささない・まわりにつられない）
 *   ④ 発表。さされた人が にせホークアイ先生なら「ぎゃくてん チャンス」：みんなのお題を声に出して言い当てたら、にせホークアイ先生の逆転勝ち
 *      （あっているかは、答えを見て みんなで決める。選択肢にすると、自分のお題と似たものを選ぶだけで当たってしまう）
 */
import { WORDS } from './words'
import type { Deck, Word, WordPair } from './words'

export interface NiseRound {
  deck: Deck
  /** WORDS[deck] の何番めの組か */
  pair: number
  /** みんな（多い方）のお題が a か b か */
  majority: 'a' | 'b'
  /** にせホークアイ先生の人の番号（0から） */
  wolf: number
  players: number
}

export interface Outcome {
  winner: 'minna' | 'nise'
  /** caught＝見やぶった／missed＝ちがう人をさした／reverse＝ばれたけれど お題を当てて逆転 */
  how: 'caught' | 'missed' | 'reverse'
}

/** きめかた：point＝せーので ゆびさし／secret＝1台を回して こっそり とうひょう */
export type VoteMode = 'point' | 'secret'
export const VOTE_MODES: VoteMode[] = ['point', 'secret']

/** 話す時間（秒） */
export const TALK_TIMES = [60, 120, 180]
/** 同じ数だったときに、もう少し話す時間（秒） */
export const TIE_TIME = 30
export const MIN_PLAYERS = 3

/** お題と にせホークアイ先生を決める。同じ遊びの間は、出し切るまで同じ組を出さない */
export function dealRound(deck: Deck, players: number, rand: () => number = Math.random, used: Set<string> = new Set()): NiseRound {
  const pairs = WORDS[deck]
  const key = (i: number) => `${deck}:${i}`
  let fresh = pairs.map((_, i) => i).filter((i) => !used.has(key(i)))
  if (fresh.length === 0) {
    for (let i = 0; i < pairs.length; i++) used.delete(key(i))
    fresh = pairs.map((_, i) => i)
  }
  const pair = fresh[Math.floor(rand() * fresh.length)]
  used.add(key(pair))
  return { deck, pair, majority: rand() < 0.5 ? 'a' : 'b', wolf: Math.floor(rand() * players), players }
}

export const pairOf = (r: NiseRound): WordPair => WORDS[r.deck][r.pair]
export const majorityWord = (r: NiseRound): Word => pairOf(r)[r.majority]
export const wolfWord = (r: NiseRound): Word => pairOf(r)[r.majority === 'a' ? 'b' : 'a']
/** その人に見せるお題 */
export const wordFor = (r: NiseRound, player: number): Word => (player === r.wolf ? wolfWord(r) : majorityWord(r))

/** 勝ち負け。guessedRight は、ばれた にせホークアイ先生が みんなのお題を言い当てたか（みんなで決める） */
export function judgeOutcome(r: NiseRound, pointed: number, guessedRight = false): Outcome {
  if (pointed !== r.wolf) return { winner: 'nise', how: 'missed' }
  if (guessedRight) return { winner: 'nise', how: 'reverse' }
  return { winner: 'minna', how: 'caught' }
}

/** こっそり とうひょうの集計。いちばん多い人が1人なら top にその人、同じ数の人がいたら null */
export function tally(votes: number[], players: number): { counts: number[]; top: number | null } {
  const counts = Array.from({ length: players }, () => 0)
  for (const v of votes) if (v >= 0 && v < players) counts[v] += 1
  const max = Math.max(...counts)
  const tops = counts.flatMap((c, i) => (c === max ? [i] : []))
  return { counts, top: tops.length === 1 ? tops[0] : null }
}

/** もらえる ほし：みんなの かち＝にせホークアイ先生以外に1つずつ、にせホークアイ先生の かち＝にせホークアイ先生に2つ */
export function starsFor(r: NiseRound, o: Outcome): number[] {
  return Array.from({ length: r.players }, (_, i) => (o.winner === 'nise' ? (i === r.wolf ? 2 : 0) : i === r.wolf ? 0 : 1))
}

/** 話すときのヒント（お題そのものは言わない） */
export const TALK_HINTS: Record<Deck, string[]> = {
  e: ['どんな いろ？', 'おおきさは？ てに のる？', 'すき？ きらい？', 'どこで みる？', 'たべられる？', 'さわったら どんな かんじ？'],
  kotoba: ['いつ する？ いつ みる？', 'どこに ある？', 'すき？ きらい？', 'だれと いく？ だれと する？', 'なつ？ ふゆ？', 'さいごに いつ みた？'],
  soft: ['コートの どこ？', 'だれが する？ いつ する？', 'つよい？ やさしい？', 'ルールで きまっている こと は？', 'はじめての ひとに どう おしえる？', 'にている ことばとの ちがいは？'],
}
