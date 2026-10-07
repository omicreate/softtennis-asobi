import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { readGo, watchInstallPrompt } from './core/browser'
import { countOpen, readSource } from './core/counter'
import { loadVoices } from './core/speak'
import { preloadHawk } from './ui/hawkArt'
// 書体はアプリに同梱する（電波のない場所でも同じ見た目にするため）
import '@fontsource/zen-maru-gothic/700.css'
import '@fontsource/zen-maru-gothic/900.css'
import './design/base.css'

// どこから来たか（?src=）を読んでアドレスから消し、開いたことを1回だけ数える（共有リンクで ゲームの画面から入ったときも）
readGo()
readSource()
countOpen()
watchInstallPrompt()
void loadVoices()
preloadHawk()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// iOS Safari はピンチやダブルタップで拡大してしまうので止める（遊んでいる最中に画面がずれないように）
document.addEventListener('gesturestart', (e) => e.preventDefault())

// PWA: 本番ビルドのみ Service Worker を登録（開発時はキャッシュが邪魔になるため除外）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
