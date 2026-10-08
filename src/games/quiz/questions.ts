/**
 * ホークアイ先生クイズの問題。
 * どの問題も、ソフトテニスハンドブック 2026 の条文を根拠にする（source に条番号を書く）。条文は写さず、自分のことばで書く。
 * kids：文字が読めなくても答えられるよう、絵（pic）と読み上げで出す。
 * player：大人・選手向け。ソフトテニスIQの「ルールドリル」の問題（stDrill.ts）から作る。
 *   difficulty 1〜3（おとなは2まで、せんしゅは3まで）。カテゴリで決める。
 */
import type { PicId } from './pics'
import { DRILL } from './stDrill'

export interface QChoice {
  id: string
  text: string
  pic?: PicId
}

export interface Question {
  id: string
  level: 'kids' | 'player'
  difficulty: 1 | 2 | 3
  prompt: string
  choices: QChoice[]
  answerId: string
  explain: string
  source: string
}

/** 選択肢：[文字, 絵] */
type C = [string, PicId?]
const c = (text: string, pic?: PicId): C => [text, pic]

const q = (id: string, level: Question['level'], difficulty: Question['difficulty'], prompt: string, choices: C[], explain: string, source: string): Question => ({
  id,
  level,
  difficulty,
  prompt,
  // 1つめの選択肢を正解として書く（出すときに並べかえる）
  choices: choices.map(([text, pic], i) => ({ id: `${id}-${i}`, text, ...(pic ? { pic } : {}) })),
  answerId: `${id}-0`,
  explain,
  source,
})

/** ルールドリルのカテゴリ → むずかしさ（1＝おとなから、3＝せんしゅだけ） */
const DIFFICULTY: Record<string, Question['difficulty']> = {
  スコア: 1,
  失ポイント: 1,
  'サービス/レシーブ': 1,
  コール: 2,
  'レット/ノーカウント': 2,
  試合進行: 2,
  '禁止事項/マナー': 3,
  'スコアシート・審判動作': 3,
  '2026年コイントス運用': 3,
  ヒートルール: 3,
}

export const QUESTIONS: Question[] = [
  // ---------- こども（絵と読み上げ） ----------
  q('K01', 'kids', 1, 'ソフトテニスの ボールは どれ？', [c('しろい ゴムの ボール', 'st-ball'), c('けの はえた ボール', 'tennis-ball'), c('サッカーボール', 'soccer-ball')], 'ソフトテニスの ボールは、くうきの はいった ゴムの ボールだよ', '競技規則 第15条'),
  q('K02', 'kids', 1, 'ボールを うつ どうぐは どれ？', [c('ラケット', 'racket'), c('いたの パドル', 'paddle'), c('バット', 'bat')], 'ガットを はった ラケットで うつよ', '競技規則 第16条'),
  q('K03', 'kids', 1, 'ボールが 2かい はねたら？', [c('しっぱい', 'mark-ng'), c('セーフ', 'mark-ok'), c('もういちど', 'mark-again')], '2かい はねる まえに かえそう（ツーバウンズ）', '競技規則 第37条(3)'),
  q('K04', 'kids', 1, 'ボールが ラインに ちょっと さわったら？', [c('イン（セーフ）', 'line-in'), c('アウト', 'line-out')], 'ラインに すこしでも さわったら イン', '競技規則 第36条2'),
  q('K05', 'kids', 1, 'ボールが ラインに さわらずに そとに おちたら？', [c('アウト', 'line-out'), c('イン（セーフ）', 'line-in')], 'ラインに さわって いなければ アウト', '競技規則 第37条(2)'),
  q('K06', 'kids', 1, 'コートの まんなかに あるのは？', [c('ネット', 'net'), c('かべ', 'wall'), c('いけ', 'pond')], 'まんなかに ネットが あるよ', '競技規則 第5条'),
  q('K07', 'kids', 1, 'うっている ときに、ネットに からだが さわったら？', [c('しっぱい', 'mark-ng'), c('セーフ', 'mark-ok'), c('あいての しっぱい', 'mark-other')], 'ネットに さわったら しっぱい（ネットタッチ）', '競技規則 第37条(5)'),
  q('K08', 'kids', 1, 'ボールが からだに あたったら？', [c('あたった ひとの しっぱい', 'mark-ng'), c('セーフ', 'mark-ok'), c('あいての しっぱい', 'mark-other')], 'からだに あたったら しっぱい（ボディタッチ）', '競技規則 第37条(4)'),
  q('K09', 'kids', 2, '1ゲームは なんてん とったら かち？', [c('4てん', 'num-4'), c('11てん', 'num-11'), c('100てん', 'num-100')], '4てん さきに とったら かち。3たい3は デュース', '競技規則 第20条'),
  q('K10', 'kids', 2, 'サービスで とんできた ボールは いつ うつ？', [c('1かい はねてから', 'bounce-1'), c('はねる まえに', 'bounce-0'), c('ころがってから', 'roll')], 'サービスは 1かい はねてから うつよ。はねる まえに さわると ダイレクト', '競技規則 第30条・第32条(2)'),
  q('K11', 'kids', 2, 'サービスは どこへ うつ？', [c('ななめ むこう', 'serve-diag'), c('まっすぐ むこう', 'serve-straight'), c('いちばん おく', 'serve-long')], 'サービスは ななめ むこうの サービスコートへ', '競技規則 第26条'),
  q('K12', 'kids', 2, 'サービスは なんかい うてる？', [c('2かい', 'num-2'), c('1かい', 'num-1'), c('3かい', 'num-3')], 'ファーストと セカンドの 2かい。2かい とも はいらないと ダブルフォールト', '競技規則 第27条2・第29条'),
  q('K13', 'kids', 2, 'サービスが ネットに あたって ただしく はいったら？', [c('やりなおし', 'mark-again'), c('そのまま つづける', 'mark-ok'), c('しっぱい', 'mark-ng')], 'ネットに あたって はいった サービスは レット。やりなおしだよ', '競技規則 第28条(2)'),
  q('K14', 'kids', 2, '3たい3に なったら、どうすれば かち？', [c('2てん さを つける', 'num-2'), c('さきに 4てんに する', 'num-4'), c('つぎの 1てんを とる', 'num-1')], '3たい3は デュース。2てん さが つくまで つづくよ', '競技規則 第20条'),
  q('K15', 'kids', 2, 'サービスが サービスラインに ちょっと さわったら？', [c('イン（セーフ）', 'line-in'), c('アウト', 'line-out')], 'ラインに さわったら イン', '競技規則 第36条2'),
  q('K16', 'kids', 2, 'ボールが ラケットに 2かい あたったら？', [c('しっぱい', 'mark-ng'), c('セーフ', 'mark-ok'), c('もういちど', 'mark-again')], 'ラケットに 2かい あたると しっぱい（ドリブル）', '競技規則 第37条(6)'),

  // ---------- おとな・せんしゅ（ルールドリルから） ----------
  ...DRILL.map((d) =>
    q(
      `P-${d.id}`,
      'player',
      DIFFICULTY[d.category] ?? 3,
      d.prompt,
      // 正解と、まぎらわしい誤答を2つ（ルールドリルは4択、早押しは3択）
      [c(d.answer), c(d.wrong[0]), c(d.wrong[1])],
      `${d.term}：${d.explain}`,
      d.ref,
    ),
  ),
]

/** そのレベルの人に出せる問題 */
export function poolFor(level: 'kids' | 'player', maxDifficulty: number): Question[] {
  return QUESTIONS.filter((x) => x.level === level && x.difficulty <= maxDifficulty)
}
