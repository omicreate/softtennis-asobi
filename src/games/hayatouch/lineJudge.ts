/**
 * ラインジャッジのお題（純粋関数）。ラインの近くに落ちた球のあとを拡大して見せ、イン／アウトを答える。
 * 根拠：ソフトテニスハンドブック 2026 競技規則
 *   第36条2 ラインに触れたものはすべてイン（サービスのときは、サービスコートを囲むラインに触れればイン）
 *   第27条(1) サービスが正しいサービスコートに入らなかったらフォールト
 *   第26条 サービスは対角線上の相手方サービスコートへ（センターラインの反対側＝となりのサービスコートはフォールト）
 *   ラリー中は、サービスラインやセンターラインは関係なく、コートの中ならイン
 */

/** 線の幅（cm）。ラインは5cm以上6cm以内（第7条） */
export const LINE_W = 5
/** 球の半径（cm）。直径6.6cm（第15条） */
export const BALL_R = 3.3

export type LineKind = 'side' | 'base' | 'service-serve' | 'service-rally' | 'center-serve'

export interface LineCase {
  kind: LineKind
  /** 場面（サービス／ラリー）と線の名前 */
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

export type Region = 'court' | 'out' | 'service' | 'back' | 'target' | 'other-service'

export const REGION_NAME: Record<Region, string> = {
  court: 'コート',
  out: 'コートのそと',
  service: 'サービスコート',
  /** サービスラインより後ろ（ベースライン側） */
  back: 'サービスラインの おく',
  /** センターラインのサービス：入れるべき対角のサービスコートと、そのとなり */
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
  const kinds: LineKind[] = hard ? ['side', 'base', 'service-serve', 'service-serve', 'service-rally', 'center-serve'] : ['side', 'base', 'side', 'base', 'service-serve']
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
      return build('court', 'out', 'ラリー', 'サイドライン', 'in', 'out', 'ラインに すこしでも ふれたら イン', 'ラインに ふれていないので アウト', '第36条2')
    case 'base':
      return build('court', 'out', 'ラリー', 'ベースライン', 'in', 'out', 'ラインに すこしでも ふれたら イン', 'ラインに ふれていないので アウト', '第36条2')
    case 'service-serve':
      // サービス：サービスラインに触れればイン。サービスラインの奥に落ちたらフォールト
      return build('service', 'back', 'サービス', 'サービスライン', 'in', 'out', 'サービスラインに ふれたら イン', 'サービスラインを こえたので フォールト', '第27条(1)・第36条2')
    case 'service-rally':
      // ラリー中は、サービスラインの前でも奥でもコートの中ならイン
      return build('service', 'back', 'ラリー', 'サービスライン', 'in', 'in', 'ラリー中は サービスラインは かんけいない。イン', 'ラリー中は コートの なかなら どこでも イン', '第37条(2)・第36条')
    case 'center-serve':
      // 球は「となりの コート」の側から近づく。線に触れればイン、離れていれば となりの サービスコートなので フォールト
      return build('target', 'other-service', 'サービス', 'センターライン', 'in', 'out', 'センターラインも ねらう サービスコートの いちぶ。イン', 'となりの サービスコートに おちたので フォールト', '第26条・第27条(1)・第36条2')
  }
}
