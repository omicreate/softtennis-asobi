/**
 * 1台を机に置いて、向かい合って遊ぶための舞台。
 * - いつも「縦長」の座標で作る。横向きの画面なら 90° 回して、長い辺が2人の間にくるようにする。
 * - 上半分（Side 1）の文字やボタンは 180° 回して、向かいの人から読めるようにする。
 */
import { createContext, useContext, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Side } from './players'

export interface StageInfo {
  /** 縦長の論理座標の幅と高さ（CSS px） */
  w: number
  h: number
  rotated: boolean
  /** 画面の座標（clientX/Y）を論理座標に直す */
  toLogical: (clientX: number, clientY: number) => { x: number; y: number }
}

const StageContext = createContext<StageInfo>({ w: 0, h: 0, rotated: false, toLogical: (x, y) => ({ x, y }) })

export const useStage = () => useContext(StageContext)

function viewport() {
  return { W: window.innerWidth, H: window.innerHeight }
}

/** rotate=false：手に持って遊ぶゲーム。画面は回さず、横向きならそのまま横長で使う */
export function Stage({ children, rotate = true }: { children: ReactNode; rotate?: boolean }) {
  const [vp, setVp] = useState(viewport)

  useEffect(() => {
    const onResize = () => setVp(viewport())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    // iOS は向きが変わった直後の寸法が古いことがあるので、少し待ってもう一度測る
    const id = window.setInterval(onResize, 1000)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.clearInterval(id)
    }
  }, [])

  const rotated = rotate && vp.W > vp.H
  const w = rotated ? vp.H : vp.W
  const h = rotated ? vp.W : vp.H
  const info: StageInfo = {
    w,
    h,
    rotated,
    // 90°回したとき：画面 (sx, sy) = (W - y, x) なので、逆に x = sy, y = W - sx
    toLogical: rotated ? (cx, cy) => ({ x: cy, y: vp.W - cx }) : (cx, cy) => ({ x: cx, y: cy }),
  }

  const style: CSSProperties = {
    width: w,
    height: h,
    transform: rotated ? `translate(${vp.W}px, 0) rotate(90deg)` : undefined,
  }

  return (
    <StageContext.Provider value={info}>
      <div className="stage" style={style} data-rotated={rotated || undefined}>
        {children}
      </div>
    </StageContext.Provider>
  )
}

/** 舞台の半分。上の人（side 1）のぶんは 180° 回す */
export function Half({ side, children, className = '', interactive = true }: { side: Side; children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div className={`half half-${side === 1 ? 'top' : 'bottom'} ${className}`} data-side={side} style={interactive ? undefined : { pointerEvents: 'none' }}>
      {children}
    </div>
  )
}

/** 同じものを上下両方に向けて出す（得点や勝ち負けの知らせ） */
export function Both({ children, className = '', interactive = false }: { children: (side: Side) => ReactNode; className?: string; interactive?: boolean }) {
  return (
    <>
      <Half side={1} className={className} interactive={interactive}>
        {children(1)}
      </Half>
      <Half side={0} className={className} interactive={interactive}>
        {children(0)}
      </Half>
    </>
  )
}
