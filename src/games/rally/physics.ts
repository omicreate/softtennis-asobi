/**
 * 球の動き（上から見たコート＋高さ z の 2.5D）。React に依存しない純粋な計算だけを置く。
 * 打つ瞬間に「どこに落とすか」と「何秒で飛ぶか」を決めて、そこから速度を逆算する。
 */
import type { Side } from '../../core/players'
import { COURT, inServiceCourt, toNet } from './court'

/** ゲーム用の重力（実物より弱くして、球をゆっくり見せる） */
export const G = 7
/** 打点の高さ */
export const HIT_Z = 0.8
/** 跳ねたときの上下の戻り・前への減速 */
const BOUNCE_UP = 0.7
const BOUNCE_FWD = 0.85
/** 前へ進む速さの下限（m/s） */
const MIN_FORWARD = 3.6

/** ネット側へ打つ深さ（ネットからの距離 m）：ゆっくり当てる＝ネット前、速く振る＝奥 */
export const DEPTH_SOFT = 2.6
/** ベースライン付近から止めて当てたときの深さ */
export const DEPTH_BLOCK = 7.2
export const DEPTH_DEEP = 10.6
/** 強すぎるとここまで飛ぶ（ベースラインはネットから 11.885m） */
export const DEPTH_OVER = 13.8
/** サービスの深さ（ネットからの距離 m）。サービスラインはネットから 6.40m */
const SERVE_SHORT = 3.2
const SERVE_LONG = 7.4

export interface Ball {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** 最後に打ってから跳ねた回数 */
  bounces: number
  /** 時間の進み方（受ける人のレベルで遅くする） */
  timeScale: number
}

export interface Vec {
  x: number
  y: number
}

export interface ShotOptions {
  /** 外に出ないように落とす場所を寄せる（小さい子） */
  keepIn: boolean
  /** サービス：対角のサービスコートへ向ける */
  serve?: boolean
}

