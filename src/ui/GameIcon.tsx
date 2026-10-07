/**
 * ホームのカードに出す、ゲームごとの絵（字が読めない子でも、絵でゲームを見分けられるように）。
 * 色はピクルくん仕様とコートの色（tokens.css）。パドルは本物の比率（面 28cm：幅 20cm、握り 13cm）で描く。
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import type { GameId } from '../shell/games'

const C = {
  navy: '#24497a',
  court: '#2f5d9a',
  kitchen: '#3d8f7a',
  line: '#ffffff',
  ball: '#d4f03c',
  dark: '#2e5a1c',
  ink: '#12302b',
  body: '#6bb33f',
  orange: '#ff8a3d',
  blue: '#3d9be9',
  cream: '#ffe7b8',
  paper: '#fff6e3',
  p0tint: '#ffdcb8',
  p1tint: '#d3e7f8',
}

/** ピックルボール（穴のあいた球） */
function Ball({ x, y, r, ring }: { x: number; y: number; r: number; ring?: string }) {
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={r + 2.2} fill={ring} />}
      <circle cx={x} cy={y} r={r} fill={C.ball} stroke={C.dark} strokeWidth={Math.max(1, r * 0.16)} />
      {[
        [-0.36, -0.24],
        [0.3, -0.3],
        [0.04, 0.38],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx * r} cy={y + dy * r} r={r * 0.15} fill={C.dark} />
      ))}
    </g>
  )
}

/** パドル（面の中心 x,y・面の長さ len・向き deg。0 のとき握りが下） */
function Paddle({ x, y, len, deg = 0, color }: { x: number; y: number; len: number; deg?: number; color: string }) {
  const w = len * (20 / 28)
  const grip = len * (13 / 28)
  const gw = w * 0.24
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      <rect x={-gw / 2} y={len / 2 - 1} width={gw} height={grip} rx={gw / 2} fill={C.dark} />
      <circle cx={0} cy={len / 2 + grip - 0.5} r={gw * 0.62} fill={C.ink} />
      <rect x={-w / 2} y={-len / 2} width={w} height={len} rx={w * 0.36} fill={color} stroke={C.dark} strokeWidth={Math.max(1.4, len * 0.07)} />
      <rect x={-w / 2 + len * 0.12} y={-len / 2 + len * 0.12} width={w - len * 0.24} height={len - len * 0.24} rx={w * 0.26} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={Math.max(1, len * 0.05)} />
    </g>
  )
}

/** 小さな ピクルくん（からだ・ヘアバンド・目） */
function MiniPikuru({ x, y, h, tilt = 0 }: { x: number; y: number; h: number; tilt?: number }) {
  const w = h * 0.6
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <path d={`M ${w * 0.05} ${-h / 2} q ${w * 0.1} ${-h * 0.2} ${w * 0.3} ${-h * 0.16}`} fill="none" stroke={C.dark} strokeWidth={h * 0.07} strokeLinecap="round" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w / 2} fill={C.body} stroke={C.dark} strokeWidth={h * 0.07} />
      <rect x={-w / 2 + 0.6} y={-h * 0.24} width={w - 1.2} height={h * 0.15} fill={C.ball} stroke={C.dark} strokeWidth={h * 0.04} />
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={s * w * 0.2} cy={h * 0.06} r={h * 0.11} fill="#fff" stroke={C.dark} strokeWidth={h * 0.03} />
          <circle cx={s * w * 0.2 + h * 0.02} cy={h * 0.07} r={h * 0.055} fill={C.ink} />
        </g>
      ))}
      <path d={`M ${-w * 0.16} ${h * 0.26} q ${w * 0.16} ${h * 0.12} ${w * 0.32} 0`} fill="none" stroke={C.dark} strokeWidth={h * 0.05} strokeLinecap="round" />
    </g>
  )
}

