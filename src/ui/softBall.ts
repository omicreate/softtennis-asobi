/**
 * 軟式球の絵（canvas）。空気の入ったゴムの球で、縫い目も穴もない（競技規則 第15条。公認球は白と黄）。
 * 硬式球（フェルトと縫い目）にもピックルボール（穴）にも見えないように、つるっとした球に光を1つだけ描く。
 */
export const SOFT_BALL = { fill: '#fff1a8', line: '#b39a3e' } as const

export function drawSoftBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = SOFT_BALL.fill
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.1)
  ctx.strokeStyle = SOFT_BALL.line
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.fill()
}
