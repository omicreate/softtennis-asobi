/** 遊んだ時間をはかる（一時停止中・画面を見ていないときは数えない）。「きゅうけい しよう」の声かけに使う */
import { useEffect, useRef } from 'react'
import { addPlayed } from './playtime'

export function usePlayClock(paused: boolean): void {
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current && document.visibilityState === 'visible') addPlayed(1)
    }, 1000)
    return () => clearInterval(id)
  }, [])
}
