/**
 * いしんでんしん ダブルスの しつもん。答えに正解はなく、パートナーと同じものを選べたら「いしんでんしん」。
 * - e：絵で選ぶ（字が読めない子も遊べる。しつもんは読み上げる）
 * - nakayoshi：ふだんのこと・ピックルボールの楽しみ方
 * - doubles：ダブルスの作戦。答えあわせで「まめちしき」を出す。説明は知識カード（PBK）に書いてあることだけ
 *   （真ん中の球をだれが取るか、は出典が1件だけのカード（PBK-0056・C）なので、まめちしきは出さない）
 */
import type { PicId } from '../quiz/pics'
import type { NisePicId } from '../nise/pics'

export type IDeck = 'e' | 'nakayoshi' | 'doubles'

export interface IChoice {
  text: string
  /** にせピクルくんの絵 */
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
  /** まめちしき（根拠の PBK 番号つき） */
  tip?: string
}

export const I_DECK_INFO: Record<IDeck, { label: string; hint: string }> = {
  e: { label: 'え', hint: 'じが よめなくても OK' },
  nakayoshi: { label: 'なかよし', hint: 'すきな もの・ふだんの こと' },
  doubles: { label: 'ダブルス さくせん', hint: 'まめちしき つき' },
}
export const I_DECKS: IDeck[] = ['e', 'nakayoshi', 'doubles']

const t = (text: string): IChoice => ({ text })
const p = (text: string, pic: NisePicId): IChoice => ({ text, pic })
const q = (text: string, qpic: PicId): IChoice => ({ text, qpic })
const c = (text: string, swatch: string): IChoice => ({ text, swatch })

