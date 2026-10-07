// OGP 画像（public/ogp.png・1200×630）を作る。開発サーバー（npm run dev -- --port 5180）を起動してから node scripts/build-ogp.mjs public
// OGP 画像（1200×630）を作る：アプリの画面に重ねて描き、同梱の書体で撮る
import { chromium } from '@playwright/test'
const OUT = process.argv[2]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('pickle-asobi:settings', JSON.stringify({ sound: false, speak: false }))
  localStorage.setItem('pickle-asobi:progress', JSON.stringify({ stars: 3, owned: [], wear: {}, plays: {}, days: [], mission: { day: 'x', progress: [0,0,0], done: [false,false,false], bonus: false }, cleared: 0, parties: 0, best: {}, medals: {}, recent: [] }))
})
await page.goto('http://localhost:5180/pickle-asobi/')
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const pick = ['rally', 'tug', 'quiz', 'jump', 'curling', 'serveread']
  const icons = pick.map((id) => {
    const svg = document.querySelector(`.game-card[data-game=${id}] .game-icon`).cloneNode(true)
    svg.setAttribute('width', '92'); svg.setAttribute('height', '92')
    return svg.outerHTML
  }).join('')
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#ffe7b8;display:flex;align-items:center;gap:24px;padding:0 48px;font-family:"Zen Maru Gothic",sans-serif;color:#12302b'
  box.innerHTML = `
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 18% 50%, #fff6e3 0, #ffe7b8 60%)"></div>
    <img src="/pickle-asobi/hawk/cut-full.png" style="position:relative;height:470px;flex:none">
    <div style="position:relative;display:flex;flex-direction:column;gap:18px">
      <div style="font-size:30px;font-weight:900;color:#c4570f">親子・なかまで 1台を かこんで</div>
      <div style="font-size:76px;font-weight:900;line-height:1.05;color:#2e5a1c;white-space:nowrap">ピクルくんとあそぼ</div>
      <div style="font-size:30px;font-weight:900">ピックルボールの ミニゲーム 18本</div>
      <div style="display:flex;gap:14px;margin-top:6px">${icons}</div>
      <div style="font-size:22px;font-weight:700;color:#4f6a5f">むりょう・インストール いらず・ひとりでも みんなでも</div>
    </div>`
  document.body.appendChild(box)
})
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/ogp.png` })
await browser.close()
console.log('ok')
