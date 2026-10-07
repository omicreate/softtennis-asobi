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
  lift: () => (
    <>
      <Bg fill={C.court} />
      <ellipse cx={46} cy={50} rx={7} ry={4} fill="rgba(0,0,0,0.35)" />
      <Paddle x={46} y={50} len={36} color={C.orange} />
      <Ball x={56} y={20} r={8} />
      <path d="M72 30 l4 -6 l4 6 M72 40 l4 -6 l4 6" fill="none" stroke={C.ball} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
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
  reaction: () => (
    <>
      <Bg fill={C.paper} />
      <path d="M54 6 L28 50 H46 L38 90 L70 40 H52 L62 6 Z" fill={C.orange} stroke={C.dark} strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 34 h14 M4 44 h16 M10 54 h12" stroke={C.dark} strokeWidth={2.4} strokeLinecap="round" />
      <Ball x={30} y={44} r={8} />
      <Tap x={76} y={76} color={C.blue} />
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
