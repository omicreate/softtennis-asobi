/**
 * ねらって ストローク（ひとりで）の的。打った球が最初に跳ねた場所が的の中ならせいかい。
 * 的はいつも上の陣地（ボールマシンの側）。下の人から見て右＝x が大きい側。
 * コースの名前はソフトテニスIQの用語：正クロス／逆クロス／右ストレート／左ストレート
 * （ストレートの左右は、打つ人の側から見た左右）。
 * レベルで中身が変わる：
 *   ちびっこ … むこうのコートに入れる
 *   キッズ   … 右／左に打ち分ける
 *   おとな   … クロスとストレートに打ち分ける（打つ場所はマシンの球しだい）
 *   せんしゅ … 4つのコースの深い所（ベースラインから3m以内）へ
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
  /** マシンの球をどちら側に送るか（打つ人が右側にいるか左側にいるか）。コースの名前が決まる */
  from?: 'right' | 'left'
}

/** 1回のあそびで打つ球の数 */
export const SHOTS = 10

const W = COURT.W
const N = COURT.NET_Y
/** 「深く」の大きさ（ベースラインから m） */
const DEEP = 3

type Course = 'sei-cross' | 'gyaku-cross' | 'right-straight' | 'left-straight'

/** コースの的（上の陣地。from は打つ人の位置） */
function course(c: Course, deep: boolean): Zone {
  const y0 = 0
  const y1 = deep ? DEEP : N
  switch (c) {
    // 右側から、ななめむこうの右側（上の人から見て右＝x が小さい側）へ
    case 'sei-cross':
      return { x0: 0, x1: W / 2, y0, y1, from: 'right', label: '正クロスへ（ななめ むこうへ）' }
    case 'right-straight':
      return { x0: W / 2, x1: W, y0, y1, from: 'right', label: '右ストレートへ（まっすぐ むこうへ）' }
    case 'gyaku-cross':
      return { x0: W / 2, x1: W, y0, y1, from: 'left', label: '逆クロスへ（ななめ むこうへ）' }
    case 'left-straight':
      return { x0: 0, x1: W / 2, y0, y1, from: 'left', label: '左ストレートへ（まっすぐ むこうへ）' }
  }
}

const COURSES: Course[] = ['sei-cross', 'right-straight', 'gyaku-cross', 'left-straight']

export function makeZone(level: Level, i: number, rand: () => number = Math.random): Zone {
  switch (level) {
    case 'chibi':
      return { x0: 0, x1: W, y0: 0, y1: N, label: 'むこうの コートに いれよう' }
    case 'kids':
      return i % 2 === 0 ? { x0: W / 2, x1: W, y0: 0, y1: N, label: 'みぎがわに いれよう' } : { x0: 0, x1: W / 2, y0: 0, y1: N, label: 'ひだりがわに いれよう' }
    case 'otona':
      return course(COURSES[Math.floor(rand() * 4)], false)
    case 'senshu': {
      const z = course(COURSES[Math.floor(rand() * 4)], true)
      return { ...z, label: `${z.label.split('（')[0]}：ふかく（ベースラインの まえ 3m）` }
    }
  }
}

/** 的に入ったか（ラインに触れた球はイン：境目もふくむ。第36条2） */
export const inZone = (z: Zone, p: { x: number; y: number }) => p.x >= z.x0 - 1e-6 && p.x <= z.x1 + 1e-6 && p.y >= z.y0 - 1e-6 && p.y <= z.y1 + 1e-6

/** ボールマシンが送る球の落ちる場所（下の陣地） */
export function feedLanding(level: Level, zone: Zone, rand: () => number = Math.random): { x: number; y: number } {
  const [d0, d1] = level === 'chibi' ? [6.5, 8.5] : level === 'kids' ? [6, 9] : [6, 10.5]
  const depth = d0 + rand() * (d1 - d0)
  // コースの的のときは、打つ人がその側（右／左）で打てるように送る
  const x = zone.from === 'right' ? W / 2 + 0.8 + rand() * (W / 2 - 1.6) : zone.from === 'left' ? 0.8 + rand() * (W / 2 - 1.6) : 1.2 + rand() * (W - 2.4)
  return { x, y: N + depth }
}
