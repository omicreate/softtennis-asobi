// Claude の Artifact（非公開ページ）で試すための版を作る。GitHub Pages 用の dist/ とは別に出力する。
//   node scripts/build-artifact.mjs <出力先>
// Artifact の決まり：ページは中身だけ書く（doctype・head は向こうでつく）、書体は Google Fonts、Service Worker は使えない
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'

const out = process.argv[2]
if (!out) throw new Error('出力先を指定してください')
await build({ base: './', logLevel: 'warn', cacheDir: 'node_modules/.vite-artifact', build: { outDir: out, emptyOutDir: true } })

const html = readFileSync(join(out, 'index.html'), 'utf8')
const js = html.match(/<script[^>]*src="\.\/(assets\/[^"]+\.js)"/)[1]
const css = html.match(/<link[^>]*href="\.\/(assets\/[^"]+\.css)"/)[1]

// 同梱の書体（@font-face）を外して、Google Fonts の同じ書体を使う
const cssPath = join(out, css)
writeFileSync(cssPath, readFileSync(cssPath, 'utf8').replace(/@font-face\{[^}]*\}/g, ''))
for (const f of readdirSync(join(out, 'assets'))) if (/\.woff2?$/.test(f)) rmSync(join(out, 'assets', f))
for (const f of ['sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
  if (existsSync(join(out, f))) rmSync(join(out, f))
}

writeFileSync(
  join(out, 'index.html'),
  `<title>ホークアイ先生とあそぼ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap">
<link rel="stylesheet" href="${css}">
<div id="root"></div>
<script type="module" src="${js}"></script>
`,
)

const files = []
const walk = (dir) => {
  for (const f of readdirSync(join(out, dir))) {
    const rel = dir ? `${dir}/${f}` : f
    if (readdirSync(join(out), { withFileTypes: true }) && existsSync(join(out, rel)) && !f.includes('.')) walk(rel)
    else if (rel !== 'index.html') files.push(rel)
  }
}
walk('')
writeFileSync(join(out, 'files.json'), JSON.stringify(files, null, 1))
console.log(`artifact: ${files.length} files → ${out}`)
