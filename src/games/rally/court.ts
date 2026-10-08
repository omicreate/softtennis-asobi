/**
 * コートの寸法（m）。ソフトテニスハンドブック 2026 競技規則。
 *   コート：縦 23.77m（第5条）。シングルスは横 8.23m（シングルス 第2条）、ダブルスは 10.97m（第5条）
 *   サービスライン：ネットから 6.40m（サービスサイドライン 12.80m・第6条）
 *   ネット：高さ 1.07m（第10条）
 * ラリーは1対1なので、判定はシングルスのコート。絵にはダブルスの横の帯（アレー）も描く。
 * 座標：x は横（0〜8.23、シングルスのコート）、y は縦（0〜23.77）。画面の上が y=0。
 * 下の人（Side 0）は y が大きい側、上の人（Side 1）は y が小さい側。
 */
import type { Side } from '../../core/players'

export const COURT = {
  W: 8.23,
  L: 23.77,
  NET_Y: 23.77 / 2,
  /** ネットからサービスラインまで */
  SERVICE: 6.4,
  NET_H: 1.07,
  /** ダブルスの横の帯（片側の幅）。絵だけに使う */
  ALLEY: (10.97 - 8.23) / 2,
} as const

/** ネットのある向き（下の人は y が小さくなる方、上の人は大きくなる方） */
export const toNet = (side: Side): 1 | -1 => (side === 0 ? -1 : 1)

/** その位置がどちらの陣地か */
export const sideOf = (y: number): Side => (y >= COURT.NET_Y ? 0 : 1)

/** 計算の誤差でライン上の球がアウトにならないための余裕 */
const EPS = 1e-6

/** コートの中か（ラインに触れたものはすべてイン。第36条2） */
export const inCourt = (x: number, y: number) => x >= -EPS && x <= COURT.W + EPS && y >= -EPS && y <= COURT.L + EPS

/**
 * サービスをする側（右か左か）。センターマークの右側から始め、1ポイントごとに右・左交互（第26条・シングルス 第4条）。
 * point：そのゲームで何ポイント目か（0から）。
 * 下の人は上を向いているので右＝x が大きい側。上の人は下を向いているので右＝x が小さい側。
 */
export function serveHalf(server: Side, point: number): 'high' | 'low' {
  const right = point % 2 === 0
  if (server === 0) return right ? 'high' : 'low'
  return right ? 'low' : 'high'
}

/** サービスが対角線上の相手のサービスコート（ラインを含む）に入ったか（第26条・第27条） */
export function inServiceCourt(server: Side, serverX: number, x: number, y: number): boolean {
  const receiver: Side = server === 0 ? 1 : 0
  if (sideOf(y) !== receiver || !inCourt(x, y)) return false
  if (Math.abs(y - COURT.NET_Y) > COURT.SERVICE + EPS) return false
  const mid = COURT.W / 2
  // 対角：サーバーが x の大きい側なら、相手コートの x の小さい側へ（サービスセンターラインはイン）
  return serverX >= mid ? x <= mid + EPS : x >= mid - EPS
}
