/**
 * コレクション（きせかえ）の一覧。ほし（⭐）と こうかん するか、とくべつな ことをすると もらえる。
 * お金はかからない。ふたりで遊ぶときの強さは変わらない（見た目だけ）。
 */
import { ACCESSORIES } from '../ui/accessories'
import type { AccessoryId } from '../ui/accessories'
import { DESIGNS, SHAPES } from '../ui/paddleArt'
import type { DesignId, PaddleShape } from '../ui/paddleArt'

export type ItemKind = 'design' | 'shape' | 'wear'

/** とくべつな ごほうびの条件 */
export type Special = 'stamps7' | 'stamps14' | 'party' | 'missions10' | 'medals9'

export interface Item {
  /** design:orange・shape:long・wear:crown のように「種類:名前」 */
  id: string
  kind: ItemKind
  key: string
  label: string
  /** こうかんに いる ほしの数（0＝はじめから持っている） */
  price: number
  special?: Special
}

export const SPECIAL_TEXT: Record<Special, string> = {
  stamps7: 'スタンプを 7こ あつめる',
  stamps14: 'スタンプを 14こ あつめる',
  party: 'じゅんばんモードを さいごまで あそぶ',
  missions10: 'ミッションを 10こ クリア',
  medals9: 'メダルを 9こ あつめる（どう1・ぎん2・きん3）',
}

const DESIGN_PRICE: Record<DesignId, number | Special> = {
  orange: 0,
  blue: 0,
  lime: 2,
  red: 2,
  dots: 3,
  stripe: 3,
  star: 4,
  heart: 4,
  hawk: 5,
  rainbow: 6,
  gold: 'stamps7',
  ocean: 5,
  sakura: 5,
  yozora: 6,
  champion: 'medals9',
}

const SHAPE_PRICE: Record<PaddleShape, number> = { std: 0, round: 2, long: 3, wide: 3 }

const WEAR_PRICE: Record<AccessoryId, number | Special> = {
  flower: 2,
  ribbon: 2,
  glasses: 3,
  bowtie: 3,
  sunglasses: 4,
  'party-hat': 4,
  'star-glasses': 5,
  crown: 'party',
  medal: 'missions10',
  aura: 'stamps14',
}

/** 小物（きせかえ）を出すか */
export const WEAR_ON = false

function make(kind: ItemKind, key: string, label: string, p: number | Special): Item {
  return typeof p === 'number' ? { id: `${kind}:${key}`, kind, key, label, price: p } : { id: `${kind}:${key}`, kind, key, label, price: 0, special: p }
}

export const ITEMS: Item[] = [
  ...(Object.keys(DESIGNS) as DesignId[]).map((k) => make('design', k, DESIGNS[k].label, DESIGN_PRICE[k])),
  ...(Object.keys(SHAPES) as PaddleShape[]).map((k) => make('shape', k, SHAPES[k].label, SHAPE_PRICE[k])),
  // ホークアイ先生の小物は、表情の原画がそろって置く場所を測ってから出す（いまは出さない）
  ...(WEAR_ON ? (Object.keys(ACCESSORIES) as AccessoryId[]).map((k) => make('wear', k, ACCESSORIES[k].label, WEAR_PRICE[k])) : []),
]

export const itemById = (id: string) => ITEMS.find((i) => i.id === id)

/** はじめから持っているもの */
export const STARTER_ITEMS = ITEMS.filter((i) => i.price === 0 && !i.special).map((i) => i.id)

/** はじめて開いたときの プレゼント（すぐに 1つ こうかんできるように） */
export const WELCOME_STARS = 3
