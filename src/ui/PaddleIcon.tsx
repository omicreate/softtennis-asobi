/** ラケットの見本（コレクション・ラケットえらび）と、ラケットをえらぶ画面 */
import { useEffect, useRef } from 'react'
import { owns, useProgress } from '../core/progress'
import { sfx } from '../core/sound'
import { DESIGNS, drawPaddleArt, SHAPES } from './paddleArt'
import type { DesignId, PaddleLook, PaddleShape } from './paddleArt'
import './picker.css'

/** 正方形の中に、ラケットをななめ（先が右上）に描く */
export function PaddleIcon({ look, size = 64, className }: { look: PaddleLook; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    c.width = Math.round(size * dpr)
    c.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const shape = SHAPES[look.shape]
    // 握りを入れた全体の長さと面の幅が、正方形の対角線に入るように
    const faceLen = (size * 0.84) / (1 + shape.grip)
    const a = -Math.PI / 4
    const shift = (faceLen * shape.grip) / 2
    drawPaddleArt(ctx, { x: size / 2 + Math.cos(a) * shift, y: size / 2 + Math.sin(a) * shift, faceLen, angle: a, look })
  }, [look, size])
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} role="img" aria-label={`${DESIGNS[look.design].label}の ラケット（${SHAPES[look.shape].label}）`} />
}

/** 持っている色・もよう と かたち から えらぶ */
export function PaddlePicker({ value, onChange, onClose }: { value: PaddleLook; onChange: (look: PaddleLook) => void; onClose: () => void }) {
  const progress = useProgress()
  const designs = (Object.keys(DESIGNS) as DesignId[]).filter((d) => owns(`design:${d}`, progress))
  const shapes = (Object.keys(SHAPES) as PaddleShape[]).filter((s) => owns(`shape:${s}`, progress))
  const pick = (look: PaddleLook) => {
    sfx.tick()
    onChange(look)
  }
  return (
    <div className="picker" role="dialog" aria-label="ラケットを えらぶ" data-testid="paddle-picker">
      <div className="picker-head">
        <PaddleIcon look={value} size={56} />
        <span className="picker-title">ラケットを えらぶ</span>
        <button className="btn btn-small btn-go" onClick={onClose}>
          OK
        </button>
      </div>
      <div className="picker-grid" role="radiogroup" aria-label="いろ・もよう">
        {designs.map((d) => (
          <button key={d} className="picker-item" role="radio" aria-checked={value.design === d} onClick={() => pick({ ...value, design: d })}>
            <PaddleIcon look={{ design: d, shape: value.shape }} size={44} />
            <span>{DESIGNS[d].label}</span>
          </button>
        ))}
      </div>
      {shapes.length > 1 && (
        <div className="picker-grid picker-shapes" role="radiogroup" aria-label="かたち">
          {shapes.map((s) => (
            <button key={s} className="picker-item" role="radio" aria-checked={value.shape === s} onClick={() => pick({ ...value, shape: s })}>
              <PaddleIcon look={{ design: value.design, shape: s }} size={44} />
              <span>{SHAPES[s].label}</span>
            </button>
          ))}
        </div>
      )}
      <a className="picker-more" href="#/collection">
        ⭐ ほしで あたらしい ラケットと こうかん →
      </a>
    </div>
  )
}
