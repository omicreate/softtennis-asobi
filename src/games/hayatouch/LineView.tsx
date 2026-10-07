/** ラインジャッジの拡大図（線と球のあと）。単位は cm */
import { BALL_R, LINE_W, REGION_NAME } from './lineJudge'
import type { LineCase, Region } from './lineJudge'

const FILL: Record<Region, string> = {
  court: '#2f5d9a',
  service: '#2f5d9a',
  target: '#2f5d9a',
  'other-service': '#24497a',
  kitchen: '#3d8f7a',
  out: '#183152',
}

const X0 = -16
const X1 = LINE_W + 16
const H = 19

export function LineView({ c }: { c: LineCase }) {
  const cy = H / 2 + 1
  return (
    <svg className="line-view" viewBox={`${X0} 0 ${X1 - X0} ${H}`} role="img" aria-label={`${c.scene}の ${c.line}。ボールの あと`}>
      <rect x={X0} y={0} width={-X0} height={H} fill={FILL[c.a]} />
      <rect x={LINE_W} y={0} width={X1 - LINE_W} height={H} fill={FILL[c.b]} />
      <rect x={0} y={0} width={LINE_W} height={H} fill="#ffffff" />
      <text x={X0 + 1} y={2.6} className="line-region">
        {REGION_NAME[c.a]}
      </text>
      <text x={X1 - 1} y={2.6} className="line-region" textAnchor="end">
        {REGION_NAME[c.b]}
      </text>
      {/* 球のあと（影＋球） */}
      <circle cx={c.center + 0.5} cy={cy + 0.6} r={BALL_R} fill="rgba(0,0,0,0.3)" />
      <circle cx={c.center} cy={cy} r={BALL_R} fill="#d4f03c" stroke="#2e5a1c" strokeWidth={0.45} />
      {[
        [-1.2, -1.1],
        [1.1, -1.2],
        [0.1, 1.3],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={c.center + dx} cy={cy + dy} r={0.55} fill="#2e5a1c" />
      ))}
    </svg>
  )
}
