/** じゅんばんモードの人の色と名前（名前は色。文字が読めなくても色で分かる） */
export const PARTY_COLORS = [
  { name: 'オレンジ', color: '#ff8a3d' },
  { name: 'あお', color: '#3d9be9' },
  { name: 'ピンク', color: '#ff6fae' },
  { name: 'みどり', color: '#4caf50' },
  { name: 'むらさき', color: '#9b6bff' },
  { name: 'きいろ', color: '#f5c400' },
] as const

export const MAX_PLAYERS = PARTY_COLORS.length

export const turnLine = (name: string) => `${name}の ばん！`
export const champLine = (name: string) => `${name}の ゆうしょう！`
export const nextGameLine = (title: string) => `つぎは ${title}！`
export const teamWinLine = (name: string) => `${name} チームの かち！`