export const I_QUESTIONS: IQuestion[] = [
  // ---------- え ----------
  { id: 'e-fruit', deck: 'e', prompt: 'いま たべたい くだものは？', choices: [p('りんご', 'apple'), p('バナナ', 'banana'), p('いちご', 'strawberry'), p('すいか', 'watermelon')] },
  { id: 'e-pikuru', deck: 'e', prompt: 'ピクルくんが すきそうな たべものは？', choices: [p('きゅうり', 'cucumber'), p('トマト', 'tomato'), p('メロン', 'melon'), p('さくらんぼ', 'cherry')] },
  { id: 'e-ball', deck: 'e', prompt: 'すきな ボールは？', choices: [p('ピックルボール', 'pb-ball'), p('テニスボール', 'tennis-ball'), q('サッカーボール', 'soccer-ball')] },
  { id: 'e-pet', deck: 'e', prompt: 'いっしょに あそぶ なら？', choices: [p('いぬ', 'dog'), p('ねこ', 'cat')] },
  { id: 'e-sky', deck: 'e', prompt: 'ひると よる、どっちが すき？', choices: [p('ひる', 'sun'), p('よる', 'moon')] },
  { id: 'e-color', deck: 'e', prompt: 'すきな いろは？', choices: [c('オレンジ', '#ff8a3d'), c('あお', '#3d9be9'), c('みどり', '#4caf50'), c('ピンク', '#ff6fae')] },
  { id: 'e-tool', deck: 'e', prompt: 'つかって みたい どうぐは？', choices: [p('パドル', 'paddle'), p('ラケット', 'racket'), q('バット', 'bat')] },
  { id: 'e-court', deck: 'e', prompt: 'コートの どこで うちたい？', choices: [q('ネットの まえ', 'zone-kitchen'), q('まんなか', 'zone-middle'), q('うしろ', 'zone-back')] },
  { id: 'e-red', deck: 'e', prompt: 'あかい もので すきなのは？', choices: [p('りんご', 'apple'), p('トマト', 'tomato'), p('いちご', 'strawberry'), p('さくらんぼ', 'cherry')] },
  { id: 'e-summer', deck: 'e', prompt: 'なつに たべたい ものは？', choices: [p('すいか', 'watermelon'), p('メロン', 'melon'), p('きゅうり', 'cucumber'), p('トマト', 'tomato')] },

  // ---------- なかよし ----------
  { id: 'n-holiday', deck: 'nakayoshi', prompt: 'やすみの ひに したいのは？', choices: [t('ピックルボール'), t('おでかけ'), t('ゲーム'), t('ゆっくり ねる')] },
  { id: 'n-breakfast', deck: 'nakayoshi', prompt: 'あさごはんは？', choices: [t('ごはん'), t('パン'), t('シリアル'), t('くだもの')] },
  { id: 'n-shot', deck: 'nakayoshi', prompt: 'すきな ショットは？', choices: [t('サーブ'), t('ディンク'), t('スマッシュ'), t('ロブ')] },
  { id: 'n-pose', deck: 'nakayoshi', prompt: 'かったときの ポーズは？', choices: [t('ガッツポーズ'), t('ハイタッチ'), t('ジャンプ'), t('ピース')] },
  { id: 'n-before', deck: 'nakayoshi', prompt: 'しあいの まえに することは？', choices: [t('ストレッチ'), t('しんこきゅう'), t('ジャンプ'), t('みずを のむ')] },
  { id: 'n-drink', deck: 'nakayoshi', prompt: 'ピックルボールの あとに のみたいのは？', choices: [t('みず'), t('おちゃ'), t('スポーツドリンク'), t('ジュース')] },
  { id: 'n-season', deck: 'nakayoshi', prompt: 'なつと ふゆ、どっちが すき？', choices: [t('なつ'), t('ふゆ')] },
  { id: 'n-trip', deck: 'nakayoshi', prompt: 'いきたい ところは？', choices: [t('うみ'), t('やま'), t('ゆうえんち'), t('どうぶつえん')] },
  { id: 'n-pikuru', deck: 'nakayoshi', prompt: 'ピクルくんの とくいわざは？', choices: [t('ディンク'), t('スマッシュ'), t('ダンス'), t('おひるね')] },
  { id: 'n-dinner', deck: 'nakayoshi', prompt: 'ばんごはんに たべたいのは？', choices: [t('カレー'), t('おすし'), t('ハンバーグ'), t('ラーメン')] },
  { id: 'n-name', deck: 'nakayoshi', prompt: 'ふたりの チームの なまえは？', choices: [t('チーム ピクルス'), t('チーム パドル'), t('チーム ディンク'), t('チーム キッチン')] },
  { id: 'n-donmai', deck: 'nakayoshi', prompt: 'ミスした パートナーに かける ことばは？', choices: [t('ドンマイ！'), t('つぎ いこう！'), t('ナイストライ！'), t('だいじょうぶ！')] },
  { id: 'n-rain', deck: 'nakayoshi', prompt: 'あめの ひに したいのは？', choices: [t('おうちで ゲーム'), t('えいが'), t('ほんを よむ'), t('おひるね')] },
  { id: 'n-color', deck: 'nakayoshi', prompt: 'パドルの いろ なら？', choices: [t('オレンジ'), t('あお'), t('みどり'), t('ピンク')] },

  // ---------- ダブルス さくせん ----------
  { id: 'd-aim', deck: 'doubles', prompt: 'まよったら、どこを ねらう？', choices: [t('ふたりの まんなか'), t('サイドライン ぎりぎり'), t('あいての あたまの うえ')], tip: '迷ったら真ん中。角度を与えず、相手2人に「どっちが取る？」を迫れる（PBK-0052）。' },
  { id: 'd-return', deck: 'doubles', prompt: 'リターンを うったら？', choices: [t('キッチンラインへ でる'), t('ベースラインに のこる'), t('まんなかで とまる')], tip: 'リターンしたら、すぐキッチンラインへ出ると有利（PBK-0019）。サーブ側は3球目を弾ませるために後ろに残るから。' },
  { id: 'd-serve', deck: 'doubles', prompt: 'サーブを うったら？', choices: [t('ベースラインの ちかくで まつ'), t('すぐ ネットへ でる'), t('よこに うごく')], tip: 'サーブ側は、リターンを1回弾ませる必要があるので、ベースライン付近で待ち、3球目の後に前へ出る（PBK-0047）。' },
  { id: 'd-move', deck: 'doubles', prompt: 'パートナーが よこに うごいたら？', choices: [t('おなじ ほうへ うごく'), t('その ばに のこる'), t('はんたいへ うごく')], tip: '2人は1.8〜2.4mほどの間隔を保ち、片方が動けばもう片方も同じ方向へ動いて、すき間を作らない（PBK-0053）。' },
  { id: 'd-dink', deck: 'doubles', prompt: 'ディンクは どこへ うつ？', choices: [t('クロス（ななめ）'), t('ストレート（まっすぐ）'), t('まんなか')], tip: 'ディンクはクロスが基本。ネットの低い所を通り、距離も長いので安全。ストレートや真ん中を混ぜるのも有効（PBK-0050）。' },
  { id: 'd-third', deck: 'doubles', prompt: '3きゅうめ。ひくくて ふかい リターンが きたら？', choices: [t('ドロップ'), t('ドライブ'), t('ロブ')], tip: '低く深いリターンにはドロップで時間を作って前へ。浅く高く弾んだリターンはドライブで攻める（PBK-0048）。' },
  { id: 'd-pop', deck: 'doubles', prompt: 'ディンクの うちあいで、うかんだ ボールが きたら？', choices: [t('せめる'), t('ディンクで つなぐ'), t('ロブで かえす')], tip: 'ディンクは低く我慢して続け、相手が攻撃できる高さに浮かせたら攻める（PBK-0051）。' },
  { id: 'd-servekey', deck: 'doubles', prompt: 'サーブで だいじなのは？', choices: [t('ふかさと たしかさ'), t('つよさ'), t('スピン')], tip: 'サーブは強さより、確実に深く入れるのが基本。外したサーブは、相手の得点ではなくサーブ権を失う（PBK-0046・0018）。' },
  { id: 'd-transition', deck: 'doubles', prompt: 'ベースラインと キッチンラインの あいだでは？', choices: [t('とまらず とおりぬける'), t('とまって まつ'), t('うしろへ さがる')], tip: 'ベースラインとキッチンラインの間は足元を狙われやすい。止まらず通り抜ける（PBK-0055）。' },
  { id: 'd-partner', deck: 'doubles', prompt: 'レシーブの とき、パートナーは どこに たつ？', choices: [t('キッチンライン'), t('ベースライン'), t('ふたりの まんなか')], tip: 'レシーバーはベースラインの少し後ろ、パートナーは最初からキッチンラインに立つ（PBK-0054）。' },
  { id: 'd-middle', deck: 'doubles', prompt: 'まんなかに きた ボールは だれが とる？', choices: [t('フォアハンドが まんなかの ひと'), t('バックハンドが まんなかの ひと'), t('さきに こえを かけた ひと')] },
  { id: 'd-line', deck: 'doubles', prompt: 'じぶんの がわの ラインぎわ。インか アウトか まよったら？', choices: [t('イン'), t('アウト'), t('やりなおし')], tip: '自分の側のラインは自分たちで判定する。すぐにアウトと言えない球はイン（PBK-0041）。' },
]

export const questionsFor = (deck: IDeck): IQuestion[] => I_QUESTIONS.filter((x) => x.deck === deck)
