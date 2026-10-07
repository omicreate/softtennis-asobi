/**
 * ねらってショット（ひとりで）の的。打った球が最初に跳ねた場所が的の中ならせいかい。
 * 的はいつも上の陣地（ボールマシンの側）。下の人から見て右＝x が大きい側。
 * レベルで中身が変わる：
 *   ちびっこ … むこうのコートに入れる
 *   キッズ   … 右／左に打ち分ける
 *   おとな   … ディンク（キッチン）と、深く（ベースラインから2m以内）を交互に
 *   せんしゅ … 3球目ドロップ（深い球を1回弾ませてからキッチンへ。2バウンドルール）と、コーナー
 */
import type { Level } from '../../core/players'
import { COURT } from './court'

export interface Zone {
  x0: number
  x1: number
  y0: number
  y1: number
  /** 画面の上に出す、ねらう場所の名前 */
  label: string
  /** 3球目ドロップ：跳ねる前に打つと2バウンドルール違反（PBK-0012） */
  thirdShot?: boolean
}

/** 1回のあそびで打つ球の数 */
export const SHOTS = 10

const W = COURT.W
const N = COURT.NET_Y
const K = COURT.KITCHEN
/** 「深く」「コーナー」の大きさ（m） */
const DEEP = 2
const CORNER = 1.8

export function makeZone(level: Level, i: number, rand: () => number = Math.random): Zone {
  switch (level) {
    case 'chibi':
      return { x0: 0, x1: W, y0: 0, y1: N, label: 'むこうの コートに いれよう' }
    case 'kids':
      return i % 2 === 0 ? { x0: W / 2, x1: W, y0: 0, y1: N, label: 'みぎがわに いれよう' } : { x0: 0, x1: W / 2, y0: 0, y1: N, label: 'ひだりがわに いれよう' }
    case 'otona':
      return i % 2 === 0
        ? { x0: 0, x1: W, y0: N - K, y1: N, label: 'ディンク：キッチンに おとそう' }
        : { x0: 0, x1: W, y0: 0, y1: DEEP, label: 'ふかく：ベースラインの まえ 2m に' }
    case 'senshu': {
      if (i % 2 === 0) return { x0: 0, x1: W, y0: N - K, y1: N, label: '3きゅうめ ドロップ：はねてから キッチンへ', thirdShot: true }
      const right = rand() < 0.5
      return right ? { x0: W - CORNER, x1: W, y0: 0, y1: CORNER, label: 'みぎおくの コーナーへ' } : { x0: 0, x1: CORNER, y0: 0, y1: CORNER, label: 'ひだりおくの コーナーへ' }
    }
  }
}

/** 的に入ったか（ラインに触れた球はイン：境目もふくむ） */
export const inZone = (z: Zone, p: { x: number; y: number }) => p.x >= z.x0 - 1e-6 && p.x <= z.x1 + 1e-6 && p.y >= z.y0 - 1e-6 && p.y <= z.y1 + 1e-6

/** ボールマシンが送る球の落ちる場所（下の陣地。ネットからの距離 m と x） */
export function feedLanding(level: Level, zone: Zone, rand: () => number = Math.random): { x: number; y: number } {
  // 3球目ドロップの練習は、深いリターン（ベースライン近く）を想定する
  const [d0, d1] = zone.thirdShot ? [5.0, 6.3] : level === 'chibi' ? [3.5, 4.5] : level === 'kids' ? [3, 5] : [2.6, 5.6]
  const depth = d0 + rand() * (d1 - d0)
  const x = 1.0 + rand() * (W - 2.0)
  return { x, y: N + depth }
}
