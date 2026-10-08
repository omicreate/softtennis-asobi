/**
 * いしんでんしん ダブルスの しつもん。答えに正解はなく、パートナーと同じものを選べたら「いしんでんしん」。
 * - e：絵で選ぶ（字が読めない子も遊べる。しつもんは読み上げる）
 * - nakayoshi：ふだんのこと・ソフトテニスの楽しみ方
 * - doubles：前衛と後衛の作戦。正解は決めない（ペアで決めておくことを話すきっかけにする）。
 *   まめちしきは、ルールブック（ソフトテニスハンドブック 2026）に書いてあることだけ、条番号つきで出す。作戦の「正解」は書かない
 */
import type { PicId } from '../quiz/pics'
import type { NisePicId } from '../nise/pics'

export type IDeck = 'e' | 'nakayoshi' | 'doubles'

export interface IChoice {
  text: string
  /** にせホークアイ先生の絵 */
  pic?: NisePicId
  /** クイズの絵 */
  qpic?: PicId
  /** 色（すきな いろ など） */
  swatch?: string
}

export interface IQuestion {
  id: string
  deck: IDeck
  prompt: string
  choices: IChoice[]
  /** まめちしき（ルールブックの条番号つき） */
  tip?: string
}

export const I_DECK_INFO: Record<IDeck, { label: string; hint: string }> = {
  e: { label: 'え', hint: 'じが よめなくても OK' },
  nakayoshi: { label: 'なかよし', hint: 'すきな もの・ふだんの こと' },
  doubles: { label: 'ダブルス さくせん', hint: '前衛と 後衛で はなそう' },
}
export const I_DECKS: IDeck[] = ['e', 'nakayoshi', 'doubles']

const t = (text: string): IChoice => ({ text })
const p = (text: string, pic: NisePicId): IChoice => ({ text, pic })
const q = (text: string, qpic: PicId): IChoice => ({ text, qpic })
const c = (text: string, swatch: string): IChoice => ({ text, swatch })

