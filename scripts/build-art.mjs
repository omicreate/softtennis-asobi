// art/ のホークアイ先生の原画から、アプリで使う画像を作る（Playwright の Chromium で描画）。
// 原画は描き直さない（本人の方針）。背景が透明なので、余白を切りつめて大きさをそろえるだけ。
//   ゲームの中に出す絵 → public/hawk/cut-{think,ok,eh,oops,full,run}.png
//   丸い顔（ホームのカード・スタンプなど） → public/hawk/{think,ok,eh,oops}.png
//   アイコン（art/icon.png の丸の中） → public/icon-*.png・apple-touch-icon.png
//   絵の大きさ → src/ui/artSize.json
// 表情の原画がまだ無いものは、ある絵で代わりにする（FALLBACK）。原画が届いたら art/ に置いて npm run art。
import { chromium } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const path = (rel) => new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const dataUrl = (rel) => `data:image/png;base64,${readFileSync(path(rel)).toString('base64')}`
const CREAM = '#fff3d9'
/** ゲームの中に出す絵の高さ（px）。表示は CSS で縮める */
const CUT_H = 420

/** 絵の名前 → 原画（無ければ代わりの絵） */
const ARTS = ['think', 'ok', 'eh', 'oops', 'full', 'run']
const FALLBACK = { eh: 'think', oops: 'ok', run: 'full' }
const source = (name) => (existsSync(path(`art/${name}.png`)) ? name : FALLBACK[name])

/** 丸い顔に使う範囲（原画の上の、頭のまわりの正方形 [x, y, 一辺]） */
const FACE_BOX = {
  ok: [150, 0, 640],
  think: [190, 230, 680],
  full: [170, 280, 680],
  // ChatGPT で本人が作った表情（1024×1536・胸から上）
  eh: [110, 90, 900],
  oops: [130, 80, 900],
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 800, height: 800 })
await page.setContent('<canvas id=c></canvas>')

/** 透明な余白を切りつめ、高さを h にそろえる */
const trim = (src, h) =>
  page.evaluate(
    async ({ src, h }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0)
      const { data } = g.getImageData(0, 0, c.width, c.height)
      let x0 = c.width
      let y0 = c.height
      let x1 = 0
      let y1 = 0
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
          if (data[(y * c.width + x) * 4 + 3] > 8) {
            x0 = Math.min(x0, x)
            y0 = Math.min(y0, y)
            x1 = Math.max(x1, x)
            y1 = Math.max(y1, y)
          }
      const sw = x1 - x0 + 1
      const sh = y1 - y0 + 1
      const o = document.createElement('canvas')
      o.height = h
      o.width = Math.round((sw * h) / sh)
      const og = o.getContext('2d')
      og.imageSmoothingQuality = 'high'
      og.drawImage(c, x0, y0, sw, sh, 0, 0, o.width, o.height)
      return { url: o.toDataURL('image/png'), w: o.width, h: o.height }
    },
    { src, h },
  )

/** 原画の正方形の範囲を、クリームの丸に入れる */
const face = (src, [x, y, s], size) =>
  page.evaluate(
    async ({ src, x, y, s, size, cream }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const o = document.createElement('canvas')
      o.width = size
      o.height = size
      const g = o.getContext('2d')
      g.beginPath()
      g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      g.fillStyle = cream
      g.fill()
      g.clip()
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, x, y, s, s, 0, 0, size, size)
      return o.toDataURL('image/png')
    },
    { src, x, y, s, size, cream: CREAM },
  )

const writeData = (rel, url) => writeFileSync(path(rel), Buffer.from(url.split(',')[1], 'base64'))

const sizes = {}
for (const name of ARTS) {
  const r = await trim(dataUrl(`art/${source(name)}.png`), CUT_H)
  writeData(`public/hawk/cut-${name}.png`, r.url)
  sizes[name] = [r.w, r.h]
}
writeFileSync(path('src/ui/artSize.json'), JSON.stringify(sizes, null, 2) + '\n')

for (const name of ['think', 'ok', 'eh', 'oops']) {
  const from = source(name)
  writeData(`public/hawk/${name}.png`, await face(dataUrl(`art/${from}.png`), FACE_BOX[from] ?? FACE_BOX.ok, 284))
}

// アイコン：art/icon.png（白地に黒い丸）の丸の中を使う。maskable は丸く切られても顔が残るよう、クリームの余白をつける
const icon = dataUrl('art/icon.png')
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-maskable-192.png', 192, 0.12],
  ['icon-maskable-512.png', 512, 0.12],
]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = size * (1 - pad * 2)
  // 原画の丸は 中心(500,500)・半径およそ455。黒い輪の内側（70〜930）を入れる
  const k = inner / 860
  await page.setContent(
    `<style>*{margin:0}</style>
     <div style="width:${size}px;height:${size}px;background:${CREAM};display:grid;place-items:center">
       <div style="width:${inner}px;height:${inner}px;border-radius:50%;overflow:hidden;background:#fff">
         <img src="${icon}" style="display:block;width:${1000 * k}px;height:${1000 * k}px;margin:${-70 * k}px 0 0 ${-70 * k}px"></div></div>`,
  )
  await page.screenshot({ path: path(`public/${name}`) })
}

await browser.close()
console.log('art written', sizes)
