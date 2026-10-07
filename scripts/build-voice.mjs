// ElevenLabs でセリフを音声（mp3）にして public/voice/ に置く。アプリは遊ぶ最中に通信せず、この mp3 を鳴らす。
//   node scripts/build-voice.mjs --dry     … 作るセリフと文字数（＝料金の目安）を出すだけ。API は呼ばない
//   node scripts/build-voice.mjs           … まだ無いセリフだけ作る（同じ文は二度課金しない）
//   node scripts/build-voice.mjs --prune   … 一覧から消えたセリフの mp3 を消す
// 鍵と声は .env（git に入れない）：ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL（既定 eleven_v4）
// 鍵がこちらの .env に無ければ ../pb-studio/.env の ELEVENLABS_API_KEY を使う
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'

const root = new URL('../', import.meta.url)
const path = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Z]:)/, '$1')
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const prune = args.includes('--prune')

// .env を読む（値は表示しない）
const env = { ...process.env }
// 鍵は pb-studio と同じものを使えるよう、こちらに無ければ ../pb-studio/.env も見る（声の ID はこちらの .env）
for (const file of ['.env', '../pb-studio/.env']) {
  if (!existsSync(path(file))) continue
  for (const line of readFileSync(path(file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || env[m[1]]) continue
    if (file !== '.env' && m[1] !== 'ELEVENLABS_API_KEY') continue
    env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// セリフの一覧はアプリの TypeScript から読む（問題を直したら、声も自動で追いつく）
// 開発サーバーの部品置き場（node_modules/.vite）を書き換えないよう、別の置き場を使う
const server = await createServer({
  root: path(''),
  cacheDir: 'node_modules/.vite-voice',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
const { allVoiceLines } = await server.ssrLoadModule('/src/core/voiceLines.ts')
const { voiceKey } = await server.ssrLoadModule('/src/core/voiceKey.ts')
await server.close()

const lines = allVoiceLines()
const outDir = path('public/voice/')
mkdirSync(outDir, { recursive: true })
const todo = lines.filter((t) => !existsSync(`${outDir}${voiceKey(t)}.mp3`))
const chars = (xs) => xs.reduce((n, t) => n + [...t].length, 0)
console.log(`セリフ ${lines.length} 件（${chars(lines)} 文字）。まだ無いもの ${todo.length} 件（${chars(todo)} 文字）`)

if (dry) {
  for (const t of todo) console.log(`  ${voiceKey(t)}  ${t}`)
} else if (todo.length) {
  const key = env.ELEVENLABS_API_KEY
  const voice = env.ELEVENLABS_VOICE_ID
  const model = env.ELEVENLABS_MODEL || 'eleven_v4'
  if (!key || !voice) {
    console.error('.env に ELEVENLABS_API_KEY と ELEVENLABS_VOICE_ID を書いてください（.env.example を参照）')
    process.exit(1)
  }
  const settings = {
    stability: Number(env.ELEVENLABS_STABILITY ?? 0.5),
    similarity_boost: Number(env.ELEVENLABS_SIMILARITY ?? 0.75),
    ...(env.ELEVENLABS_SPEED ? { speed: Number(env.ELEVENLABS_SPEED) } : {}),
  }
  for (const [i, text] of todo.entries()) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
    })
    if (!res.ok) {
      console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`)
      process.exit(1)
    }
    writeFileSync(`${outDir}${voiceKey(text)}.mp3`, Buffer.from(await res.arrayBuffer()))
    console.log(`  [${i + 1}/${todo.length}] ${text}`)
  }
}

// 一覧（アプリはここに載っている声だけを使い、無い文は端末の読み上げで読む）
const keep = new Set(lines.map(voiceKey))
if (prune) {
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.mp3') && !keep.has(f.replace('.mp3', ''))) {
      rmSync(`${outDir}${f}`)
      console.log(`  消した：${f}`)
    }
  }
}
const ready = [...keep].filter((k) => existsSync(`${outDir}${k}.mp3`))
writeFileSync(`${outDir}index.json`, JSON.stringify(ready))
console.log(`public/voice/index.json：${ready.length} 件`)
