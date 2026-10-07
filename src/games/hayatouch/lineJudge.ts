/**
 * ラインジャッジのお題（純粋関数）。ラインの近くに落ちた球のあとを拡大して見せ、イン／アウトを答える。
 * 根拠：USA Pickleball 公式ルールブック 2026
 *   PBK-0029 ラインに触れた球はイン（サービスコートは周りのラインを含む）
 *   PBK-0021 サーブがキッチンライン上に落ちたらフォルト。ラリー中の返球はキッチン（ライン含む）でもイン
 *   PBK-0010 サーブは対角のサービスコートへ（センターラインの反対側＝となりのサービスコートはフォルト）
 */

/** 線の幅（cm）。ラインは2インチ（約5cm） */
export const LINE_W = 5
/** 球の半径（cm）。直径は約7.4cm */
export const BALL_R = 3.7

export type LineKind = 'side' | 'base' | 'kitchen-serve' | 'kitchen-rally' | 'center-serve'

export interface LineCase {
  kind: LineKind
  /** 場面（サーブ／ラリー）と線の名前 */
  scene: string
  line: string
  /** 線の両側の名前：a＝線の左、b＝線の右（線そのものは x=0〜LINE_W） */
  a: Region
  b: Region
  /** 球の中心の位置（cm。線の左の縁が0） */
  center: number
  answer: 'in' | 'out'
  explain: string
  source: string
}

export type Region = 'court' | 'out' | 'kitchen' | 'service' | 'target' | 'other-service'

export const REGION_NAME: Record<Region, string> = {
  court: 'コート',
  out: 'コートのそと',
  kitchen: 'キッチン',
  service: 'サービスコート',
  /** センターラインのサーブ：入れるべき対角のサービスコートと、そのとなり */
  target: 'ねらうコート',
  'other-service': 'となりのコート',
}

/** 球が線に触れているか */
export const touchesLine = (center: number) => center + BALL_R >= 0 && center - BALL_R <= LINE_W

/**
 * お題を作る。hard＝せんしゅ（すきまや重なりが小さく、まぎらわしい場面も出る）
 * rand は 0〜1 を返す関数（テストでは決まった値を渡す）
 */
export function makeLineCase(hard: boolean, rand: () => number = Math.random): LineCase {
  const kinds: LineKind[] = hard ? ['side', 'base', 'kitchen-serve', 'kitchen-serve', 'kitchen-rally', 'center-serve'] : ['side', 'base', 'side', 'base', 'kitchen-serve']
  const kind = kinds[Math.floor(rand() * kinds.length)]
  // 線にどれだけ重なるか（＋）・離れているか（−）。cm
  const min = hard ? 0.5 : 1.2
  const max = hard ? 2.2 : 3.5
  const amount = min + rand() * (max - min)
  const touch = rand() < 0.5
  // 線のどちら側から近づくか（左右の見え方を変える）
  const flip = rand() < 0.5

  const build = (inner: Region, outer: Region, scene: string, line: string, answerIfTouch: 'in' | 'out', answerIfApart: 'in' | 'out', explainTouch: string, explainApart: string, source: string): LineCase => {
    // 球は outer 側（線の右）から近づく：触れる＝左の縁が線の右の縁より amount だけ内側
    let center = touch ? LINE_W + BALL_R - amount : LINE_W + BALL_R + amount
    let a = inner
    let b = outer
    if (flip) {
      center = LINE_W - center
      a = outer
      b = inner
    }
    return {
      kind,
      scene,
      line,
      a,
      b,
      center,
      answer: touch ? answerIfTouch : answerIfApart,
      explain: touch ? explainTouch : explainApart,
      source,
    }
  }

  switch (kind) {
    case 'side':
      return build('court', 'out', 'ラリー', 'サイドライン', 'in', 'out', 'ラインに すこしでも ふれたら イン', 'ラインに ふれていないので アウト', 'PBK-0029')
    case 'base':
      return build('court', 'out', 'ラリー', 'ベースライン', 'in', 'out', 'ラインに すこしでも ふれたら イン', 'ラインに ふれていないので アウト', 'PBK-0029')
    case 'kitchen-serve':
      return build('kitchen', 'service', 'サーブ', 'キッチンライン', 'out', 'in', 'サーブが キッチンラインに ふれたら フォルト', 'キッチンラインを こえているので イン', 'PBK-0021')
    case 'kitchen-rally':
      return build('kitchen', 'service', 'ラリー', 'キッチンライン', 'in', 'in', 'ラリー中は キッチン（ライン）に おちても イン', 'ラリー中は キッチンラインの まわりは どこでも イン', 'PBK-0021')
    case 'center-serve':
      // 球は「となりの コート」の側から近づく。線に触れればイン、離れていれば となりの サービスコートなので フォルト
      return build('target', 'other-service', 'サーブ', 'センターライン', 'in', 'out', 'センターラインも ねらう サービスコートの いちぶ。イン', 'となりの サービスコートに おちたので フォルト', 'PBK-0010・0029')
  }
}
