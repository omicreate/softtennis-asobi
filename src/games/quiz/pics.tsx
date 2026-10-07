/** こども向けクイズの選択肢の絵（文字が読めなくても選べるように）。すべて 100×100 の SVG */
import type { ReactNode } from 'react'

export type PicId =
  | 'pb-ball'
  | 'tennis-ball'
  | 'soccer-ball'
  | 'paddle'
  | 'racket'
  | 'bat'
  | 'zone-kitchen'
  | 'zone-middle'
  | 'zone-back'
  | 'mark-ng'
  | 'mark-ok'
  | 'mark-again'
  | 'mark-other'
  | 'line-in'
  | 'line-out'
  | 'net'
  | 'wall'
  | 'pond'
  | 'num-1'
  | 'num-2'
  | 'num-3'
  | 'num-11'
  | 'num-100'
  | 'bounce-1'
  | 'bounce-0'
  | 'roll'
  | 'serve-diag'
  | 'serve-straight'
  | 'serve-kitchen'
  | 'janken'

const INK = '#12302b'
const LIME = '#d4f03c'
const LINE = '#2e5a1c'
const COURT = '#2f5d9a'
const KITCHEN = '#3d8f7a'

const ball = (cx: number, cy: number, r: number) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={LIME} stroke={LINE} strokeWidth={r * 0.12} />
    <circle cx={cx - r * 0.35} cy={cy - r * 0.3} r={r * 0.15} fill={LINE} />
    <circle cx={cx + r * 0.35} cy={cy - r * 0.25} r={r * 0.15} fill={LINE} />
    <circle cx={cx} cy={cy + r * 0.38} r={r * 0.15} fill={LINE} />
  </g>
)

/** 上から見たコート（縦長）。hi＝光らせる場所 */
const court = (hi: 'kitchen' | 'middle' | 'back' | null, extra?: ReactNode) => (
  <g>
    <rect x={22} y={4} width={56} height={92} rx={3} fill={COURT} stroke="#fff" strokeWidth={2} />
    <rect x={22} y={35} width={56} height={30} fill={KITCHEN} />
    <line x1={22} y1={35} x2={78} y2={35} stroke="#fff" strokeWidth={2} />
    <line x1={22} y1={65} x2={78} y2={65} stroke="#fff" strokeWidth={2} />
    <line x1={50} y1={4} x2={50} y2={35} stroke="#fff" strokeWidth={2} />
    <line x1={50} y1={65} x2={50} y2={96} stroke="#fff" strokeWidth={2} />
    {hi === 'kitchen' && <rect x={22} y={50} width={56} height={15} fill={LIME} opacity={0.85} />}
    {hi === 'middle' && <rect x={22} y={65} width={56} height={16} fill={LIME} opacity={0.85} />}
    {hi === 'back' && <rect x={22} y={81} width={56} height={15} fill={LIME} opacity={0.85} />}
    <rect x={16} y={48} width={68} height={4} fill={INK} />
    {extra}
  </g>
)

const num = (text: string) => (
  <text x={50} y={66} textAnchor="middle" fontSize={text.length > 2 ? 40 : 52} fontWeight={900} fill={INK}>
    {text}
  </text>
)

const arrow = (x1: number, y1: number, x2: number, y2: number, color = '#ff8a3d') => (
  <g>
    <defs>
      <marker id={`ah-${x1}-${y1}-${x2}`} viewBox="0 0 10 10" refX={6} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={color} />
      </marker>
    </defs>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={5} strokeLinecap="round" markerEnd={`url(#ah-${x1}-${y1}-${x2})`} />
  </g>
)

