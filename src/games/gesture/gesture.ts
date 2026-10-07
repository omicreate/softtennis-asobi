/**
 * ジェスチャー ピックル（2〜6人。1台を手わたし）。React に依存しない純粋な計算とお題。
 * やる人だけが画面を見て、声を出さずに体でお題を表す。ほかの人が当てたら「あたり」、むずかしければ「パス」。
 * 1人ずつ順番に、決めた時間だけやる。みんなで当てた数を合わせて、じこベストをめざす（協力）。
 * ルールにかかわるお題は、終わったあとに「まめちしき」を出す。説明は知識カード（PBK）に書いてあることだけ。
 */

export type GDeck = 'kids' | 'pickle'

export interface GCard {
  id: string
  /** 当ててもらう ことば */
  say: string
  /** やる人へのヒント（どう まねするか） */
  act: string
  deck: GDeck
  /** まめちしき（根拠の PBK 番号つき） */
  tip?: string
}

export const G_DECK_INFO: Record<GDeck, { label: string; hint: string }> = {
  kids: { label: 'やさしい', hint: 'サーブ・スマッシュ など' },
  pickle: { label: 'ピックル つう', hint: 'ルールの うごきも でる' },
}
export const G_DECKS: GDeck[] = ['kids', 'pickle']

/** 1人がやる時間（秒） */
export const ACT_TIMES = [60, 90]
/** はじまる前の 3・2・1（秒） */
export const COUNTDOWN = 3

