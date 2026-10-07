import type { Face } from '../ui/Pikuru'

export type GameId =
  | 'rally'
  | 'hayatouch'
  | 'quiz'
  | 'lift'
  | 'target'
  | 'pikuru'
  | 'reaction'
  | 'nise'
  | 'ishin'

export interface GameInfo {
  id: GameId
  title: string
  /** たいせん／きょうりょく など */
  tag: string
  desc: string
  face: Face
  /** 読み上げる説明（文字が読めない子のため） */
  howto: string
  /** 何人で遊ぶか（1＝ひとりで、2＝1台を机に置いて上下で向かい合う、group＝みんなで1台を手わたし） */
  players: 1 | 2 | 'group'
  /** みんなで遊ぶゲームの人数（いちばん少ない・多い） */
  range?: [number, number]
  /** みんなで遊ぶゲームで、遊べる人数がとびとびのとき（例 2人か4人） */
  sizes?: number[]
  /** ふたりのゲームを「てわたし」（1人ずつ画面を見て、相手には見せない）でも遊べる */
  pass?: boolean
  /** じゅんばんモードで使う（ひとりで、同じ条件で記録を比べられるゲーム） */
  party?: boolean
  /** じゅんばんモードで比べる記録の単位（例 m・てん） */
  unit?: string
  /** 記録の良し悪し（low＝小さいほど良い：反応の時間・ずれ） */
  better?: 'high' | 'low'
  /** 記録の見せ方（無ければ 数＋単位） */
  fmt?: (v: number) => string
  /** ホームの「おとなも むちゅう」に出す（大人どうしでも楽しめる勝負） */
  adult?: boolean
  /** ホームのカードで折り返してよい所を | で示した名前（単語の途中で折り返さないように） */
  wrap?: string
}

/** 記録を文字にする（じゅんばんモードの結果など） */
export function formatValue(g: GameInfo | undefined, v: number): string {
  if (!g) return String(v)
  return g.fmt ? g.fmt(v) : `${v}${g.unit ?? ''}`
}

export const GAMES: GameInfo[] = [
  {
    id: 'rally',
    title: 'ラリーたいけつ',
    tag: 'たいせん',
    desc: 'ゆびで パドルを うごかして うちあおう',
    face: 'ok',
    howto: 'ゆびで パドルを うごかして、ボールを うちかえそう。うえに シュッと ふると、つよく とぶよ。',
    players: 2,
  },
  {
    id: 'hayatouch',
    title: 'はやタッチ',
    tag: 'はやおし',
    desc: 'ひかったら タッチ！ インかな アウトかな',
    face: 'eh',
    howto: 'ボールが みどりに ひかったら、すぐに タッチ。オレンジの ときは さわらないでね。',
    players: 2,
  },
  {
    id: 'quiz',
    title: 'ピクルくんクイズ',
    wrap: 'ピクルくん|クイズ',
    tag: 'クイズ',
    desc: 'さきに あてた ほうが かち',
    face: 'think',
    howto: 'ピクルくんの クイズだよ。こたえが わかったら、てもとの ボタンを はやく おそう。',
    players: 2,
  },
  {
    id: 'lift',
    title: 'ポンポン リフティング',
    tag: 'ひとりで',
    desc: 'ボールを おとさずに なんかい つづくかな',
    face: 'think',
    howto: 'ボールの かげの ところに パドルを うごかそう。おちてきた ボールが パドルに あたると、ポンと はねるよ。なんかい つづくかな。',
    players: 1,
    party: true,
    unit: 'かい',
  },
  {
    id: 'target',
    title: 'ねらってショット',
    wrap: 'ねらって|ショット',
    tag: 'ひとりで',
    desc: 'ピクルマシンの ボールを まとに うちかえそう',
    face: 'think',
    howto: 'ピクルマシンから ボールが くるよ。ひかっている まとを ねらって うちかえそう。10きゅうで いくつ はいるかな。',
    players: 1,
    party: true,
    unit: 'きゅう',
  },
  {
    id: 'pikuru',
    title: 'ピクルくんと ラリー',
    tag: 'ひとりで',
    desc: 'ピクルくんと しょうぶ！',
    face: 'ok',
    howto: 'ピクルくんと しょうぶだよ。ゆびで パドルを うごかして、ボールを うちかえそう。',
    players: 1,
  },
  {
    id: 'reaction',
    title: 'リアクション ボレー',
    tag: 'ハイスコア',
    desc: 'きたら すぐ タップ！ はんのうを はかろう',
    face: 'eh',
    howto: 'ピクルマシンから ボールが きたら、すぐに タップ。オレンジの ボールは さわらないでね。5かいの へいきんで くらべるよ。',
    players: 1,
    party: true,
    adult: true,
    better: 'low',
    unit: 'びょう',
    fmt: (v) => `${(v / 1000).toFixed(3)}びょう`,
  },
  {
    id: 'nise',
    title: 'にせピクルくんは だれだ？',
    wrap: 'にせピクルくんは|だれだ？',
    tag: 'じんろう',
    desc: 'ひとりだけ おだいが ちがう。はなして みつけよう',
    face: 'think',
    howto: 'ひとりずつ こっそり おだいを みるよ。ひとりだけ ちがう おだいの、にせピクルくんが いる。おだいの ことを はなして、さいごに せーので ゆびさし！',
    players: 'group',
    range: [3, 6],
  },
  {
    id: 'ishin',
    title: 'いしんでんしん ダブルス',
    wrap: 'いしんでんしん|ダブルス',
    tag: 'きょうりょく',
    desc: 'パートナーと おなじ こたえを えらべるかな',
    face: 'ok',
    howto: 'おなじ しつもんに、ペアの ふたりが こっそり こたえるよ。おなじ こたえなら いしんでんしん！ せいかいは ないよ。',
    players: 'group',
    range: [2, 4],
    sizes: [2, 4],
  },
]

export const gameById = (id: string | undefined) => GAMES.find((g) => g.id === id)
