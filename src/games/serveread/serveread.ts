/**
 * よみあい サーブ（ふたり）。React に依存しない純粋な計算。
 *
 * 1回のサーブの流れ：
 *   ① サーブ側が ねらう所を こっそり選ぶ（決まった時間、画面をひとりじめ。相手は目をとじて、話しかけて ゆさぶってよい）
 *   ② レシーブ側が まつ所を こっそり選ぶ
 *   ③ さいごの かけひき：サーブ側 → レシーブ側の順に「かえる？ そのまま？」（短い時間）
 *   ④ 発表：同じ所なら「よんだ！」でレシーブ側の点、ちがえば「サービスエース」でサーブ側の点
 * 点はねらった所で決まる：そと3点・まんなか2点・からだ1点（読んだら、その点をレシーブ側がうばう）。
 * 3回勝負：1回（ラウンド）で2人とも1回ずつサーブ。合計点の多い方の勝ち。同点ならサドンデス（もう1ラウンド）。
 * 一発逆転：さいごのラウンドは点が2倍。1人1回だけ「2ばい カード」を使える（その回に点をとれたら2倍。
 * とれなかったら、カードはむだになる）。
 * 点が入るのはサーブ側だけ（サイドアウト方式。PBK-0004）の本物のルールとはちがう、読み合いの遊び。
 */
import type { Side } from '../../core/players'

export type Spot = 'wide' | 'center' | 'body'
export const SPOTS: Spot[] = ['wide', 'center', 'body']
export const SPOT_LABEL: Record<Spot, string> = { wide: 'そと', center: 'まんなか', body: 'からだ' }
/** ねらった所の点（読まれなければサーブ側、読まれたらレシーブ側に入る） */
export const SPOT_POINTS: Record<Spot, number> = { wide: 3, center: 2, body: 1 }
export const ROUNDS = 3
/** さいごのラウンドの倍率 */
export const FINAL_MULT = 2
/** さいごの かけひき（かえる？そのまま？）の時間（秒） */
export const LAST_TIME = 8
/** 発表の長さ（秒） */
export const REVEAL_TIME = 4.6
export const PICK_TIMES = [15, 20, 30]

export type StepKind = 'first' | 'last'

export interface Step {
  side: Side
  kind: StepKind
}

export type SrPhase = 'intro' | 'pick' | 'reveal' | 'over'

export interface ServeResult {
  round: number
  server: Side
  receiver: Side
  serve: Spot
  wait: Spot
  read: boolean
  /** 点をとった人と点（倍率こみ） */
  gainer: Side
  points: number
  /** 2ばいカードを使った人（その回） */
  doubles: [boolean, boolean]
  final: boolean
  /** 時間ぎれで、かわりに選んだ */
  auto: [boolean, boolean]
}

export interface SrState {
  pickTime: number
  /** さいごの かけひき（かえる？ そのまま？）をするか。てわたしで遊ぶときは しない（手わたしが倍になるので） */
  lastChance: boolean
  phase: SrPhase
  /** ラウンド（1から。4以上はサドンデス）と、ラウンドの中で何回めのサーブか（0・1） */
  round: number
  serveNo: number
  server: Side
  /** いま選んでいる段どり */
  steps: Step[]
  stepIndex: number
  /** いまの場面の残り時間（秒） */
  left: number
  picks: [Spot | null, Spot | null]
  auto: [boolean, boolean]
  /** 2ばいカード：使ったか（試合で1回）・この回に使うと決めたか */
  doubleUsed: [boolean, boolean]
  doubleNow: [boolean, boolean]
  score: [number, number]
  results: ServeResult[]
  last: ServeResult | null
}

export type SrEvent =
  | { type: 'step'; step: Step; round: number; final: boolean }
  | { type: 'tick'; left: number }
  | { type: 'reveal'; result: ServeResult }
  | { type: 'over'; winner: Side }

const other = (s: Side): Side => (s === 0 ? 1 : 0)

/** そのラウンドで先にサーブする人（ラウンドごとに交代） */
export const firstServer = (round: number): Side => (round % 2 === 1 ? 0 : 1)

export const isFinal = (s: Pick<SrState, 'round'>) => s.round >= ROUNDS

function stepsFor(server: Side, lastChance = true): Step[] {
  const r = other(server)
  const first: Step[] = [
    { side: server, kind: 'first' },
    { side: r, kind: 'first' },
  ]
  return lastChance
    ? [
        ...first,
        { side: server, kind: 'last' },
        { side: r, kind: 'last' },
      ]
    : first
}

export function createSr(pickTime = 20, lastChance = true): SrState {
  return {
    pickTime,
    lastChance,
    phase: 'intro',
    round: 1,
    serveNo: 0,
    server: firstServer(1),
    steps: stepsFor(firstServer(1), lastChance),
    stepIndex: 0,
    left: 2.5,
    picks: [null, null],
    auto: [false, false],
    doubleUsed: [false, false],
    doubleNow: [false, false],
    score: [0, 0],
    results: [],
    last: null,
  }
}

export const currentStep = (s: SrState): Step | null => (s.phase === 'pick' ? s.steps[s.stepIndex] : null)