export interface Shot {
  target: Vec
  /** 飛ぶ時間（timeScale=1 のとき） */
  T: number
  /** 0〜1.4 の強さ（1を超えると外に出うる） */
  power: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * パドルの速さから、強さを決める。
 * vNet：ネットの方向へ動いた速さ（m/s）。止めて当てる＝0、速く振る＝大。
 */
export function powerFromSwing(vNet: number): number {
  const p = Math.max(0, vNet) / 14
  return clamp(p, 0, 1.4)
}

/**
 * どこに落とすかを決める。
 * offset：ラケットのどこに当たったか（-1〜1。端に当たるほど角度がつく）
 * swingX：ラケットの横の速さ（m/s。横に振ると球もそちらへ）
 */
export function planShot(from: Vec, hitter: Side, power: number, offset: number, swingX: number, opts: ShotOptions): Shot {
  const dir = toNet(hitter)
  let p = opts.keepIn ? Math.min(power, 1) : power
  // 止めて当てたときの深さ：ネットの近くなら短く、後ろからなら中くらいまで返る
  const back = clamp((Math.abs(from.y - COURT.NET_Y) - 2) / (COURT.NET_Y - 2), 0, 1)
  const base = DEPTH_SOFT + (DEPTH_BLOCK - DEPTH_SOFT) * back
  let depth = p <= 1 ? base + (DEPTH_DEEP - base) * p : DEPTH_DEEP + (DEPTH_OVER - DEPTH_DEEP) * ((p - 1) / 0.4)

  let tx: number
  if (opts.serve) {
    // サービスは対角へ。強く振るほど深い（サービスラインをこえるとフォールト）
    depth = SERVE_SHORT + (SERVE_LONG - SERVE_SHORT) * Math.min(power, 1.4) / 1.4
    tx = COURT.W - from.x + offset * 1.0 + swingX * 0.12
    if (opts.keepIn) depth = clamp(depth, SERVE_SHORT, COURT.SERVICE - 0.6)
  } else {
    tx = from.x + offset * 3.0 + swingX * 0.3
  }

  if (opts.keepIn) {
    depth = Math.min(depth, COURT.NET_Y - 0.4)
    tx = clamp(tx, 0.45, COURT.W - 0.45)
    if (opts.serve) {
      // 対角のサービスコートの中に収める
      const mid = COURT.W / 2
      tx = from.x >= mid ? clamp(tx, 0.45, mid - 0.35) : clamp(tx, mid + 0.35, COURT.W - 0.45)
    }
  } else {
    tx = clamp(tx, -1.8, COURT.W + 1.8)
  }

  const ty = COURT.NET_Y + dir * depth
  // 強いほど速く、低く飛ぶ
  p = Math.min(p, 1)
  let T = 1.9 - 0.95 * p
  if (opts.serve) T += 0.15
  return { target: { x: tx, y: ty }, T, power }
}

/** 打点から落下点まで T 秒で届く速度を決める。ネットにかからないよう、必要なら山なりにする */
export function launch(ball: Ball, target: Vec, T: number, timeScale: number): void {
  // 前へ進む速さに下限をつける（ネット際から打った球が、跳ねたあと相手に届かず止まらないように）
  let t = Math.min(T, Math.max(0.45, Math.abs(target.y - ball.y) / MIN_FORWARD))
  for (let i = 0; i < 12; i++) {
    const vy = (target.y - ball.y) / t
    const vz = (G * t) / 2 - ball.z / t
    const tn = (COURT.NET_Y - ball.y) / vy
    const zn = ball.z + vz * tn - (G * tn * tn) / 2
    if (!(tn > 0 && tn < t) || zn >= COURT.NET_H + 0.2) break
    t *= 1.12
  }
  ball.vx = (target.x - ball.x) / t
  ball.vy = (target.y - ball.y) / t
  ball.vz = (G * t) / 2 - ball.z / t
  ball.bounces = 0
  ball.timeScale = timeScale
}

/** 1歩すすめる。跳ねたらその位置を返す */
export function stepBall(ball: Ball, dt: number): Vec | null {
  const d = dt * ball.timeScale
  const z0 = ball.z
  const vz0 = ball.vz
  const zEnd = z0 + vz0 * d - (G * d * d) / 2
  if (zEnd > 0) {
    ball.x += ball.vx * d
    ball.y += ball.vy * d
    ball.z = zEnd
    ball.vz = vz0 - G * d
    return null
  }
  // この区切りの中で地面に着く：着いた瞬間の位置で跳ねる（ライン際の判定を正確にするため）
  const tau = Math.min(d, Math.max(0, (vz0 + Math.sqrt(vz0 * vz0 + 2 * G * Math.max(0, z0))) / G))
  ball.x += ball.vx * tau
  ball.y += ball.vy * tau
  const at = { x: ball.x, y: ball.y }
  const vLand = vz0 - G * tau
  ball.z = 0
  ball.vz = -vLand * BOUNCE_UP
  ball.vx *= BOUNCE_FWD
  ball.vy *= BOUNCE_FWD
  ball.bounces += 1
  // 残りの時間を進める
  const rest = d - tau
  ball.x += ball.vx * rest
  ball.y += ball.vy * rest
  ball.z = Math.max(0, ball.vz * rest - (G * rest * rest) / 2)
  ball.vz -= G * rest
  return at
}

/** 次に地面に落ちる場所（落下点の目印に使う） */
export function predictLanding(ball: Ball): Vec {
  // z(t) = z + vz t - G t²/2 = 0 の正の解
  const t = (ball.vz + Math.sqrt(ball.vz * ball.vz + 2 * G * Math.max(0, ball.z))) / G
  return { x: ball.x + ball.vx * t, y: ball.y + ball.vy * t }
}

/** ラケット（土台の名残で型の名前は Paddle） */
export interface Paddle {
  x: number
  y: number
  vx: number
  vy: number
  width: number
}

/** 打てる高さ（上から見る絵なので、ほぼ全部届く） */
export const REACH_Z = 2.6

/**
 * ラケットに当たったか。前のフレームと今のフレームの間に、球がラケットの線を横切ったかで見る
 * （速い球でもすり抜けないように）。当たったらラケットのどこに当たったか（-1〜1）を返す。
 */
export function contact(prev: Vec, ball: Ball, prevPaddle: Vec, paddle: Paddle, side: Side, depthTol: number): number | null {
  if (ball.z > REACH_Z) return null
  // 自分の陣地にある球だけ打てる（ネットを越えて打つのは反則。第37条）
  if (side === 0 ? ball.y < COURT.NET_Y - 0.05 : ball.y > COURT.NET_Y + 0.05) return null
  const s = toNet(side)
  const rel0 = (prev.y - prevPaddle.y) * s
  const rel1 = (ball.y - paddle.y) * s
  if (Math.min(rel0, rel1) > depthTol || Math.max(rel0, rel1) < -depthTol) return null
  const half = paddle.width / 2 + 0.12
  const dx = ball.x - paddle.x
  if (Math.abs(dx) > half) return null
  return clamp(dx / (paddle.width / 2), -1, 1)
}

/** 小さい子の手助け：球が来る位置へラケットを寄せる量（m） */
export function assistShift(ball: Ball, paddle: Vec, side: Side, strength: number): number {
  if (strength <= 0) return 0
  // 自分へ向かっていない球には寄せない
  const coming = side === 0 ? ball.vy > 0 : ball.vy < 0
  if (!coming) return 0
  const t = (paddle.y - ball.y) / ball.vy
  if (t <= 0 || t > 2.6) return 0
  const xPred = ball.x + ball.vx * t
  const near = 1 - t / 2.6
  return (xPred - paddle.x) * strength * near
}

/** サービスが正しいサービスコートに入るか（テスト・表示用） */
export function serveLandsIn(server: Side, serverX: number, target: Vec): boolean {
  return inServiceCourt(server, serverX, target.x, target.y)
}
