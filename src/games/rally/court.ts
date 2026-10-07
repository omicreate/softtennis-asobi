/**
 * コートの寸法（m）。USA Pickleball 公式ルールブック 2026（PBK-0001・0002・0003）。
 * 座標：x は横（0〜6.10）、y は縦（0〜13.41）。画面の上が y=0。
 * 下の人（Side 0）は y が大きい側、上の人（Side 1）は y が小さい側。
 */
import type { Side } from '../../core/players'

export const COURT = {
  W: 6.1,
  L: 13.41,
  NET_Y: 13.41 / 2,
  KITCHEN: 2.13,
  NET_H: 0.91,
} as const

/** ネットのある向き（下の人は y が小さくなる方、上の人は大きくなる方） */
export const toNet = (side: Side): 1 | -1 => (side === 0 ? -1 : 1)

/** その位置がどちらの陣地か */
export const sideOf = (y: number): Side => (y >= COURT.NET_Y ? 0 : 1)

/** 計算の誤差でライン上の球がアウトにならないための余裕 */
const EPS = 1e-6

/** コートの中か（ラインに触れた球はイン。PBK-0029） */
export const inCourt = (x: number, y: number) => x >= -EPS && x <= COURT.W + EPS && y >= -EPS && y <= COURT.L + EPS

/** キッチンの中か（キッチンを囲むラインもキッチン。PBK-0002） */
export const inKitchen = (y: number) => Math.abs(y - COURT.NET_Y) <= COURT.KITCHEN + EPS

/**
 * サーブを打つ側（右か左か）。シングルスはサーバーの点が0か偶数なら右、奇数なら左（PBK-0036）。
 * 下の人は上を向いているので右＝x が大きい側。上の人は下を向いているので右＝x が小さい側。
 */
export function serveHalf(server: Side, serverScore: number): 'high' | 'low' {
  const right = serverScore % 2 === 0
  if (server === 0) return right ? 'high' : 'low'
  return right ? 'low' : 'high'
}

/** サーブが入るべき対角のサービスコート（ラインを含む）に入ったか */
export function inServiceCourt(server: Side, serverX: number, x: number, y: number): boolean {
  const receiver: Side = server === 0 ? 1 : 0
  if (sideOf(y) !== receiver || !inCourt(x, y) || inKitchen(y)) return false
  const mid = COURT.W / 2
  // 対角：サーバーが x の大きい側なら、相手コートの x の小さい側へ
  return serverX >= mid ? x <= mid : x >= mid
}
