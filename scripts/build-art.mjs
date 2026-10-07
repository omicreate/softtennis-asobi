// art/ のピクルくんの原画から、アプリで使う画像を作る（Playwright の Chromium で描画）
//   表情4つ（faces_sheet.png の丸を切り出す）→ public/pikuru/{think,ok,eh,oops}.png
//   アイコン（icon_640.png）→ public/icon-*.png・apple-touch-icon.png
//   全身（fullbody_640.png）→ public/pikuru/fullbody.png
//   背景を抜いたもの → public/pikuru/cut-*.png（ゲームの中に出す）
import { chromium } from '@playwright/test'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const path = (rel) => new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const dataUrl = (rel) => `data:image/png;base64,${readFileSync(path(rel)).toString('base64')}`
const CREAM = '#ffe7b8'

const browser = await chromium.launch()
const page = await browser.newPage()

// 表情：1336×417 の中に、直径280px の丸が4つ横に並んでいる（中心 x=188,508,828,1148 / y=180）
const sheet = dataUrl('art/faces_sheet.png')
const faces = ['think', 'ok', 'eh', 'oops']
const D = 284
for (const [i, name] of faces.entries()) {
  const cx = 188 + i * 320
  const cy = 180
  await page.setViewportSize({ width: D, height: D })
  await page.setContent(
    `<style>*{margin:0}body{background:transparent}</style>
     <div style="width:${D}px;height:${D}px;border-radius:50%;background:url(${sheet}) ${-(cx - D / 2)}px ${-(cy - D / 2)}px no-repeat"></div>`,
  )
  await page.screenshot({ path: path(`public/pikuru/${name}.png`), omitBackground: true })
}

// アイコン：maskable は丸く切られても顔が残るよう、クリームの余白をつける
const icon = dataUrl('art/icon_640.png')
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-maskable-192.png', 192, 0.14],
  ['icon-maskable-512.png', 512, 0.14],
]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = size * (1 - pad * 2)
  await page.setContent(
    `<style>*{margin:0}</style>
     <div style="width:${size}px;height:${size}px;background:${CREAM};display:grid;place-items:center">
       <img src="${icon}" style="width:${inner}px;height:${inner}px;display:block"></div>`,
  )
  await page.screenshot({ path: path(`public/${name}`) })
}

// 背景を抜いたピクルくん（ゲームの中に出すため）
//   表情4つ → public/pikuru/cut-{think,ok,eh,oops}.png、全身 → public/pikuru/cut-full.png
// 丸の背景色を、丸のふちから塗りつぶすように消す（ヘッドバンドのライムと同じ色の背景でも、輪郭の内側は残る）
await page.setViewportSize({ width: 800, height: 800 })
await page.setContent('<canvas id=c></canvas>')
const cut = (src, sx, sy, sw, sh, mode, clear = null) =>
  page.evaluate(
    async ({ src, sx, sy, sw, sh, mode, clear }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = sw
      c.height = sh
      const g = c.getContext('2d')
      g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      const d = g.getImageData(0, 0, sw, sh)
      const px = d.data
      const at = (x, y) => (y * sw + x) * 4
      const dist = (i, c) => Math.hypot(px[i] - c[0], px[i + 1] - c[1], px[i + 2] - c[2])
      const bgMask = new Uint8Array(sw * sh)
      const seeds = []
      let bg
      if (mode === 'circle') {
        // 丸の外は消し、丸のふちのすぐ内側の色を背景色とする
        const cx = sw / 2
        const cy = sh / 2
        const R = sw / 2 - 3
        for (let y = 0; y < sh; y++)
          for (let x = 0; x < sw; x++) if (Math.hypot(x - cx, y - cy) > R) px[at(x, y) + 3] = 0
        bg = [...px.slice(at(Math.round(cx - R + 6), Math.round(cy)), at(Math.round(cx - R + 6), Math.round(cy)) + 3)]
        for (let a = 0; a < 360; a += 1) {
          const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * (R - 5))
          const y = Math.round(cy + Math.sin((a * Math.PI) / 180) * (R - 5))
          seeds.push([x, y])
        }
      } else {
        bg = [...px.slice(0, 3)]
        for (let x = 0; x < sw; x++) seeds.push([x, 0], [x, sh - 1])
        for (let y = 0; y < sh; y++) seeds.push([0, y], [sw - 1, y])
      }
      const TOL = 46
      const stack = seeds.filter(([x, y]) => dist(at(x, y), bg) < TOL)
      while (stack.length) {
        const [x, y] = stack.pop()
        if (x < 0 || y < 0 || x >= sw || y >= sh) continue
        const k = y * sw + x
        if (bgMask[k]) continue
        const i = at(x, y)
        if (px[i + 3] === 0 || dist(i, bg) >= TOL) continue
        bgMask[k] = 1
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
      }
      // 背景は透明に。背景のとなりの中間色は、背景色との近さに応じてうすくする（ふちのにじみを残さない）
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const k = y * sw + x
          const i = k * 4
          if (bgMask[k]) {
            px[i + 3] = 0
            continue
          }
          if (px[i + 3] === 0) continue
          const near = (bgMask[k - 1] || bgMask[k + 1] || bgMask[k - sw] || bgMask[k + sw]) === 1
          if (near) px[i + 3] = Math.round(255 * Math.min(1, dist(i, bg) / 140))
          // 全身の絵は、まわりから閉じた所に残ったクリームも消す
          if (mode === 'full' && dist(i, bg) < 14) px[i + 3] = 0
        }
      // 消したい所（走る絵では、飛んでいるボールと線を消す）
      for (const r of clear ?? []) for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) px[at(x, y) + 3] = 0
      g.putImageData(d, 0, 0)
      // 見えている所だけに切りつめる
      let x0 = sw
      let y0 = sh
      let x1 = 0
      let y1 = 0
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++)
          if (px[at(x, y) + 3] > 8) {
            x0 = Math.min(x0, x)
            y0 = Math.min(y0, y)
            x1 = Math.max(x1, x)
            y1 = Math.max(y1, y)
          }
      const o = document.createElement('canvas')
      o.width = x1 - x0 + 5
      o.height = y1 - y0 + 5
      o.getContext('2d').drawImage(c, x0 - 2, y0 - 2, o.width, o.height, 0, 0, o.width, o.height)
      return o.toDataURL('image/png')
    },
    { src, sx, sy, sw, sh, mode, clear },
  )
const writeData = (rel, url) => writeFileSync(path(rel), Buffer.from(url.split(',')[1], 'base64'))
for (const [i, name] of faces.entries()) {
  const cx = 188 + i * 320
  writeData(`public/pikuru/cut-${name}.png`, await cut(sheet, cx - 140, 180 - 140, 280, 280, 'circle'))
}
writeData('public/pikuru/cut-full.png', await cut(dataUrl('art/fullbody_640.png'), 0, 0, 640, 640, 'full'))
// 走る絵：右上のボールと動きの線を消す（ジャンプのゲームで、飛んでくる球とまちがえないように）
writeData(
  'public/pikuru/cut-run.png',
  await cut(dataUrl('art/fullbody_640.png'), 0, 0, 640, 640, 'full', [
    [462, 90, 640, 160],
    [505, 90, 640, 196],
  ]),
)

await browser.close()
copyFileSync(path('art/fullbody_640.png'), path('public/pikuru/fullbody.png'))
console.log('art written')
