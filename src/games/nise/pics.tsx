/** にせホークアイ先生の「え」のお題（100×100 の SVG）。ボールとラケット・ラケットはクイズの絵を使う */
import type { ReactNode } from 'react'
import { Pic } from '../quiz/pics'

export type NisePicId =
  | 'st-ball'
  | 'tennis-ball'
  | 'paddle'
  | 'racket'
  | 'apple'
  | 'tomato'
  | 'cucumber'
  | 'banana'
  | 'strawberry'
  | 'cherry'
  | 'watermelon'
  | 'melon'
  | 'sun'
  | 'moon'
  | 'dog'
  | 'cat'

const INK = '#12302b'
const LEAF = '#4caf50'
const DARK = '#154d36'

const eyes = (y: number, gap = 12) => (
  <g fill={INK}>
    <circle cx={50 - gap} cy={y} r={3.6} />
    <circle cx={50 + gap} cy={y} r={3.6} />
  </g>
)

const DRAW: Record<Exclude<NisePicId, 'st-ball' | 'tennis-ball' | 'paddle' | 'racket'>, ReactNode> = {
  apple: (
    <g>
      <path d="M50 30 C30 18 12 34 16 56 C20 80 38 92 50 84 C62 92 80 80 84 56 C88 34 70 18 50 30 Z" fill="#e53935" stroke="#9b1c1c" strokeWidth={3} />
      <path d="M50 30 Q52 18 58 10" stroke="#6d4c2f" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M54 20 Q68 8 78 18 Q66 28 54 20 Z" fill={LEAF} stroke={DARK} strokeWidth={2} />
      <ellipse cx={34} cy={46} rx={6} ry={10} fill="#fff" opacity={0.45} />
    </g>
  ),
  tomato: (
    <g>
      <ellipse cx={50} cy={58} rx={36} ry={30} fill="#f4433c" stroke="#a51d17" strokeWidth={3} />
      <path d="M50 28 L56 38 L68 34 L60 44 L70 50 L56 48 L50 58 L44 48 L30 50 L40 44 L32 34 L44 38 Z" fill={LEAF} stroke={DARK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M50 30 V18" stroke={DARK} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={30} cy={60} rx={5} ry={9} fill="#fff" opacity={0.4} />
    </g>
  ),
  cucumber: (
    <g transform="rotate(-30 50 50)">
      <rect x={14} y={38} width={72} height={26} rx={13} fill="#4f9a32" stroke={DARK} strokeWidth={3} />
      <path d="M22 46 h56" stroke="#7cc45a" strokeWidth={3} strokeLinecap="round" />
      {[26, 38, 50, 62, 74].map((x) => (
        <circle key={x} cx={x} cy={56} r={1.8} fill={DARK} />
      ))}
      <path d="M86 51 l8 -4" stroke={DARK} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  banana: (
    <g>
      <path d="M18 34 C22 70 52 88 84 70 C88 68 88 62 84 62 C58 74 34 62 28 32 C26 26 18 28 18 34 Z" fill="#ffd54a" stroke="#b8860b" strokeWidth={3} strokeLinejoin="round" />
      <path d="M30 40 C36 60 56 70 76 66" stroke="#e6b422" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M20 30 l-2 -8" stroke="#6d4c2f" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  strawberry: (
    <g>
      <path d="M50 90 C26 74 16 52 22 38 C28 26 72 26 78 38 C84 52 74 74 50 90 Z" fill="#e53950" stroke="#9b1c30" strokeWidth={3} />
      {[
        [36, 44],
        [50, 42],
        [64, 44],
        [42, 56],
        [58, 56],
        [50, 68],
        [36, 64],
        [64, 64],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.8} ry={2.6} fill="#ffe7a0" />
      ))}
      <path d="M50 32 L40 22 L46 32 L32 30 L44 36 L50 40 L56 36 L68 30 L54 32 L60 22 Z" fill={LEAF} stroke={DARK} strokeWidth={2} strokeLinejoin="round" />
    </g>
  ),
  cherry: (
    <g>
      <path d="M34 66 Q40 36 56 14 M66 70 Q62 40 56 14" stroke="#6d8f2f" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <path d="M56 14 Q72 6 80 16 Q68 22 56 14 Z" fill={LEAF} stroke={DARK} strokeWidth={2} />
      <circle cx={32} cy={72} r={16} fill="#d81b3c" stroke="#8e0f26" strokeWidth={3} />
      <circle cx={68} cy={74} r={16} fill="#d81b3c" stroke="#8e0f26" strokeWidth={3} />
      <circle cx={26} cy={66} r={4} fill="#fff" opacity={0.5} />
      <circle cx={62} cy={68} r={4} fill="#fff" opacity={0.5} />
    </g>
  ),
  watermelon: (
    <g>
      <path d="M8 40 A42 42 0 0 0 92 40 Z" fill="#2e7d32" />
      <path d="M14 40 A36 36 0 0 0 86 40 Z" fill="#f1f8e9" />
      <path d="M18 40 A32 32 0 0 0 82 40 Z" fill="#ef5350" />
      {[
        [34, 50],
        [50, 58],
        [66, 50],
        [42, 64],
        [58, 64],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={2.4} ry={3.6} fill={INK} />
      ))}
      <path d="M8 40 H92" stroke="#1b5e20" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  melon: (
    <g>
      <circle cx={50} cy={54} r={36} fill="#a5d66f" stroke="#5f8f2f" strokeWidth={3} />
      <g stroke="#e8f5d0" strokeWidth={2} fill="none" opacity={0.9}>
        <path d="M22 36 Q50 50 78 36 M18 56 Q50 70 82 56 M26 76 Q50 86 74 76" />
        <path d="M34 22 Q44 54 30 86 M66 22 Q56 54 70 86 M50 18 V90" />
      </g>
      <path d="M50 18 V8 M50 10 Q40 4 34 10" stroke="#6d8f2f" strokeWidth={4} fill="none" strokeLinecap="round" />
    </g>
  ),
  sun: (
    <g>
      <g stroke="#ff9800" strokeWidth={5} strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return <line key={i} x1={50 + Math.cos(a) * 32} y1={50 + Math.sin(a) * 32} x2={50 + Math.cos(a) * 44} y2={50 + Math.sin(a) * 44} />
        })}
      </g>
      <circle cx={50} cy={50} r={25} fill="#ffca28" stroke="#ef8f00" strokeWidth={3} />
      {eyes(46, 9)}
      <path d="M42 56 Q50 63 58 56" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  ),
  moon: (
    <g>
      <path d="M62 10 A40 40 0 1 0 90 66 A32 32 0 1 1 62 10 Z" fill="#ffe082" stroke="#c9a227" strokeWidth={3} strokeLinejoin="round" />
      <circle cx={40} cy={58} r={3.4} fill={INK} />
      <path d="M36 70 Q44 74 50 68" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={84} cy={22} r={3} fill="#ffe082" />
      <circle cx={74} cy={10} r={2} fill="#ffe082" />
    </g>
  ),
  dog: (
    <g>
      <ellipse cx={22} cy={46} rx={12} ry={22} fill="#8d6e63" stroke="#4e342e" strokeWidth={3} transform="rotate(12 22 46)" />
      <ellipse cx={78} cy={46} rx={12} ry={22} fill="#8d6e63" stroke="#4e342e" strokeWidth={3} transform="rotate(-12 78 46)" />
      <circle cx={50} cy={52} r={30} fill="#d7a77a" stroke="#4e342e" strokeWidth={3} />
      {eyes(46, 11)}
      <ellipse cx={50} cy={60} rx={7} ry={5} fill={INK} />
      <path d="M50 65 V70 M42 72 Q50 78 58 72" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M50 76 Q54 86 58 76" fill="#ff6f8a" stroke="#c2185b" strokeWidth={1.5} />
    </g>
  ),
  cat: (
    <g>
      <path d="M24 44 L22 12 L46 30 Z M76 44 L78 12 L54 30 Z" fill="#ffb74d" stroke="#e65100" strokeWidth={3} strokeLinejoin="round" />
      <path d="M28 34 L27 20 L38 28 Z M72 34 L73 20 L62 28 Z" fill="#ffccbc" />
      <circle cx={50} cy={54} r={30} fill="#ffb74d" stroke="#e65100" strokeWidth={3} />
      <g fill={INK}>
        <ellipse cx={39} cy={50} rx={3.4} ry={5} />
        <ellipse cx={61} cy={50} rx={3.4} ry={5} />
      </g>
      <path d="M47 60 L53 60 L50 64 Z" fill="#ff6f8a" />
      <path d="M50 64 Q46 70 41 67 M50 64 Q54 70 59 67" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <g stroke={INK} strokeWidth={1.8} strokeLinecap="round">
        <path d="M30 60 H14 M30 64 L15 70 M70 60 H86 M70 64 L85 70" />
      </g>
    </g>
  ),
}

export function NisePic({ id, size = 160 }: { id: NisePicId; size?: number }) {
  if (id === 'st-ball' || id === 'tennis-ball' || id === 'paddle' || id === 'racket') {
    return (
      <span className="nise-pic" style={{ width: size, height: size }}>
        <Pic id={id} />
      </span>
    )
  }
  return (
    <svg className="nise-pic" viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {DRAW[id]}
    </svg>
  )
}
