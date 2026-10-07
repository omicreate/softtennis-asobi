import type { Face } from '../ui/Pikuru'

export type GameId =
  | 'rally'
  | 'tug'
  | 'air'
  | 'dink'
  | 'hayatouch'
  | 'quiz'
  | 'breakout2'
  | 'jump'
  | 'lift'
  | 'catch'
  | 'breakout'
  | 'target'
  | 'pikuru'
  | 'linestop'
  | 'curling'
  | 'serveread'
  | 'reaction'
  | 'stop10'
  | 'nise'
  | 'gesture'
  | 'ishin'
  | 'sagasu'
  | 'sagasu2'

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
    id: 'tug',
    title: 'れんだ つなひき',
    tag: 'たいせん',
    desc: 'いっぱい タッチして ボールを おしこもう',
    face: 'eh',
    howto: 'じぶんの がめんを いっぱい タッチ！ まんなかの ボールを、あいての ほうへ おしこもう。さきに 2かい かったら かち。',
    players: 2,
  },
  {
    id: 'air',
    title: 'エアピックル',
    tag: 'たいせん',
    desc: 'パドルで うって ゴールを ねらおう',
    face: 'ok',
    howto: 'ゆびで パドルを うごかして、ボールを うとう。あいての ゴールに いれたら 1てん。さきに 5てん とったら かち。',
    players: 2,
  },
  {
    id: 'dink',
    title: 'ディンクで つなごう',
    tag: 'きょうりょく',
    desc: 'ふたりで なんかい つづくかな',
    face: 'think',
    howto: 'ふたりで きょうりょく。ネットの まえの キッチンに、そっと ボールを おとして、なんかい つづくか ちょうせんしよう。',
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
    id: 'sagasu2',
    title: 'ピクルくん さがし たいせん',
    wrap: 'ピクルくん さがし|たいせん',
    tag: 'たいせん',
    desc: 'さきに ほんものを みつけた ほうが かち',
    face: 'eh',
    howto: 'うえと したに、にせものの ピクルくんが いっぱい。さきに ほんものを みつけて タッチした ほうが 1てん。さきに 3てん とったら かち。',
    players: 2,
  },
  {
    id: 'breakout2',
    title: 'ピクルくずし たいせん',
    tag: 'たいせん',
    desc: 'まんなかの ブロックを さきに くずそう',
    face: 'eh',
    howto: 'うえと したで、まんなかの ブロックを くずしあうよ。じぶんの いろの ボールで くずすと てんに なる。',
    players: 2,
  },
  {
    id: 'jump',
    title: 'ピクルくん ジャンプ',
    tag: 'ひとりで',
    desc: 'とんでくる ボールを 3だんジャンプで よけよう',
    face: 'eh',
    howto: 'タップで ジャンプ。くうちゅうで もういちど タップすると、3だんまで とべるよ。とんでくる ボールや ネットを よけよう。',
    players: 1,
    party: true,
    unit: 'm',
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
    id: 'catch',
    title: 'ボールキャッチ',
    wrap: 'ボール|キャッチ',
    tag: 'ひとりで',
    desc: 'あなの あいた ボールだけ とろう',
    face: 'eh',
    howto: 'かごを うごかして、そらから おちてくる ピックルボールを とろう。あなが あいているのが ピックルボール。ほかの ボールは とらないでね。',
    players: 1,
    party: true,
    unit: 'てん',
  },
  {
    id: 'breakout',
    title: 'ピクルくずし',
    tag: 'ひとりで',
    desc: 'パドルで うちかえして ブロックを くずそう',
    face: 'ok',
    howto: 'ゆびで パドルを うごかして、ボールを うちかえそう。ブロックを ぜんぶ くずしたら クリア。みどりの ピクルスは 2かい あてよう。',
    players: 1,
    party: true,
    unit: 'てん',
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
    id: 'sagasu',
    title: 'ピクルくん さがし',
    wrap: 'ピクルくん|さがし',
    tag: 'ひとりで',
    desc: 'ほんものの ピクルくんや、まちがいを さがそう',
    face: 'think',
    howto: 'にせものの ピクルくんが いっぱい！ ライムの はちまきと、あたまの つるが ある ほんものを さがして タッチしよう。まちがいさがしも あるよ。',
    players: 1,
    party: true,
    better: 'low',
    unit: 'びょう',
    fmt: (v) => `${(v / 1000).toFixed(1)}びょう`,
  },
  {
    id: 'linestop',
    title: 'ラインぎわ ストップ',
    tag: 'たいせん',
    desc: 'ぎりぎりで とめた ほうが かち',
    face: 'eh',
    howto: 'ボールが じぶんの ほうへ ころがってくるよ。タップで とめよう。ラインに ちかいほど かち。こえたら アウト。',
    players: 2,
    adult: true,
  },
  {
    id: 'curling',
    title: 'キッチン カーリング',
    tag: 'たいせん',
    desc: 'まとの まんなかに ちかづけよう',
    face: 'think',
    howto: 'ゆびを うしろに ひいて はなすと、ボールを なげるよ。まとの まんなかに ちかい ほうが てんを とる。あいての ボールを はじいても いいよ。',
    players: 2,
    adult: true,
  },
  {
    id: 'serveread',
    title: 'よみあい サーブ',
    tag: 'しんりせん',
    desc: 'こっそり えらんで、よみあい かけひき',
    face: 'think',
    howto: 'じゅんばんに こっそり えらぼう。サーブは ねらう ところ、レシーブは まつ ところ。あいてが えらぶ あいだは めを とじて、はなしかけて ゆさぶろう。おなじなら レシーブの てん、ちがえば サーブの てん。',
    players: 2,
    pass: true,
    adult: true,
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
    id: 'stop10',
    title: 'ピタッと 10びょう',
    tag: 'ハイスコア',
    desc: '10びょう ちょうどで キャッチ',
    face: 'think',
    howto: 'タップで ロブを うちあげるよ。とけいが きえても、10びょう ちょうどだと おもったら タップ。3かいの うち いちばん ちかい きろくで くらべるよ。',
    players: 1,
    party: true,
    adult: true,
    better: 'low',
    unit: 'びょう',
    fmt: (v) => `ずれ ${(v / 1000).toFixed(2)}びょう`,
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
    id: 'gesture',
    title: 'ジェスチャー ピックル',
    wrap: 'ジェスチャー|ピックル',
    tag: 'ジェスチャー',
    desc: 'こえを ださずに、からだで つたえよう',
    face: 'ok',
    howto: 'やる ひとだけ がめんを みて、こえを ださずに からだで まねしよう。みんなは なにか あててね。あたったら、やる ひとが あたりを おすよ。',
    players: 'group',
    range: [2, 6],
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