const PICS: Record<PicId, ReactNode> = {
  'pb-ball': ball(50, 50, 34),
  'tennis-ball': (
    <g>
      <circle cx={50} cy={50} r={34} fill="#c8e64a" stroke="#8aa52a" strokeWidth={3} />
      <path d="M22 32 C42 44 42 56 22 68" fill="none" stroke="#fff" strokeWidth={4} />
      <path d="M78 32 C58 44 58 56 78 68" fill="none" stroke="#fff" strokeWidth={4} />
    </g>
  ),
  'soccer-ball': (
    <g>
      <circle cx={50} cy={50} r={34} fill="#fff" stroke={INK} strokeWidth={3} />
      <polygon points="50,36 62,45 58,59 42,59 38,45" fill={INK} />
      <polygon points="50,17 58,22 50,28 42,22" fill={INK} />
      <polygon points="80,44 78,56 70,50 72,42" fill={INK} />
      <polygon points="20,44 28,42 30,50 22,56" fill={INK} />
    </g>
  ),
  paddle: (
    <g transform="rotate(-25 50 50)">
      <rect x={30} y={10} width={40} height={52} rx={14} fill="#ff8a3d" stroke={LINE} strokeWidth={4} />
      <rect x={44} y={60} width={12} height={30} rx={4} fill={LINE} />
    </g>
  ),
  racket: (
    <g transform="rotate(-25 50 50)">
      <ellipse cx={50} cy={34} rx={22} ry={27} fill="#fff" stroke="#3d9be9" strokeWidth={5} />
      {[24, 32, 40, 48].map((y) => (
        <line key={y} x1={30} y1={y} x2={70} y2={y} stroke="#9bc6ec" strokeWidth={1.5} />
      ))}
      {[38, 46, 54, 62].map((x) => (
        <line key={x} x1={x} y1={9} x2={x} y2={60} stroke="#9bc6ec" strokeWidth={1.5} />
      ))}
      <rect x={46} y={60} width={8} height={32} rx={3} fill="#3d9be9" />
    </g>
  ),
  bat: (
    <g transform="rotate(35 50 50)">
      <path d="M44 92 L46 40 C46 22 54 22 54 40 L56 92 Z" fill="#d9a55b" stroke="#8a5a1d" strokeWidth={3} />
      <rect x={42} y={86} width={16} height={6} rx={3} fill="#8a5a1d" />
    </g>
  ),
  'zone-kitchen': court('kitchen'),
  'zone-middle': court('middle'),
  'zone-back': court('back'),
  'mark-ok': <circle cx={50} cy={50} r={30} fill="none" stroke="#4caf50" strokeWidth={10} />,
  'mark-ng': (
    <g stroke="#e5533d" strokeWidth={11} strokeLinecap="round">
      <line x1={26} y1={26} x2={74} y2={74} />
      <line x1={74} y1={26} x2={26} y2={74} />
    </g>
  ),
  'mark-again': (
    <g fill="none" stroke="#3d9be9" strokeWidth={9} strokeLinecap="round">
      <path d="M72 38 A26 26 0 1 0 76 58" />
      <path d="M60 36 L74 38 L76 24" />
    </g>
  ),
  'mark-other': (
    <g>
      <circle cx={34} cy={50} r={14} fill="#ff8a3d" />
      <circle cx={70} cy={50} r={14} fill="#3d9be9" />
      <g stroke="#e5533d" strokeWidth={6} strokeLinecap="round">
        <line x1={60} y1={30} x2={80} y2={50} />
        <line x1={80} y1={30} x2={60} y2={50} />
      </g>
    </g>
  ),
  'line-in': (
    <g>
      <rect x={0} y={10} width={44} height={80} fill={COURT} />
      <rect x={56} y={10} width={44} height={80} fill="#183152" />
      <rect x={44} y={10} width={12} height={80} fill="#fff" />
      {ball(58, 50, 14)}
      <circle cx={50} cy={50} r={44} fill="none" stroke="#4caf50" strokeWidth={6} opacity={0.9} />
    </g>
  ),
  'line-out': (
    <g>
      <rect x={0} y={10} width={44} height={80} fill={COURT} />
      <rect x={56} y={10} width={44} height={80} fill="#183152" />
      <rect x={44} y={10} width={12} height={80} fill="#fff" />
      {ball(80, 50, 14)}
      <g stroke="#e5533d" strokeWidth={6} strokeLinecap="round" opacity={0.9}>
        <line x1={14} y1={14} x2={86} y2={86} />
      </g>
    </g>
  ),
  net: (
    <g>
      <rect x={8} y={40} width={84} height={30} fill="none" stroke={INK} strokeWidth={3} />
      {[20, 32, 44, 56, 68, 80].map((x) => (
        <line key={x} x1={x} y1={40} x2={x} y2={70} stroke={INK} strokeWidth={1.5} />
      ))}
      {[50, 60].map((y) => (
        <line key={y} x1={8} y1={y} x2={92} y2={y} stroke={INK} strokeWidth={1.5} />
      ))}
      <rect x={8} y={36} width={84} height={6} fill="#fff" stroke={INK} strokeWidth={2} />
      <rect x={4} y={34} width={6} height={50} fill={INK} />
      <rect x={90} y={34} width={6} height={50} fill={INK} />
    </g>
  ),
  wall: (
    <g fill="#c96b4a" stroke="#fff" strokeWidth={3}>
      {[20, 40, 60].map((y, r) =>
        [0, 1, 2].map((i) => <rect key={`${y}-${i}`} x={10 + i * 27 - (r % 2) * 13 + (r % 2 && i === 0 ? 13 : 0)} y={y} width={r % 2 && i === 0 ? 14 : 27} height={20} />),
      )}
    </g>
  ),
  pond: (
    <g>
      <ellipse cx={50} cy={58} rx={40} ry={24} fill="#7cc4f0" stroke="#3d9be9" strokeWidth={3} />
      <path d="M30 56 q6 -5 12 0 q6 5 12 0" fill="none" stroke="#fff" strokeWidth={3} />
      <path d="M50 66 q6 -5 12 0" fill="none" stroke="#fff" strokeWidth={3} />
    </g>
  ),
  'num-1': num('1'),
  'num-2': num('2'),
  'num-3': num('3'),
  'num-11': num('11'),
  'num-100': num('100'),
  'bounce-1': (
    <g>
      <line x1={6} y1={88} x2={94} y2={88} stroke={INK} strokeWidth={3} />
      <path d="M12 20 Q30 40 44 86 Q58 40 80 30" fill="none" stroke="#ff8a3d" strokeWidth={4} strokeDasharray="6 5" />
      {ball(80, 30, 11)}
    </g>
  ),
  'bounce-0': (
    <g>
      <line x1={6} y1={88} x2={94} y2={88} stroke={INK} strokeWidth={3} />
      <path d="M10 30 Q45 18 78 42" fill="none" stroke="#ff8a3d" strokeWidth={4} strokeDasharray="6 5" />
      {ball(80, 44, 11)}
    </g>
  ),
  roll: (
    <g>
      <line x1={6} y1={88} x2={94} y2={88} stroke={INK} strokeWidth={3} />
      <path d="M10 76 L70 76" fill="none" stroke="#ff8a3d" strokeWidth={4} strokeDasharray="6 5" />
      {ball(78, 76, 11)}
    </g>
  ),
  'serve-diag': court(null, arrow(64, 88, 36, 16)),
  'serve-straight': court(null, arrow(64, 88, 64, 16)),
  'serve-kitchen': court(null, arrow(64, 88, 50, 42)),
  janken: (
    <g>
      <circle cx={50} cy={52} r={30} fill="#ffd9b0" stroke="#c4570f" strokeWidth={3} />
      <g stroke="#c4570f" strokeWidth={3} strokeLinecap="round">
        <line x1={38} y1={28} x2={34} y2={10} />
        <line x1={50} y1={24} x2={50} y2={6} />
      </g>
    </g>
  ),
}

export function Pic({ id }: { id: PicId }) {
  return (
    <svg className="pic" viewBox="0 0 100 100" aria-hidden>
      {PICS[id]}
    </svg>
  )
}

export const PIC_IDS = Object.keys(PICS) as PicId[]
