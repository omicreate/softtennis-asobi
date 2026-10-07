/** ピクルくんの4表情（ピクルくん仕様：出題「？」・正解「！」・えっ！？・ドンマイ） */
export type Face = 'think' | 'ok' | 'eh' | 'oops'

const ALT: Record<Face, string> = {
  think: 'かんがえる ピクルくん',
  ok: 'よろこぶ ピクルくん',
  eh: 'おどろく ピクルくん',
  oops: 'ドンマイの ピクルくん',
}

export function Pikuru({ face, size = 80, className }: { face: Face; size?: number; className?: string }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}pikuru/${face}.png`} width={size} height={size} alt={ALT[face]} draggable={false} />
}
