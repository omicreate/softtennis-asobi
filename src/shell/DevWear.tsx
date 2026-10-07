/** 開発用：小物を全部の絵に重ねて確かめる（#/dev。本番には入らない） */
import { ACCESSORIES } from '../ui/accessories'
import type { AccessoryId, Wear } from '../ui/accessories'
import { PaddleIcon } from '../ui/PaddleIcon'
import { DESIGNS, SHAPES } from '../ui/paddleArt'
import type { DesignId, PaddleShape } from '../ui/paddleArt'
import { HawkCut } from '../ui/hawkArt'
import type { CutArt } from '../ui/hawkArt'

const ARTS: CutArt[] = ['think', 'ok', 'eh', 'oops', 'full', 'run']
const SETS: Wear[] = [
  {},
  ...(Object.keys(ACCESSORIES) as AccessoryId[]).map((id) => ({ [ACCESSORIES[id].slot]: id })),
  { head: 'crown', eyes: 'sunglasses', neck: 'medal', side: 'flower', aura: 'aura' },
]

export default function DevWear() {
  return (
    <main style={{ padding: 8, background: '#fff' }}>
      {SETS.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, borderBottom: '1px solid #ddd' }}>
          <span style={{ width: 90, fontSize: 11 }}>{Object.values(w).join(',') || 'なし'}</span>
          {ARTS.map((a) => (
            <HawkCut key={a} art={a} height={a === 'full' || a === 'run' ? 110 : 90} wear={w} />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {(Object.keys(DESIGNS) as DesignId[]).map((d) => (
          <PaddleIcon key={d} look={{ design: d, shape: 'std' }} size={70} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {(Object.keys(SHAPES) as PaddleShape[]).map((s) => (
          <PaddleIcon key={s} look={{ design: 'orange', shape: s }} size={90} />
        ))}
      </div>
    </main>
  )
}
