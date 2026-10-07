/**
 * ピクルくん さがしの絵（SVG）。人・物は1つずつ要素にして、タップはブラウザの当たり判定にまかせる
 * （ふたりで遊ぶときの 180° 回した半分でも、座標の計算がいらない）。
 */
import type { ReactNode } from 'react'
import type { Band, Diff, Hat, Look, Person, Scene, Thing, Tone } from './sagasu'

const INK = '#12302b'
const DARK = '#2e5a1c'
const BAND: Record<Band, string> = { lime: '#d4f03c', orange: '#ff8a3d', blue: '#3d9be9', pink: '#ff6fae', white: '#ffffff', yellow: '#f5d300' }
const HAT: Record<Hat, string> = { red: '#e53935', blue: '#3d6fd9' }
const TONE: Record<Tone, string> = { green: '#6bb33f', dark: '#3f7f2a', olive: '#8fae3a' }

/** ピクルくん（とにせもの）。x,y は体の中心、s は高さ */
export function PersonFigure({ look, x, y, s, flip = false }: { look: Look; x: number; y: number; s: number; flip?: boolean }) {
  const w = s * 0.6
  const sw = Math.max(0.5, s * 0.06)
  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      <ellipse cx={0} cy={s * 0.52} rx={w * 0.55} ry={s * 0.07} fill="rgba(18,48,43,0.18)" />
      {look.stem && !look.hat && <path d={`M ${w * 0.05} ${-s / 2} q ${w * 0.1} ${-s * 0.2} ${w * 0.32} ${-s * 0.16}`} fill="none" stroke={DARK} strokeWidth={s * 0.07} strokeLinecap="round" />}
      <rect x={-w / 2} y={-s / 2} width={w} height={s} rx={w / 2} fill={TONE[look.body]} stroke={DARK} strokeWidth={sw} />
      <rect x={-w / 2 + sw / 2} y={-s * 0.25} width={w - sw} height={s * 0.15} fill={BAND[look.band]} stroke={DARK} strokeWidth={sw * 0.6} />
      {[-1, 1].map((k) => (
        <g key={k}>
          <circle cx={k * w * 0.2} cy={s * 0.05} r={s * 0.1} fill="#fff" stroke={DARK} strokeWidth={sw * 0.5} />
          <circle cx={k * w * 0.2 + s * 0.02} cy={s * 0.06} r={s * 0.05} fill={INK} />
        </g>
      ))}
      {look.glasses && (
        <g fill="none" stroke={INK} strokeWidth={sw * 0.8}>
          <circle cx={-w * 0.2} cy={s * 0.05} r={s * 0.13} />
          <circle cx={w * 0.2} cy={s * 0.05} r={s * 0.13} />
          <path d={`M ${-w * 0.2 + s * 0.13} ${s * 0.05} H ${w * 0.2 - s * 0.13}`} />
        </g>
      )}
      {look.mustache ? (
        <path d={`M ${-w * 0.28} ${s * 0.27} q ${w * 0.14} ${-s * 0.1} ${w * 0.28} 0 q ${w * 0.14} ${-s * 0.1} ${w * 0.28} 0`} fill="none" stroke={INK} strokeWidth={sw * 1.4} strokeLinecap="round" />
      ) : (
        <path d={`M ${-w * 0.15} ${s * 0.25} q ${w * 0.15} ${s * 0.1} ${w * 0.3} 0`} fill="none" stroke={DARK} strokeWidth={sw * 0.8} strokeLinecap="round" />
      )}
      {look.hat && (
        <g>
          <path d={`M ${-w * 0.52} ${-s * 0.3} Q ${-w * 0.5} ${-s * 0.68} 0 ${-s * 0.68} Q ${w * 0.5} ${-s * 0.68} ${w * 0.52} ${-s * 0.3} Z`} fill={HAT[look.hat]} stroke={DARK} strokeWidth={sw * 0.7} />
          <path d={`M ${w * 0.3} ${-s * 0.32} H ${w * 0.95}`} stroke={HAT[look.hat]} strokeWidth={s * 0.08} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

function ThingFigure({ t }: { t: Thing }) {
  const s = t.s
  let body: ReactNode
  if (t.kind === 'ball') {
    body = (
      <g>
        <circle r={s / 2} fill={t.color} stroke={DARK} strokeWidth={s * 0.08} />
        {[
          [-0.18, -0.12],
          [0.16, -0.14],
          [0.02, 0.2],
        ].map(([dx, dy], i) => (
          <circle key={i} cx={dx * s} cy={dy * s} r={s * 0.075} fill={DARK} />
        ))}
      </g>
    )
  } else if (t.kind === 'paddle') {
    body = (
      <g>
        <rect x={-s * 0.06} y={s * 0.2} width={s * 0.12} height={s * 0.3} rx={s * 0.05} fill={DARK} />
        <rect x={-s * 0.25} y={-s * 0.5} width={s * 0.5} height={s * 0.72} rx={s * 0.18} fill={t.color} stroke={DARK} strokeWidth={s * 0.05} />
      </g>
    )
  } else if (t.kind === 'cone') {
    body = (
      <g>
        <path d={`M 0 ${-s * 0.5} L ${s * 0.32} ${s * 0.4} H ${-s * 0.32} Z`} fill={t.color} stroke={DARK} strokeWidth={s * 0.05} strokeLinejoin="round" />
        <path d={`M ${-s * 0.17} ${0} H ${s * 0.17}`} stroke="#fff" strokeWidth={s * 0.1} />
        <rect x={-s * 0.42} y={s * 0.38} width={s * 0.84} height={s * 0.1} rx={s * 0.04} fill={t.color} stroke={DARK} strokeWidth={s * 0.04} />
      </g>
    )
  } else {
    body = (
      <g>
        <rect x={-s * 0.18} y={-s * 0.35} width={s * 0.36} height={s * 0.8} rx={s * 0.08} fill={t.color} stroke={DARK} strokeWidth={s * 0.05} />
        <rect x={-s * 0.1} y={-s * 0.5} width={s * 0.2} height={s * 0.17} rx={s * 0.04} fill="#fff" stroke={DARK} strokeWidth={s * 0.04} />
      </g>
    )
  }
  return <g transform={`translate(${t.x} ${t.y}) rotate(${t.kind === 'ball' ? 0 : (t.rot % 60) - 30})`}>{body}</g>
}

/** 公園とコート（コートは縦長。キッチンは ネットの両側） */
function Ground({ scene }: { scene: Scene }) {
  const c = scene.court
  const mid = c.y + c.h / 2
  const lw = Math.max(0.35, c.w * 0.012)
  return (
    <g>
      <rect width={scene.w} height={scene.h} fill="#cfe8a9" />
      {[
        [8, 10],
        [scene.w - 9, scene.h * 0.18],
        [10, scene.h - 12],
        [scene.w - 10, scene.h - 9],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={6} fill="#a9d47a" />
      ))}
      <rect x={c.x - 2} y={c.y - 2} width={c.w + 4} height={c.h + 4} rx={1.5} fill="#24497a" />
      <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#2f5d9a" stroke="#fff" strokeWidth={lw} />
      <rect x={c.x} y={mid - c.k} width={c.w} height={c.k * 2} fill={scene.kitchenColor} stroke="#fff" strokeWidth={lw} />
      <line x1={c.x + c.w / 2} y1={c.y} x2={c.x + c.w / 2} y2={mid - c.k} stroke="#fff" strokeWidth={lw} />
      <line x1={c.x + c.w / 2} y1={mid + c.k} x2={c.x + c.w / 2} y2={c.y + c.h} stroke="#fff" strokeWidth={lw} />
      {scene.net && (
        <g>
          <line x1={c.x - 2.5} y1={mid} x2={c.x + c.w + 2.5} y2={mid} stroke={INK} strokeWidth={lw * 2.6} strokeLinecap="round" />
          <circle cx={c.x - 2.5} cy={mid} r={lw * 2} fill={INK} />
          <circle cx={c.x + c.w + 2.5} cy={mid} r={lw * 2} fill={INK} />
        </g>
      )}
    </g>
  )
}

export interface SceneSvgProps {
  scene: Scene
  /** 人をタップ（さがせ！ピクルくん） */
  onPerson?: (id: string) => void
  /** まちがいの丸をタップ（まちがいさがし） */
  diffs?: Diff[]
  found?: Set<string>
  onDiff?: (id: string) => void
  /** なにもない所をタップ */
  onMiss?: () => void
  /** 見つけた人を丸でかこむ */
  ring?: string | null
  /** ヒントの丸 */
  hint?: Diff | null
  disabled?: boolean
  testId?: string
}

export function SceneSvg({ scene, onPerson, diffs = [], found, onDiff, onMiss, ring, hint, disabled = false, testId }: SceneSvgProps) {
  // 奥（上）から順にかく
  const items = [
    ...scene.things.map((t) => ({ y: t.y, el: <ThingFigure key={t.id} t={t} /> })),
    ...scene.people.map((p: Person) => ({
      y: p.y,
      el: (
        <g
          key={p.id}
          className="sagasu-person"
          data-person={p.id}
          onPointerDown={(e) => {
            if (disabled || !onPerson) return
            e.stopPropagation()
            onPerson(p.id)
          }}
        >
          <PersonFigure look={p.look} x={p.x} y={p.y} s={p.s} flip={p.flip} />
          {/* 小さい子の指でも当たるよう、体より少し大きい当たり */}
          <rect x={p.x - p.s * 0.42} y={p.y - p.s * 0.7} width={p.s * 0.84} height={p.s * 1.3} fill="transparent" />
        </g>
      ),
    })),
  ].sort((a, b) => a.y - b.y)
  const ringP = ring ? scene.people.find((p) => p.id === ring) : undefined
  return (
    <svg
      className="sagasu-svg"
      viewBox={`0 0 ${scene.w} ${scene.h}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid={testId}
      onPointerDown={() => {
        if (!disabled) onMiss?.()
      }}
    >
      <Ground scene={scene} />
      {items.map((x) => x.el)}
      {onDiff &&
        diffs.map((d) =>
          found?.has(d.id) ? null : (
            <circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="transparent"
              data-diff={d.id}
              onPointerDown={(e) => {
                if (disabled) return
                e.stopPropagation()
                onDiff(d.id)
              }}
            />
          ),
        )}
      {diffs
        .filter((d) => found?.has(d.id))
        .map((d) => (
          <circle key={`f-${d.id}`} className="sagasu-found" cx={d.x} cy={d.y} r={d.r} fill="none" stroke="#ff3d7f" strokeWidth={1.2} pointerEvents="none" />
        ))}
      {hint && <circle className="sagasu-hint" cx={hint.x} cy={hint.y} r={hint.r * 1.8} fill="none" stroke="#ff8a3d" strokeWidth={1} strokeDasharray="2 2" pointerEvents="none" />}
      {ringP && <circle className="sagasu-ring" cx={ringP.x} cy={ringP.y} r={ringP.s * 0.85} fill="none" stroke="#ff3d7f" strokeWidth={Math.max(0.8, ringP.s * 0.08)} pointerEvents="none" />}
    </svg>
  )
}

/** これが ほんもの！ のカード（人1人を大きく） */
export function TargetCard({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <rect width={40} height={40} rx={8} fill="#fff6e3" />
      <PersonFigure look={{ band: 'lime', stem: true, glasses: false, mustache: false, hat: null, body: 'green' }} x={20} y={22} s={26} />
    </svg>
  )
}