/** 選ぶ（いまの番の人だけ。何回でも選びなおせる） */
export function choose(s: SrState, side: Side, spot: Spot): boolean {
  const st = currentStep(s)
  if (!st || st.side !== side) return false
  s.picks[side] = spot
  s.auto[side] = false
  return true
}

/** 2ばいカード（いまの番の人だけ。試合で1回。発表までは取り消せる） */
export function toggleDouble(s: SrState, side: Side): boolean {
  const st = currentStep(s)
  if (!st || st.side !== side || s.doubleUsed[side]) return false
  s.doubleNow[side] = !s.doubleNow[side]
  return true
}

/** 「きめた！」：自分の番を早く終える（選んでいないときは終われない） */
export function finishStep(s: SrState, side: Side, ev: SrEvent[] = []): boolean {
  const st = currentStep(s)
  if (!st || st.side !== side || !s.picks[side]) return false
  nextStep(s, ev)
  return true
}

/** 点の計算 */
export function judge(s: SrState, rand: () => number = Math.random): ServeResult {
  const srv = s.server
  const rcv = other(srv)
  const auto: [boolean, boolean] = [s.auto[0], s.auto[1]]
  // 選ばなかった人は、かわりに選ぶ
  for (const sd of [srv, rcv]) {
    if (!s.picks[sd]) {
      s.picks[sd] = SPOTS[Math.floor(rand() * SPOTS.length)]
      auto[sd] = true
    }
  }
  const serve = s.picks[srv]!
  const wait = s.picks[rcv]!
  const read = serve === wait
  const gainer = read ? rcv : srv
  const final = isFinal(s)
  const points = SPOT_POINTS[serve] * (final ? FINAL_MULT : 1) * (s.doubleNow[gainer] ? 2 : 1)
  return { round: s.round, server: srv, receiver: rcv, serve, wait, read, gainer, points, doubles: [s.doubleNow[0], s.doubleNow[1]], final, auto }
}

function nextStep(s: SrState, ev: SrEvent[], rand: () => number = Math.random) {
  s.stepIndex += 1
  if (s.stepIndex < s.steps.length) {
    const st = s.steps[s.stepIndex]
    s.left = st.kind === 'first' ? s.pickTime : LAST_TIME
    ev.push({ type: 'step', step: st, round: s.round, final: isFinal(s) })
    return
  }
  // 発表
  const r = judge(s, rand)
  s.score[r.gainer] += r.points
  for (const sd of [0, 1] as Side[]) if (s.doubleNow[sd]) s.doubleUsed[sd] = true
  s.results.push(r)
  s.last = r
  s.phase = 'reveal'
  s.left = REVEAL_TIME
  ev.push({ type: 'reveal', result: r })
}

function startServe(s: SrState, ev: SrEvent[]) {
  s.picks = [null, null]
  s.auto = [false, false]
  s.doubleNow = [false, false]
  s.steps = stepsFor(s.server, s.lastChance)
  s.stepIndex = 0
  s.phase = 'pick'
  s.left = s.pickTime
  ev.push({ type: 'step', step: s.steps[0], round: s.round, final: isFinal(s) })
}

export function stepSr(s: SrState, dt: number, rand: () => number = Math.random): SrEvent[] {
  const ev: SrEvent[] = []
  if (s.phase === 'over') return ev
  const before = s.left
  s.left -= dt
  if (s.phase === 'intro') {
    if (s.left <= 0) startServe(s, ev)
    return ev
  }
  if (s.phase === 'pick') {
    // のこり5秒からは1秒ごとに知らせる
    const n = Math.ceil(s.left)
    if (n !== Math.ceil(before) && n <= 5 && n > 0) ev.push({ type: 'tick', left: n })
    if (s.left <= 0) nextStep(s, ev, rand)
    return ev
  }
  // reveal
  if (s.left <= 0) {
    if (s.serveNo === 0) {
      s.serveNo = 1
      s.server = other(firstServer(s.round))
      startServe(s, ev)
      return ev
    }
    // ラウンドおわり
    if (s.round >= ROUNDS && s.score[0] !== s.score[1]) {
      s.phase = 'over'
      ev.push({ type: 'over', winner: s.score[0] > s.score[1] ? 0 : 1 })
      return ev
    }
    s.round += 1
    s.serveNo = 0
    s.server = firstServer(s.round)
    startServe(s, ev)
  }
  return ev
}

/** 相手が選んでいるあいだの「ゆさぶり」のヒント（話しかけてよい） */
export const TAUNTS = [
  '「そとに うつって もう きめてるよ」と いってみよう',
  '「さっきと おなじ ところかもね」と いってみよう',
  'あいての かおを じーっと みてみよう',
  '「2ばい カード、つかっちゃおうかな」と いってみよう',
  '「まんなかが すきなんだよね」と はなしてみよう',
  'わざと むずかしい かおを してみよう',
  '「からだは ねらわないよ」と いってみよう',
  'あいての くせを おもいだそう',
  '「つぎで ぎゃくてん するからね」と いってみよう',
  'わらって、なにも いわないで みよう',
]