export const CARDS: GCard[] = [
  { id: 'serve', say: 'サーブ', act: 'したから ボールを うつ まね', deck: 'kids' },
  { id: 'dink', say: 'ディンク', act: 'ネットの まえで、そっと ポン', deck: 'kids', tip: 'キッチンラインから、相手のキッチンにそっと落とす球。クロスに打つのが基本（PBK-0050）。' },
  { id: 'smash', say: 'スマッシュ', act: 'うえから おもいきり うちおろす', deck: 'kids' },
  { id: 'lob', say: 'ロブ', act: 'たかーく うちあげて、そらを みあげる', deck: 'kids' },
  { id: 'hightouch', say: 'ハイタッチ', act: 'パートナーと「ナイス！」の まね', deck: 'kids' },
  { id: 'chase', say: 'ボールを おいかける', act: 'その ばで はしって、てを のばす', deck: 'kids' },
  { id: 'pikuru', say: 'ピクルくん', act: 'きゅうりの ピクルくんの まね', deck: 'kids' },
  { id: 'whiff', say: 'からぶり', act: 'おもいきり ふったのに あたらない', deck: 'kids', tip: '空振りしても、ボールは生きている。ラリーは続く（PBK-0042）。' },
  { id: 'netball', say: 'ネットに ひっかかった', act: 'ボールが ネットに ばさっ。がっかり', deck: 'kids' },
  { id: 'win', say: 'かちポーズ', act: 'やったー！ りょうてを あげる', deck: 'kids' },
  { id: 'sun', say: 'まぶしい', act: 'たいようで ボールが みえない', deck: 'kids' },
  { id: 'lift', say: 'リフティング', act: 'パドルで ボールを ポンポン', deck: 'kids' },
  { id: 'paddletap', say: 'パドルタップ', act: 'しあいの あと、パドルを あわせて あいさつ', deck: 'kids' },
  { id: 'kitchen-volley', say: 'キッチンで ボレー', act: 'キッチンに ふみこんで、はずむ まえに うつ。あっ！', deck: 'pickle', tip: 'キッチンの中でボレーするとフォルト。弾んだ球なら、キッチンの中で打ってよい（PBK-0014・0015）。' },
  { id: 'not-ready', say: 'まだ じゅんびが できてない', act: 'パドルを あたまの うえに あげる', deck: 'pickle', tip: 'スコアのコールが始まる前なら、パドルか手を頭の上に上げると「まだ準備できていない」の合図（PBK-0031）。' },
  { id: 'drop-serve', say: 'ドロップサーブ', act: 'ボールを おとして、はずませてから うつ', deck: 'pickle', tip: '落として弾ませてから打つ。振り方の制限はない（PBK-0009）。' },
  { id: 'volley-serve', say: 'ボレーサーブ', act: 'てから はなして、したから うえへ ふる', deck: 'pickle', tip: '手から離して直接打つ。パドルが上向きの弧で動き、ボールが腰より高くない所で打つ（PBK-0008）。' },
  { id: 'return-run', say: 'リターン ダッシュ', act: 'かえしたら、まえへ ダッシュ', deck: 'pickle', tip: 'リターンしたら、すぐキッチンラインへ出ると有利（PBK-0019）。' },
  { id: 'body-hit', say: 'からだに あたった', act: 'ボールが からだに あたって「いたっ」', deck: 'pickle', tip: 'ボールが体に当たったら、当たった人のフォルト。パドルと、それを握る手の手首より下は打球として扱う（PBK-0025）。' },
  { id: 'net-touch', say: 'ネットに さわった', act: 'うった あと、ネットに てが ふれる', deck: 'pickle', tip: 'ボールが生きている間に、体や身につけた物がネットに触れたらフォルト（PBK-0027）。' },
  { id: 'atp', say: 'ポストの そとを まわす', act: 'ネットの よこから、まわりこむ ショット', deck: 'pickle', tip: '返球は、ネットポストの外側を回して入れてもよい（PBK-0026）。' },
  { id: 'move-together', say: 'パートナーと いっしょに うごく', act: 'ふたりで よこに スライド', deck: 'pickle', tip: '2人は1.8〜2.4mほどの間隔を保ち、片方が動けばもう片方も同じ方向へ動く（PBK-0053）。' },
  { id: 'score-call', say: 'スコアコール', act: 'ゆびで 3つの かずを みせてから サーブ', deck: 'pickle', tip: 'ダブルスのスコアは3つの数字。各ゲームは「0-0-2」で始まる（PBK-0006）。言い終えてから10秒以内に打つ（PBK-0032）。' },
  { id: 'third-drop', say: '3きゅうめ ドロップ', act: 'うしろから そっと、あいての キッチンへ', deck: 'pickle', tip: '低く深いリターンには、3球目をドロップにして時間を作り、前へ出る（PBK-0048）。' },
  { id: 'drive', say: 'ドライブ', act: 'つよく まっすぐ うつ', deck: 'pickle' },
  { id: 'line-call', say: 'ラインジャッジ', act: 'ボールを じっと みて、ゆびで イン！', deck: 'pickle', tip: '自分の側のラインは自分たちで判定する。迷ったらイン（PBK-0041）。' },
  { id: 'middle', say: 'まんなかを ねらう', act: 'ふたりの あいだを ねらって うつ', deck: 'pickle', tip: '迷ったら真ん中。相手2人に「どっちが取る？」を迫れる（PBK-0052）。' },
]

/** その山で出るお題（ピックル つうは、やさしいお題もまぜる） */
export const cardsFor = (deck: GDeck): GCard[] => (deck === 'kids' ? CARDS.filter((c) => c.deck === 'kids') : CARDS)

/** まだ出していないお題から1つ。出し切ったら最初から */
export function drawCard(deck: GDeck, used: Set<string>, rand: () => number = Math.random): GCard {
  const pool = cardsFor(deck)
  let fresh = pool.filter((c) => !used.has(c.id))
  if (fresh.length === 0) {
    for (const c of pool) used.delete(c.id)
    fresh = pool
  }
  const c = fresh[Math.floor(rand() * fresh.length)]
  used.add(c.id)
  return c
}

export interface TurnLog {
  card: GCard
  got: boolean
}

export const turnScore = (log: TurnLog[]): number => log.filter((x) => x.got).length

/** みんなの合計（協力） */
export const teamTotal = (logs: TurnLog[][]): number => logs.reduce((n, l) => n + turnScore(l), 0)

/** いちばん多く伝えた人（同じ数なら全員）。だれも当たっていなければ空 */
export function bestActors(logs: TurnLog[][]): number[] {
  const scores = logs.map(turnScore)
  const top = Math.max(0, ...scores)
  return top === 0 ? [] : scores.flatMap((s, i) => (s === top ? [i] : []))
}
