/**
 * どのゲームが何回遊ばれたかを、匿名で数える（ソフトテニスIQと同じしくみ：Google Apps Script の受け口に送り、
 * 送り先はまだ決めていない（site.config.json の counterUrl が空のあいだは何も送らない。ソフトテニスIQの数値シートの GAS に足す予定）。
 *
 * 送るもの：できごとの種類（開いた・始めた・最後まで遊んだ・共有した）、ゲームの名前（例 jump）、
 *          どこから来たか（リンクの ?src= の印。例 st_ig_bio）、ホーム画面に追加して開いたか、アプリの版。
 * 送らないもの：名前・点数・写真・端末ID・Cookie・位置・前に見ていたページ（referrer）。
 * 送らないとき：集計先が未設定（site.config.json の counterUrl が空）／開発中／公開URL以外（試遊用の Artifact など）
 *              ／おうちの方へ で「送らない」にしたとき／ブラウザの「追跡しない」（DNT・GPC）がオンのとき。
 * 電波がないときは送らずに捨てる（あとでまとめて送ったりしない）。
 */
import site from '../../site.config.json'
import { getSettings } from './settings'

export const COUNTER_URL: string = site.counterUrl
export const PUBLIC_URL: string = site.publicUrl
/** アプリの版（集計で、直した前後を見分ける） */
export const APP_VERSION = '0.14.1'

export type CountEvent = 'open' | 'start' | 'finish' | 'share'

/** 公開URL（GitHub Pages）で開いているか */
export function onPublicSite(): boolean {
  try {
    return location.hostname === new URL(PUBLIC_URL).hostname
  } catch {
    return false
  }
}

/** いま送れる状態か（おうちの方へ に出す説明にも使う） */
export function counterStatus(): 'off-config' | 'off-site' | 'off-user' | 'off-dnt' | 'on' {
  if (!COUNTER_URL) return 'off-config'
  if (import.meta.env.DEV || !onPublicSite()) return 'off-site'
  if (!getSettings().counter) return 'off-user'
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return 'off-dnt'
  return 'on'
}

/** リンクの印（?src=）。英数字・ハイフン・下線だけ（40文字まで）。それ以外は使わない（集計シートへの数式の混入などを防ぐ） */
export function cleanSrc(v: string | null | undefined): string {
  return v && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : ''
}

const SRC_KEY = 'softtennis-asobi:src'
let src = ''

/**
 * はじめに1回：URL の ?src= を読んで覚え、アドレスからは消す（そのURLを人に送っても印が広がらないように）。
 * 同じタブで開き直したときは、覚えた印を使う。
 */
export function readSource(): string {
  try {
    const u = new URL(location.href)
    const fromUrl = cleanSrc(u.searchParams.get('src'))
    if (u.searchParams.has('src')) {
      u.searchParams.delete('src')
      history.replaceState(history.state, '', u.pathname + u.search + u.hash)
    }
    if (fromUrl) sessionStorage.setItem(SRC_KEY, fromUrl)
    src = fromUrl || cleanSrc(sessionStorage.getItem(SRC_KEY))
  } catch {
    src = ''
  }
  return src
}

/** ホーム画面に追加して（アプリとして）開いているか */
function standalone(): boolean {
  try {
    return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/** 送り先の URL（送らないときは null） */
export function countUrl(ev: CountEvent, game = ''): string | null {
  if (counterStatus() !== 'on') return null
  const q = new URLSearchParams({ app: 'softtennis-asobi', ev, v: APP_VERSION })
  if (game) q.set('game', game)
  if (src) q.set('src', src)
  if (ev === 'open') q.set('pwa', standalone() ? '1' : '0')
  return `${COUNTER_URL}?${q}`
}

function send(ev: CountEvent, game = ''): void {
  const url = countUrl(ev, game)
  if (!url) return
  try {
    // sendBeacon は本文なしの POST。受け口（GAS の doPost）は URL の引数だけを読む
    if (navigator.sendBeacon?.(url)) return
    void fetch(url, { mode: 'no-cors', credentials: 'omit', cache: 'no-store', keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => {})
  } catch {
    // 送れなくても遊びは続ける
  }
}

let opened = false

/** アプリを開いた（1回だけ） */
export function countOpen(): void {
  if (opened) return
  opened = true
  send('open')
}

/** ゲームを始めた（例 jump・party） */
export function countGame(id: string): void {
  send('start', id)
}

/** ゲームを最後まで遊んだ（結果の画面が出た） */
export function countFinish(id: string): void {
  send('finish', id)
}

/** きねんカードを共有した・保存した */
export function countShare(id: string): void {
  send('share', id)
}