/** 上から見たコート（縦長。x0,y0 から 幅 w・長さ h。キッチンは長さの 0.159 ずつ） */
function Court({ x, y, w, h, net = true }: { x: number; y: number; w: number; h: number; net?: boolean }) {
  const k = h * (2.13 / 13.41)
  const mid = y + h / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.court} stroke={C.line} strokeWidth={1.6} />
      <rect x={x} y={mid - k} width={w} height={k * 2} fill={C.kitchen} stroke={C.line} strokeWidth={1.2} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={mid - k} stroke={C.line} strokeWidth={1.2} />
      <line x1={x + w / 2} y1={mid + k} x2={x + w / 2} y2={y + h} stroke={C.line} strokeWidth={1.2} />
      {net && <line x1={x - 4} y1={mid} x2={x + w + 4} y2={mid} stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" />}
    </g>
  )
}

/** うごきの線（点線の軌道） */
const Trail = ({ d, color = C.ball }: { d: string; color?: string }) => (
  <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeDasharray="1 4.5" strokeLinecap="round" />
)

/** タップの波紋 */
const Tap = ({ x, y, color }: { x: number; y: number; color: string }) => (
  <g fill="none" stroke={color} strokeLinecap="round">
    <circle cx={x} cy={y} r={4} strokeWidth={3} />
    <circle cx={x} cy={y} r={9} strokeWidth={2.2} opacity={0.6} />
  </g>
)

const Bg = ({ fill }: { fill: string }) => <rect width={96} height={96} fill={fill} />

/** 上と下に分かれた地（ふたりで向かい合うゲーム） */
const SplitBg = () => (
  <g>
    <rect width={96} height={96} fill={C.p0tint} />
    <rect width={96} height={48} fill={C.p1tint} />
  </g>
)

