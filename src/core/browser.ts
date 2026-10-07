/**
 * どのブラウザで開いているか（インスタなどのアプリの中のブラウザか・iPhone か Android か・ホーム画面から開いたか）。
 * インスタやスレッズのリンクから開くと、アプリの中のブラウザで開く。そこでは「ホーム画面に追加」ができず、
 * 記録（ほし・きせかえ）も ふだんのブラウザとは別に保存されるので、Safari・Chrome で開きなおす案内を出す。
 */
import { PUBLIC_URL, readSource } from './counter'

export type InApp = 'Instagram' | 'Threads' | 'Facebook' | 'LINE' | 'TikTok' | 'X' | 'アプリ'
export type Os = 'ios' | 'android' | 'other'

/** アプリの中のブラウザなら、そのアプリの名前（ふつうのブラウザなら null） */
export function inAppName(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): InApp | null {
  if (/Barcelona/i.test(ua)) return 'Threads'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook'
  if (/\bLine\//i.test(ua)) return 'LINE'
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'TikTok'
  if (/Twitter/i.test(ua)) return 'X'
  // Android の WebView（アプリの中のブラウザ）は「; wv)」が入る
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return 'アプリ'
  return null
}

export function osOf(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints): Os {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPad の Safari は Mac と名のる
  if (/Macintosh/i.test(ua) && touchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** ホーム画面から開いている（PWA） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

/**
 * ふつうのブラウザで開きなおすときのアドレス（どこから来たかの印は そのまま。開いたら案内のページ）。
 * Android の intent は # のあとを自分の設定に使うので、案内のページは # ではなく ?go=install で伝える
 */
export function reopenUrl(): string {
  const src = readSource() || 'inapp'
  return `${PUBLIC_URL}?src=${encodeURIComponent(src)}&go=install`
}

/** ?go=install で開かれたら、案内のページへ（アドレスからは消す） */
export function readGo(): void {
  try {
    const u = new URL(location.href)
    if (u.searchParams.get('go') !== 'install') return
    u.searchParams.delete('go')
    history.replaceState(history.state, '', `${u.pathname}${u.search}#/install`)
  } catch {
    // アドレスを書きかえられなくても続ける
  }
}

/**
 * アプリの中のブラウザから、ふつうのブラウザで開くリンク。
 * Android は Chrome を指定して開く（intent）。iPhone は Safari で開く（x-safari-https。iOS 17 以降）。
 * どちらも開けないことがあるので、画面には「…」から開く手順もいっしょに出す。
 */
export function externalOpenUrl(os: Os, url: string = reopenUrl()): string | null {
  const u = new URL(url)
  if (os === 'android') return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
  if (os === 'ios') return `x-safari-${url}`
  return null
}

/** Android の Chrome で「ホーム画面に追加」を アプリの中から出す（使えるときだけ） */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export const canPromptInstall = () => deferred !== null

export function onInstallPrompt(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const d = deferred
  deferred = null
  await d.prompt()
  const r = await d.userChoice
  listeners.forEach((l) => l())
  return r.outcome === 'accepted'
}
