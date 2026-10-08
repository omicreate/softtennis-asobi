/** ラインジャッジの拡大図（線と球のあと）。単位は cm */
import { BALL_R, LINE_W, REGION_NAME } from './lineJudge'
import type { LineCase, Region } from './lineJudge'

const FILL: Record<Region, string> = {
  court: '#2f8a5f',
  service: '#2f8a5f',
  target: '#2f8a5f',
  'other-service': '#1f5a42',
  back: '#2a7656',
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
      {/* 軟式球（縫い目のないゴムの球） */}
      <circle cx={c.center} cy={cy} r={BALL_R} fill="#fff1a8" stroke="#b39a3e" strokeWidth={0.4} />
      <circle cx={c.center - 1.1} cy={cy - 1.1} r={0.9} fill="rgba(255,255,255,0.75)" />
    </svg>
  )
}