const ICONS: Record<GameId, () => ReactNode> = {
  rally: () => (
    <>
      <Bg fill={C.navy} />
      <Court x={24} y={8} w={48} h={80} />
      <Paddle x={38} y={20} len={15} deg={180} color={C.blue} />
      <Paddle x={58} y={74} len={15} color={C.orange} />
      <Trail d="M57 64 Q70 48 61 32" />
      <Ball x={60} y={29} r={5} />
    </>
  ),
  tug: () => (
    <>
      <SplitBg />
      <rect x={36} y={8} width={24} height={80} rx={12} fill={C.court} />
      <line x1={48} y1={10} x2={48} y2={86} stroke="#c8a26a" strokeWidth={3} strokeDasharray="4 3" />
      <rect x={34} y={10} width={28} height={3} rx={1.5} fill={C.blue} />
      <rect x={34} y={83} width={28} height={3} rx={1.5} fill={C.orange} />
      <Ball x={48} y={46} r={9} />
      <path d="M41 69 L48 62 L55 69 M41 77 L48 70 L55 77" fill="none" stroke={C.orange} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <Tap x={18} y={76} color={C.orange} />
      <Tap x={80} y={64} color={C.orange} />
      <Tap x={76} y={20} color={C.blue} />
    </>
  ),
  air: () => (
    <>
      <Bg fill={C.navy} />
      <rect x={8} y={10} width={80} height={76} rx={10} fill={C.court} stroke={C.line} strokeWidth={1.6} />
      <rect x={8} y={36} width={80} height={24} fill={C.kitchen} />
      <rect x={34} y={7} width={28} height={5} rx={2} fill={C.blue} />
      <rect x={34} y={84} width={28} height={5} rx={2} fill={C.orange} />
      <circle cx={48} cy={48} r={11} fill="none" stroke={C.line} strokeWidth={1.4} />
      <Paddle x={36} y={66} len={16} color={C.orange} />
      <Paddle x={60} y={28} len={14} deg={180} color={C.blue} />
      <path d="M38 50 L30 54 M40 46 L31 47" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      <Ball x={50} y={44} r={6} />
    </>
  ),
  dink: () => (
    <>
      <Bg fill={C.paper} />
      <rect x={6} y={76} width={84} height={12} rx={3} fill={C.court} />
      <rect x={30} y={76} width={36} height={12} fill={C.kitchen} />
      <rect x={46} y={56} width={4} height={22} fill={C.ink} />
      <rect x={44} y={54} width={8} height={4} rx={1.5} fill="#fff" stroke={C.ink} strokeWidth={1.2} />
      <Trail d="M20 66 Q44 26 60 74" color={C.body} />
      <Paddle x={16} y={64} len={14} deg={-35} color={C.orange} />
      <Ball x={54} y={50} r={6} />
      <path d="M62 34 q4 -4 8 0 q4 4 8 0" fill="none" stroke={C.blue} strokeWidth={2.4} strokeLinecap="round" />
    </>
  ),
  hayatouch: () => (
    <>
      <Bg fill={C.paper} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return <line key={i} x1={48 + Math.cos(a) * 27} y1={42 + Math.sin(a) * 27} x2={48 + Math.cos(a) * 35} y2={42 + Math.sin(a) * 35} stroke={C.body} strokeWidth={3.4} strokeLinecap="round" />
      })}
      <circle cx={48} cy={42} r={23} fill="rgba(107,179,63,0.25)" />
      <Ball x={48} y={42} r={18} />
      <Tap x={70} y={78} color={C.orange} />
    </>
  ),
  quiz: () => (
    <>
      <Bg fill={C.ball} />
      <path d="M16 12 H80 A8 8 0 0 1 88 20 V50 A8 8 0 0 1 80 58 H42 L30 68 L32 58 H16 A8 8 0 0 1 8 50 V20 A8 8 0 0 1 16 12 Z" fill="#fff" stroke={C.dark} strokeWidth={2.4} />
      <text x={48} y={49} textAnchor="middle" fontSize={34} fontWeight={900} fill={C.dark} fontFamily="'Zen Maru Gothic', sans-serif">
        ？
      </text>
      <rect x={12} y={74} width={22} height={12} rx={6} fill={C.orange} stroke={C.dark} strokeWidth={1.6} />
      <rect x={37} y={74} width={22} height={12} rx={6} fill="#fff" stroke={C.dark} strokeWidth={1.6} />
      <rect x={62} y={74} width={22} height={12} rx={6} fill={C.blue} stroke={C.dark} strokeWidth={1.6} />
    </>
  ),
  breakout2: () => (
    <>
      <Bg fill={C.court} />
      {[0, 1].map((row) =>
        [0, 1, 2, 3, 4].map((i) => {
          const pickle = (row === 0 && i === 3) || (row === 1 && i === 1)
          return <rect key={`${row}-${i}`} x={9 + i * 16} y={40 + row * 10} width={14} height={8} rx={3} fill={pickle ? C.body : C.paper} stroke={C.dark} strokeWidth={1} />
        }),
      )}
      <Paddle x={46} y={83} len={15} deg={90} color={C.orange} />
      <Paddle x={50} y={13} len={15} deg={-90} color={C.blue} />
      <Ball x={30} y={70} r={4.5} ring={C.orange} />
      <Ball x={66} y={26} r={4.5} ring={C.blue} />
    </>
  ),
  jump: () => (
    <>
      <Bg fill={C.p1tint} />
      <rect x={0} y={74} width={96} height={22} fill={C.court} />
      <rect x={0} y={72} width={96} height={4} fill={C.kitchen} />
      <Trail d="M14 70 Q34 8 56 70" color={C.dark} />
      <MiniPikuru x={34} y={36} h={26} tilt={-8} />
      <Ball x={72} y={66} r={6} />
      <path d="M82 62 h8 M82 68 h6" stroke={C.dark} strokeWidth={2} strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={12 + i * 9} cy={12} r={3.4} fill={C.ball} stroke={C.dark} strokeWidth={1.3} />
      ))}
    </>
  ),
  lift: () => (
    <>
      <Bg fill={C.court} />
      <ellipse cx={46} cy={50} rx={7} ry={4} fill="rgba(0,0,0,0.35)" />
      <Paddle x={46} y={50} len={36} color={C.orange} />
      <Ball x={56} y={20} r={8} />
      <path d="M72 30 l4 -6 l4 6 M72 40 l4 -6 l4 6" fill="none" stroke={C.ball} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  catch: () => (
    <>
      <Bg fill="#dff0fb" />
      <rect x={0} y={84} width={96} height={12} fill={C.court} />
      <Ball x={42} y={30} r={9} />
      <circle cx={74} cy={18} r={8} fill="#dfe94a" stroke="#9aa52a" strokeWidth={1.4} />
      <path d="M67 14 q7 4 0 10 M81 12 q-7 6 0 12" fill="none" stroke="#fff" strokeWidth={1.8} />
      <path d="M22 60 H70 L64 84 H28 Z" fill="rgba(255,255,255,0.6)" stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" />
      {[32, 40, 48, 56, 64].map((x) => (
        <line key={x} x1={x - 1} y1={60} x2={x - 1 + (48 - x) * 0.12} y2={84} stroke={C.ink} strokeWidth={1} />
      ))}
      <line x1={24} y1={70} x2={68} y2={70} stroke={C.ink} strokeWidth={1} />
      <path d="M42 44 v8 M38 49 l4 4 l4 -4" fill="none" stroke={C.body} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  breakout: () => (
    <>
      <Bg fill={C.court} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((i) => {
          const pickle = (row === 0 && i === 2) || (row === 2 && i === 4) || (row === 1 && i === 0)
          return <rect key={`${row}-${i}`} x={9 + i * 16} y={12 + row * 10} width={14} height={8} rx={3} fill={pickle ? C.body : C.paper} stroke={C.dark} strokeWidth={1} />
        }),
      )}
      <Trail d="M46 76 L62 46" />
      <Ball x={64} y={44} r={5} />
      <Paddle x={46} y={83} len={16} deg={90} color={C.orange} />
    </>
  ),
  target: () => (
    <>
      <Bg fill={C.navy} />
      <rect x={20} y={14} width={56} height={74} fill={C.court} stroke={C.line} strokeWidth={1.6} />
      <rect x={20} y={38} width={56} height={14} fill={C.kitchen} stroke={C.line} strokeWidth={1.2} />
      <line x1={48} y1={14} x2={48} y2={38} stroke={C.line} strokeWidth={1.2} />
      <line x1={14} y1={52} x2={82} y2={52} stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" />
      <rect x={50} y={16} width={24} height={20} fill="rgba(212,240,60,0.45)" stroke={C.ball} strokeWidth={2} strokeDasharray="4 2" />
      <rect x={36} y={4} width={24} height={8} rx={3} fill={C.body} stroke={C.dark} strokeWidth={1.4} />
      <Trail d="M46 76 Q60 50 62 28" />
      <Ball x={62} y={26} r={5} />
      <Paddle x={42} y={80} len={13} deg={-15} color={C.orange} />
    </>
  ),
  pikuru: () => (
    <>
      <Bg fill={C.navy} />
      <Court x={24} y={8} w={48} h={80} />
      <MiniPikuru x={46} y={22} h={24} />
      <Paddle x={58} y={76} len={14} color={C.orange} />
      <Trail d="M56 66 Q66 52 58 40" />
      <Ball x={57} y={38} r={5} />
    </>
  ),
  linestop: () => (
    <>
      <Bg fill={C.court} />
      <rect x={0} y={56} width={96} height={40} fill={C.navy} />
      <rect x={0} y={52} width={96} height={7} fill={C.line} />
      <circle cx={42} cy={48} r={20} fill="rgba(255,255,255,0.12)" stroke={C.ink} strokeWidth={4} />
      <line x1={56} y1={62} x2={72} y2={80} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      <Ball x={42} y={47} r={8} />
      <circle cx={42} cy={51.5} r={2.2} fill="#ff3b3b" />
      <path d="M20 18 v12 M14 24 l6 6 l6 -6" fill="none" stroke={C.ball} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  curling: () => (
    <>
      <Bg fill={C.kitchen} />
      <circle cx={48} cy={42} r={28} fill={C.ball} stroke={C.dark} strokeWidth={2} />
      <circle cx={48} cy={42} r={18} fill="#fff" stroke={C.dark} strokeWidth={1.4} />
      <circle cx={48} cy={42} r={8} fill={C.orange} stroke={C.dark} strokeWidth={1.4} />
      <Ball x={58} y={36} r={5} ring={C.blue} />
      <path d="M34 80 L20 90 M40 82 L30 92" stroke="rgba(255,255,255,0.7)" strokeWidth={2.4} strokeLinecap="round" />
      <Ball x={42} y={76} r={5} ring={C.orange} />
    </>
  ),
  serveread: () => (
    <>
      <SplitBg />
      {[
        [8, '3'],
        [37, '2'],
        [66, '1'],
      ].map(([x, n]) => (
        <g key={n}>
          <rect x={Number(x)} y={40} width={22} height={30} rx={5} fill="#fff" stroke={C.dark} strokeWidth={2} />
          <text x={Number(x) + 11} y={62} textAnchor="middle" fontSize={17} fontWeight={900} fill={C.orange} fontFamily="'Zen Maru Gothic', sans-serif">
            {n}
          </text>
        </g>
      ))}
      <path d="M30 10 H66 A6 6 0 0 1 72 16 V28 A6 6 0 0 1 66 34 H52 L46 39 L44 34 H30 A6 6 0 0 1 24 28 V16 A6 6 0 0 1 30 10 Z" fill="#fff" stroke={C.dark} strokeWidth={2} />
      <text x={48} y={30} textAnchor="middle" fontSize={18} fontWeight={900} fill={C.dark} fontFamily="'Zen Maru Gothic', sans-serif">
        ？
      </text>
      <path d="M32 82 q4 4 8 0 M56 82 q4 4 8 0" fill="none" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
    </>
  ),
  reaction: () => (
    <>
      <Bg fill={C.paper} />
      <path d="M54 6 L28 50 H46 L38 90 L70 40 H52 L62 6 Z" fill={C.orange} stroke={C.dark} strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 34 h14 M4 44 h16 M10 54 h12" stroke={C.dark} strokeWidth={2.4} strokeLinecap="round" />
      <Ball x={30} y={44} r={8} />
      <Tap x={76} y={76} color={C.blue} />
    </>
  ),
  stop10: () => (
    <>
      <Bg fill={C.p1tint} />
      <Trail d="M10 84 Q48 -8 86 84" color={C.dark} />
      <Ball x={18} y={56} r={5} />
      <rect x={44} y={22} width={8} height={7} rx={2} fill={C.ink} />
      <circle cx={48} cy={56} r={26} fill="#fff" stroke={C.ink} strokeWidth={3.4} />
      <text x={48} y={66} textAnchor="middle" fontSize={26} fontWeight={900} fill={C.ink} fontFamily="'Zen Maru Gothic', sans-serif">
        10
      </text>
      <path d="M48 34 v4" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  nise: () => (
    <>
      <Bg fill="#efe6ff" />
      <MiniPikuru x={20} y={62} h={30} tilt={-6} />
      <MiniPikuru x={76} y={62} h={30} tilt={6} />
      <MiniPikuru x={48} y={60} h={38} />
      {/* まんなかの子は へんそう中（めがねと ひげ） */}
      <g fill="none" stroke={C.ink} strokeWidth={1.8}>
        <circle cx={43.4} cy={62.3} r={5.6} />
        <circle cx={52.6} cy={62.3} r={5.6} />
        <path d="M49 62 h-2" />
      </g>
      <path d="M40.5 69.5 q3.75 -3.4 7.5 0 q3.75 -3.4 7.5 0" fill="none" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M36 8 H60 A6 6 0 0 1 66 14 V26 A6 6 0 0 1 60 32 H52 L48 37 L44 32 H36 A6 6 0 0 1 30 26 V14 A6 6 0 0 1 36 8 Z" fill="#fff" stroke={C.dark} strokeWidth={2} />
      <text x={48} y={28} textAnchor="middle" fontSize={20} fontWeight={900} fill="#9b6bff" fontFamily="'Zen Maru Gothic', sans-serif">
        ？
      </text>
    </>
  ),
  gesture: () => (
    <>
      <Bg fill={C.p0tint} />
      {/* りょうてを ひろげて まねっこ（パドルは もたない）。うでは からだの よこから */}
      <g stroke={C.dark} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M26 66 Q18 60 13 47" />
        <path d="M52 66 Q60 60 64 47" />
      </g>
      <circle cx={13} cy={45} r={4.2} fill={C.body} stroke={C.dark} strokeWidth={2} />
      <circle cx={64} cy={45} r={4.2} fill={C.body} stroke={C.dark} strokeWidth={2} />
      <path d="M5 38 q3 -6 9 -8 M70 30 q6 2 8 8" fill="none" stroke={C.orange} strokeWidth={2.6} strokeLinecap="round" />
      <MiniPikuru x={39} y={68} h={40} />
      {/* こえは ださない（「…」の ふきだし） */}
      <path d="M24 10 H50 A5 5 0 0 1 55 15 V25 A5 5 0 0 1 50 30 H42 L38 35 L36 30 H24 A5 5 0 0 1 19 25 V15 A5 5 0 0 1 24 10 Z" fill="#fff" stroke={C.dark} strokeWidth={2} />
      {[30, 37, 44].map((x) => (
        <circle key={x} cx={x} cy={20} r={2.4} fill={C.dark} />
      ))}
      <path d="M68 52 H86 A5 5 0 0 1 91 57 V69 A5 5 0 0 1 86 74 H80 L74 80 L74 74 H68 A5 5 0 0 1 63 69 V57 A5 5 0 0 1 68 52 Z" fill="#fff" stroke={C.dark} strokeWidth={2} />
      <text x={77} y={69} textAnchor="middle" fontSize={14} fontWeight={900} fill={C.orange} fontFamily="'Zen Maru Gothic', sans-serif">
        ！？
      </text>
    </>
  ),
  ishin: () => (
    <>
      <Bg fill="#ffe3ef" />
      {/* ふたりの おもいが おなじ（ふきだしに おなじ ボール） */}
      {[26, 70].map((x) => (
        <g key={x}>
          <circle cx={x} cy={22} r={13} fill="#fff" stroke={C.dark} strokeWidth={2} />
          <circle cx={x + (x < 48 ? 6 : -6)} cy={38} r={2.6} fill="#fff" stroke={C.dark} strokeWidth={1.6} />
          <Ball x={x} y={22} r={7} />
        </g>
      ))}
      <path d="M48 52 c-3 -5 -10 -3 -8 3 c1 3 8 8 8 8 c0 0 7 -5 8 -8 c2 -6 -5 -8 -8 -3 Z" fill="#ff6fae" stroke="#c2185b" strokeWidth={1.4} />
      <MiniPikuru x={26} y={70} h={34} tilt={6} />
      <MiniPikuru x={70} y={70} h={34} tilt={-6} />
    </>
  ),
  sagasu: () => (
    <>
      <Bg fill="#cfe8a9" />
      <MiniPikuru x={18} y={30} h={22} tilt={-8} />
      <MiniPikuru x={78} y={26} h={22} tilt={8} />
      <MiniPikuru x={26} y={74} h={22} tilt={4} />
      <MiniPikuru x={74} y={76} h={22} tilt={-4} />
      {/* むしめがね */}
      <circle cx={46} cy={46} r={20} fill="rgba(255,255,255,0.55)" stroke={C.ink} strokeWidth={4} />
      <MiniPikuru x={46} y={47} h={22} />
      <path d="M60 60 L80 80" stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
    </>
  ),
  sagasu2: () => (
    <>
      <SplitBg />
      <MiniPikuru x={22} y={24} h={18} tilt={180} />
      <MiniPikuru x={72} y={22} h={18} tilt={172} />
      <MiniPikuru x={24} y={74} h={18} />
      <MiniPikuru x={74} y={72} h={18} tilt={6} />
      <circle cx={48} cy={48} r={14} fill="rgba(255,255,255,0.6)" stroke={C.ink} strokeWidth={3.4} />
      <MiniPikuru x={48} y={49} h={15} />
      <Tap x={74} y={72} color={C.orange} />
      <Tap x={72} y={22} color={C.blue} />
    </>
  ),
}

export function GameIcon({ game, size = 72 }: { game: GameId; size?: number }) {
  // 角を丸く切りぬく（同じ画面に何枚も出すので id は1枚ずつ別にする）
  const clip = `gi-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="game-icon" viewBox="0 0 96 96" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <clipPath id={clip}>
          <rect width={96} height={96} rx={22} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>{ICONS[game]()}</g>
      <rect x={1} y={1} width={94} height={94} rx={21} fill="none" stroke="rgba(18,48,43,0.18)" strokeWidth={2} />
    </svg>
  )
}

export const GAME_ICON_IDS = Object.keys(ICONS) as GameId[]
