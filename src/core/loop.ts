import { useEffect, useRef } from 'react'

/**
 * 毎フレーム呼ぶ。dt は秒。タブを離れて戻ったときに大きく飛ばないよう 0.05 秒で切る。
 * 最初のフレームの時刻は、登録したときより少し前のことがある（dt がマイナスになる）ので 0 にそろえる。
 */
export function useFrame(cb: (dt: number, now: number) => void): void {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    let id = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      ref.current(dt, now)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
}
