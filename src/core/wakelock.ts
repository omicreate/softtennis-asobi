import { useEffect } from 'react'

/** 遊んでいる間は画面を消さない（Wake Lock が使えない端末では何もしない） */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen')
          if (!alive) void lock.release()
        }
      } catch {
        // 電池残量が少ないときなどは断られる。そのままでよい
      }
    }
    // タブを切り替えると外れるので、戻ってきたら取り直す
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      if (lock) void lock.release().catch(() => {})
    }
  }, [])
}
