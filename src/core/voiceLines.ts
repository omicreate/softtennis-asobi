/**
 * ElevenLabs で前もって音声にしておくセリフの一覧（scripts/build-voice.mjs が読む）。
 * ここにない文は、端末の読み上げ（speechSynthesis）で読む。
 */
import { I_QUESTIONS } from '../games/ishin/questions'
import { QUESTIONS } from '../games/quiz/questions'
import { GAMES } from '../shell/games'
import { howtoSpeech } from '../shell/howto'
import { champLine, nextGameLine, PARTY_COLORS, teamWinLine, turnLine } from '../shell/party/colors'
import { TEAMS } from '../shell/party/scoring'
import { ITEMS } from './items'
import { ALL_MISSIONS } from './missions'

/** ゲームの中で声に出す決まり文句 */
export const PHRASES = {
  ready: 'よーい',
  touch: 'タッチ！',
  correct: 'せいかい！',
  miss: 'ざんねん',
  draw: 'ひきわけ！',
  tooStrong: 'つよすぎ！ そっと ポンだよ',
  point0: 'オレンジの てん！',
  point1: 'あおの てん！',
  win0: 'オレンジの かち！',
  win1: 'あおの かち！',
  great: 'すごい！ さいこう きろく！',
  nice: 'ナイスショット！',
  youWin: 'やったね！ あなたの かち！',
  senseiWin: 'ピクルくんの かち！ また あそぼう',
  missions: 'きょうの ミッション',
  missionClear: 'ミッション クリア！',
  newItem: 'あたらしい ごほうびを もらったよ！',
  welcome: 'はじめての プレゼント！ ほしを 3つ あげるね',
  partyIntro: 'じゅんばんモード！ じゅんばんに あそんで、きろくで しょうぶだよ',
  partyRound: 'ラウンドの けっかだよ',
  partyEnd: 'みんな よく がんばったね！',
  traded: 'こうかん したよ！',
  srFinal: 'ファイナル ラウンド！ とくてん 2ばい！',
  srLast: 'さいごの チャンス！ かえる？ そのまま？',
  srRead: 'よんだ！ リターン！',
  srAce: 'サービスエース！',
  rest: 'たくさん あそんだね！ ちょっと きゅうけい しよう',
  niseIntro: 'ひとりだけ おだいが ちがう、にせピクルくんが いるよ。はなして、せーので ゆびさし！ にせピクルくんは、じぶんが にせものだと しらないよ',
  niseReady: 'みんな おだいを みたね！ つくえの まんなかに おいてね',
  niseTalk: 'はなしあい スタート！ おだいの ことばは いわないでね',
  niseTie: 'おなじ かず！ もう すこし はなして、もういちど ゆびさし',
  nisePoint: 'じかん！ にせピクルくんだと おもう ひとを、せーので ゆびさそう',
  niseSeno: 'せーの！',
  niseVote: 'じかん！ こっそり とうひょう するよ。1だいを じゅんばんに まわしてね',
  niseCaught: 'にせピクルくん だった！',
  niseMissed: 'ほんものの ピクルくん だった！',
  niseChance: 'ぎゃくてん チャンス！ みんなの おだいを、こえに だして いってみよう',
  niseMinnaWin: 'みんなの かち！',
  niseWin: 'にせピクルくんの かち！',
  niseReverse: 'ぎゃくてん！ にせピクルくんの かち！',
  gestIntro: 'やる ひとだけ がめんを みて、こえを ださずに からだで まねしよう。パドルは もたずに、てで やってね',
  gestStart: 'スタート！',
  gestEnd: 'そこまで！',
  gestFinal: 'みんなで たくさん つたえられたね！',
  sagasuWally: 'ほんものの ピクルくんを さがそう！ ライムの はちまきと、あたまの つるが めじるしだよ',
  sagasuKitchen: 'みつけた！ ピクルくんは キッチンに いたよ',
  sagasuService: 'みつけた！ ピクルくんは サービスコートに いたよ',
  sagasuOutside: 'みつけた！ ピクルくんは コートの そとに いたよ',
  sagasuDiff: 'うえと したの え、ちがう ところを さがそう',
  sagasuFound: 'みつけた！',
  sagasuAll: 'ぜんぶ みつけた！',
  sagasuHint: 'ヒント！ この あたりを よく みてね',
  sagasuDuel: 'さきに ほんものを みつけた ほうが かち！',
  ishinIntro: 'おなじ しつもんに、ペアの ふたりが こっそり こたえるよ。おなじ こたえなら いしんでんしん！ せいかいは ないよ',
  ishinMatch: 'いしんでんしん！',
  ishinMiss: 'おしい！ どうして それに したか、はなしてみよう',
  ishinEnd: 'けっか はっぴょう！',
} as const

export function allVoiceLines(): string[] {
  const lines = new Set<string>()
  for (const g of GAMES) {
    lines.add(g.howto)
    for (const t of howtoSpeech(g.id)) lines.add(t)
  }
  for (const q of QUESTIONS.filter((x) => x.level === 'kids')) {
    lines.add(q.prompt)
    for (const c of q.choices) lines.add(c.text)
    lines.add(q.explain)
  }
  for (const p of Object.values(PHRASES)) lines.add(p)
  // いしんでんしん：しつもんは みんなに聞こえてよいので読み上げる（答えは読まない）
  for (const q of I_QUESTIONS) lines.add(q.prompt)
  for (const m of ALL_MISSIONS) lines.add(m.text)
  for (const i of ITEMS) lines.add(i.label)
  for (const c of PARTY_COLORS) {
    lines.add(turnLine(c.name))
    lines.add(champLine(c.name))
  }
  for (const g of GAMES.filter((x) => x.party)) lines.add(nextGameLine(g.title))
  for (const t of TEAMS) lines.add(teamWinLine(t.name))
  return [...lines]
}