export const I_QUESTIONS: IQuestion[] = [
  // ---------- え ----------
  { id: 'e-fruit', deck: 'e', prompt: 'いま たべたい くだものは？', choices: [p('りんご', 'apple'), p('バナナ', 'banana'), p('いちご', 'strawberry'), p('すいか', 'watermelon')] },
  { id: 'e-ball', deck: 'e', prompt: 'すきな ボールは？', choices: [p('ソフトテニスの ボール', 'st-ball'), p('テニスボール', 'tennis-ball'), q('サッカーボール', 'soccer-ball')] },
  { id: 'e-pet', deck: 'e', prompt: 'いっしょに あそぶ なら？', choices: [p('いぬ', 'dog'), p('ねこ', 'cat')] },
  { id: 'e-sky', deck: 'e', prompt: 'ひると よる、どっちが すき？', choices: [p('ひる', 'sun'), p('よる', 'moon')] },
  { id: 'e-color', deck: 'e', prompt: 'すきな いろは？', choices: [c('オレンジ', '#ff8a3d'), c('あお', '#3d9be9'), c('みどり', '#4caf50'), c('ピンク', '#ff6fae')] },
  { id: 'e-tool', deck: 'e', prompt: 'つかって みたい どうぐは？', choices: [p('ラケット', 'racket'), p('パドル', 'paddle'), q('バット', 'bat')] },
  { id: 'e-court', deck: 'e', prompt: 'コートの どこで うちたい？', choices: [q('ネットの まえ', 'zone-front'), q('うしろ', 'zone-back')] },
  { id: 'e-red', deck: 'e', prompt: 'あかい もので すきなのは？', choices: [p('りんご', 'apple'), p('トマト', 'tomato'), p('いちご', 'strawberry'), p('さくらんぼ', 'cherry')] },
  { id: 'e-yellow', deck: 'e', prompt: 'きいろい もので すきなのは？', choices: [p('バナナ', 'banana'), p('メロン', 'melon'), p('ソフトテニスの ボール', 'st-ball')] },
  { id: 'e-summer', deck: 'e', prompt: 'なつに たべたい ものは？', choices: [p('すいか', 'watermelon'), p('メロン', 'melon'), p('きゅうり', 'cucumber'), p('トマト', 'tomato')] },

  // ---------- なかよし ----------
  { id: 'n-holiday', deck: 'nakayoshi', prompt: 'やすみの ひに したいのは？', choices: [t('ソフトテニス'), t('おでかけ'), t('ゲーム'), t('ゆっくり ねる')] },
  { id: 'n-breakfast', deck: 'nakayoshi', prompt: 'あさごはんは？', choices: [t('ごはん'), t('パン'), t('シリアル'), t('くだもの')] },
  { id: 'n-shot', deck: 'nakayoshi', prompt: 'すきな ショットは？', choices: [t('サービス'), t('ボレー'), t('スマッシュ'), t('ロブ')] },
  { id: 'n-position', deck: 'nakayoshi', prompt: 'やって みたい ポジションは？', choices: [t('前衛'), t('後衛'), t('どっちも')] },
  { id: 'n-pose', deck: 'nakayoshi', prompt: 'かったときの ポーズは？', choices: [t('ガッツポーズ'), t('ハイタッチ'), t('ジャンプ'), t('ピース')] },
  { id: 'n-before', deck: 'nakayoshi', prompt: 'しあいの まえに することは？', choices: [t('ストレッチ'), t('しんこきゅう'), t('ジャンプ'), t('みずを のむ')] },
  { id: 'n-drink', deck: 'nakayoshi', prompt: 'れんしゅうの あとに のみたいのは？', choices: [t('みず'), t('おちゃ'), t('スポーツドリンク'), t('ジュース')] },
  { id: 'n-season', deck: 'nakayoshi', prompt: 'なつと ふゆ、どっちが すき？', choices: [t('なつ'), t('ふゆ')] },
  { id: 'n-trip', deck: 'nakayoshi', prompt: 'いきたい ところは？', choices: [t('うみ'), t('やま'), t('ゆうえんち'), t('どうぶつえん')] },
  { id: 'n-hawk', deck: 'nakayoshi', prompt: 'ホークアイ先生の とくいわざは？', choices: [t('ボレー'), t('スマッシュ'), t('そらを とぶ'), t('おひるね')] },
  { id: 'n-dinner', deck: 'nakayoshi', prompt: 'ばんごはんに たべたいのは？', choices: [t('カレー'), t('おすし'), t('ハンバーグ'), t('ラーメン')] },
  { id: 'n-name', deck: 'nakayoshi', prompt: 'ふたりの ペアの なまえは？', choices: [t('チーム ホークアイ'), t('チーム ラケット'), t('チーム ボレー'), t('チーム ガット')] },
  { id: 'n-donmai', deck: 'nakayoshi', prompt: 'ミスした パートナーに かける ことばは？', choices: [t('ドンマイ！'), t('つぎ いこう！'), t('ナイストライ！'), t('だいじょうぶ！')] },
  { id: 'n-rain', deck: 'nakayoshi', prompt: 'あめで れんしゅうが なくなったら？', choices: [t('おうちで ゲーム'), t('えいが'), t('ほんを よむ'), t('おひるね')] },
  { id: 'n-color', deck: 'nakayoshi', prompt: 'ラケットの いろ なら？', choices: [t('オレンジ'), t('あお'), t('みどり'), t('ピンク')] },

  // ---------- ダブルス さくせん（正解は決めない） ----------
  { id: 'd-middle', deck: 'doubles', prompt: 'ふたりの まんなかに きた ボールは、だれが うつ？', choices: [t('前衛'), t('後衛'), t('さきに こえを かけた ほう')], tip: 'ボールは、どちらか1人が打つ決まり（第18条3）。だれが打つか、ペアで決めておこう。' },
  { id: 'd-lob', deck: 'doubles', prompt: '前衛の あたまの うえを ロブが こえたら？', choices: [t('後衛が おいかける'), t('前衛が もどって とる'), t('こえを かけて きめる')] },
  { id: 'd-sign', deck: 'doubles', prompt: 'ポイントの まえに、サインを きめる？', choices: [t('まいかい きめる'), t('ときどき きめる'), t('きめない')] },
  { id: 'd-poach', deck: 'doubles', prompt: '前衛が ポーチに でたら、後衛は？', choices: [t('あいた ところを カバー'), t('その ばで まつ'), t('ネットへ でる')] },
  { id: 'd-second', deck: 'doubles', prompt: 'セカンドサービスで だいじに するのは？', choices: [t('かならず いれる'), t('スピード'), t('コース')], tip: 'セカンドサービスも入らないと、ダブルフォールトで1ポイント（第29条）。' },
  { id: 'd-serve-order', deck: 'doubles', prompt: 'ゲームの さいしょに サービスを うつのは？', choices: [t('前衛'), t('後衛'), t('ジャンケンで きめる')], tip: 'ダブルスは2人が同じゲームの中で2ポイントずつ交代でサービスを打ち、ゲームの途中で順番は替えられない（第26条2）。' },
  { id: 'd-receive', deck: 'doubles', prompt: 'レシーブの とき、前衛は どこに たつ？', choices: [t('ネットの ちかく'), t('サービスラインの あたり'), t('うしろ')] },
  { id: 'd-between', deck: 'doubles', prompt: 'ポイントと ポイントの あいだに することは？', choices: [t('こえを かけあう'), t('つぎの さくせんを きめる'), t('しんこきゅう')] },
  { id: 'd-aim', deck: 'doubles', prompt: 'あいてが 雁行陣。どこを ねらいたい？', choices: [t('あいての 後衛'), t('あいての 前衛'), t('ふたりの あいだ')] },
  { id: 'd-pinch', deck: 'doubles', prompt: 'まけている ときは？', choices: [t('いつもどおり'), t('せめる'), t('ていねいに つなぐ')] },
  { id: 'd-receive-side', deck: 'doubles', prompt: 'レシーブは どっちの コートが すき？', choices: [t('みぎ（ライトサービスコート）'), t('ひだり（レフトサービスコート）')], tip: 'レシーバーは、右か左のどちらかのサービスコートでレシーブし、同じゲームの中では替えられない（第31条）。' },
]

export const questionsFor = (deck: IDeck): IQuestion[] => I_QUESTIONS.filter((x) => x.deck === deck)
