/**
 * 説明動画「インスタから開いた方へ：ホーム画面に入れる方法」の台本（縦 1080×1920）。
 * scripts/build-guide-video.mjs が読んで、ナレーション（ElevenLabs）と画面（#/dev/guide）を合わせて mp4 にする。
 * say は読み上げ用（カタカナで読みを固定）、title・sub は画面の文字。
 */
export interface GuideScene {
  id: 'intro' | 'inapp' | 'open' | 'ios' | 'android' | 'home' | 'copy' | 'outro'
  /** 画面の上の小さな札（ステップ1 など） */
  chip?: string
  title: string
  sub?: string
  say: string
  /** いちばん短い長さ（秒） */
  min: number
}

export const GUIDE_SCENES: GuideScene[] = [
  {
    id: 'intro',
    title: 'インスタから\nひらいた方へ',
    sub: '「ピクルくんとあそぼ」を\nホーム画面に入れる方法',
    say: 'インスタから ピクルくんとあそぼを ひらいた かたへ。ホーム画面に いれる ほうほうを しょうかいするね。',
    min: 4,
  },
  {
    id: 'inapp',
    title: 'インスタの中のブラウザでは\nホーム画面に入れられません',
    sub: '記録も ふだんのブラウザとは 別になります',
    say: 'インスタの リンクから ひらくと、インスタの なかの ブラウザで ひらきます。ここでは、ホーム画面に いれられません。',
    min: 4,
  },
  {
    id: 'open',
    chip: 'ステップ 1',
    title: '右上の「…」→\n「外部ブラウザで開く」',
    say: 'まず、みぎうえの メニューを タップして、がいぶブラウザで ひらく を えらんでね。',
    min: 5,
  },
  {
    id: 'ios',
    chip: 'ステップ 2　iPhone',
    title: 'Safari の 共有 →\n「ホーム画面に追加」→「追加」',
    sub: '共有ボタンが見つからないときは「…」の中',
    say: 'アイフォーンなら サファリで、きょうゆう ボタン、ホーム画面に ついか、さいごに ついか を タップ。',
    min: 6,
  },
  {
    id: 'android',
    chip: 'ステップ 2　Android',
    title: 'Chrome の「⋮」→\n「ホーム画面に追加」→「インストール」',
    sub: '「アプリをインストール」と出ることも',
    say: 'アンドロイドなら クロームの みぎうえの メニューから、ホーム画面に ついか、そして インストール を タップ。',
    min: 6,
  },
  {
    id: 'home',
    title: 'ホーム画面の ピクルくんから\nすぐ遊べる！',
    sub: '電波がなくても 遊べます',
    say: 'これで ホーム画面の ピクルくんから、いつでも すぐ あそべるよ。でんぱが なくても だいじょうぶ。',
    min: 4,
  },
  {
    id: 'copy',
    chip: 'うまくいかないときは',
    title: '「リンクをコピー」→\nSafari・Chrome に貼りつけ',
    say: 'うまく いかない ときは、リンクを コピーして、サファリや クロームの アドレスに はりつけてね。',
    min: 4,
  },
  {
    id: 'outro',
    title: 'ピクルくんとあそぼ',
    sub: 'omicreate.github.io/softtennis-asobi\n@pickleballiq_jp のプロフィールから',
    say: 'ピクルくんとあそぼ は、プロフィールの リンクから。いっしょに あそぼうね！',
    min: 4,
  },
]

/** ナレーションが始まるまでの間（秒）と、終わってから次の場面までの間（秒） */
export const LEAD_IN = 0.35
export const TAIL = 0.7
