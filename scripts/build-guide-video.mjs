// 説明動画「インスタから開いた方へ：ホーム画面に入れる方法」（縦 1080×1920・30fps）を作る。
//   1) 開発サーバーを 5180 番で起動しておく（npm run dev -- --port 5180）
//   2) node scripts/build-guide-video.mjs [出力先.mp4]   … 既定は out/guide-install.mp4
// 台本は src/shell/guideScenes.ts、画面は #/dev/guide（src/shell/DevGuide.tsx）。
// ナレーションは ElevenLabs（.env の鍵と声。scripts/build-voice.mjs と同じ。鍵は表示しない）。out/guide/voice/ にためて二度課金しない。
// ffmpeg / ffprobe は FFMPEG・FFPROBE か、となりの pb-studio の ffmpeg-static / ffprobe-static を使う。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = new URL('../', import.meta.url)
const path = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Z]:)/, '$1')
const OUT = process.argv[2] ?? path('out/guide-install.mp4')
const DIR = path('out/guide/')
const FRAMES = `${DIR}frames/`
const VOICE = `${DIR}voice/`
const FPS = 15
const FFMPEG = process.env.FFMPEG || path('../pb-studio/node_modules/ffmpeg-static/ffmpeg.exe')
const FFPROBE = process.env.FFPROBE || path('../pb-studio/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
for (const [name, p] of [
  ['ffmpeg', FFMPEG],
  ['ffprobe', FFPROBE],
]) {
  if (!existsSync(p)) {
    console.error(`${name} が見つかりません（${p}）。環境変数 ${name.toUpperCase()} で場所を教えてください`)
    process.exit(1)
  }
}

// .env を読む（値は表示しない）
const env = { ...process.env }
for (const file of ['.env', '../st-studio/.env']) {
  if (!existsSync(path(file))) continue
  for (const line of readFileSync(path(file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || env[m[1]]) continue
    if (file !== '.env' && m[1] !== 'ELEVENLABS_API_KEY') continue
    env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// 台本はアプリの TypeScript から読む
const server = await createServer({
  root: path(''),
  cacheDir: 'node_modules/.vite-voice',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
const { GUIDE_SCENES, LEAD_IN, TAIL } = await server.ssrLoadModule('/src/shell/guideScenes.ts')
const { voiceKey } = await server.ssrLoadModule('/src/core/voiceKey.ts')
await server.close()

mkdirSync(VOICE, { recursive: true })
if (existsSync(FRAMES)) rmSync(FRAMES, { recursive: true })
mkdirSync(FRAMES, { recursive: true })

// ---- ナレーション ----
const key = env.ELEVENLABS_API_KEY
const voice = env.ELEVENLABS_VOICE_ID
const model = env.ELEVENLABS_MODEL || 'eleven_v4'
for (const sc of GUIDE_SCENES) {
  const file = `${VOICE}${voiceKey(sc.say)}.mp3`
  if (existsSync(file)) continue
  if (!key || !voice) {
    console.error('.env に ELEVENLABS_API_KEY と ELEVENLABS_VOICE_ID を書いてください')
    process.exit(1)
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: sc.say, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  })
  if (!res.ok) {
    console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`)
    process.exit(1)
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(`  声：${sc.id}`)
}
const probe = (f) => Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim())

// 場面の長さ＝ナレーション＋前後の間（短すぎるときは min）
let start = 0
const plan = GUIDE_SCENES.map((sc, i) => {
  const file = `${VOICE}${voiceKey(sc.say)}.mp3`
  const len = probe(file)
  const d = Math.max(sc.min, LEAD_IN + len + TAIL)
  const p = { i, id: sc.id, file, start, d }
  start += d
  return p
})
const total = start
console.log(`場面 ${plan.length}・合計 ${total.toFixed(1)} 秒`)

// ---- 画面を1コマずつ撮る ----
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('softtennis-asobi:settings', JSON.stringify({ sound: false, speak: false, counter: false }))
})
await page.goto('http://localhost:5180/softtennis-asobi/#/dev/guide')
await page.waitForFunction(() => typeof window.__guide === 'function')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
let n = 0
for (const p of plan) {
  const frames = Math.round(p.d * FPS)
  for (let f = 0; f < frames; f++) {
    await page.evaluate(([i, t, d]) => window.__guide(i, t, d), [p.i, f / FPS, p.d])
    await page.screenshot({ path: `${FRAMES}${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 })
  }
  process.stdout.write(`  画面：${p.id}（${frames}コマ）\n`)
}
await browser.close()

// ---- 音を並べて、絵と合わせる ----
const inputs = plan.flatMap((p) => ['-i', p.file])
const delays = plan.map((p, k) => `[${k + 1}:a]adelay=${Math.round((p.start + LEAD_IN) * 1000)}:all=1[a${k}]`).join(';')
const mix = `${delays};${plan.map((_, k) => `[a${k}]`).join('')}amix=inputs=${plan.length}:duration=longest:normalize=0,apad[aout]`
mkdirSync(dirname(OUT), { recursive: true })
execFileSync(
  FFMPEG,
  [
    '-y',
    '-framerate', String(FPS),
    '-i', `${FRAMES}%05d.jpg`,
    ...inputs,
    '-filter_complex', mix,
    '-map', '0:v',
    '-map', '[aout]',
    '-r', '30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-t', total.toFixed(2),
    '-movflags', '+faststart',
    OUT,
  ],
  { stdio: 'inherit' },
)
console.log(`できた：${OUT}（${total.toFixed(1)} 秒・${readdirSync(FRAMES).length} コマ）`)
