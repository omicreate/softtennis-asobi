/** ホークアイ先生の4表情（ホークアイ先生仕様：出題「？」・正解「！」・えっ！？・ドンマイ） */
export type Face = 'think' | 'ok' | 'eh' | 'oops'

const ALT: Record<Face, string> = {
  think: 'かんがえる ホークアイ先生',
  ok: 'よろこぶ ホークアイ先生',
  eh: 'おどろく ホークアイ先生',
  oops: 'ドンマイの ホークアイ先生',
}

export function Hawk({ face, size = 80, className }: { face: Face; size?: number; className?: string }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}hawk/${face}.png`} width={size} height={size} alt={ALT[face]} draggable={false} />
}
