// 効果音を ElevenLabs の効果音生成（sound-generation）で作り、仕上げて public/sfx/<名前>.mp3 に置く。アプリはこの mp3 を鳴らす。
//   node scripts/build-sfx.mjs          … 元の音（art/sfx/<名前>.mp3）が無いものだけ ElevenLabs で作り、全部を仕上げ直す
//   node scripts/build-sfx.mjs --dry    … 作る音と説明文を出すだけ（API は呼ばない）
// 作り直すときは art/sfx/<名前>.mp3 を消してから。長さや音量を変えるだけなら、消さずに下の表を直して動かす（クレジットを使わない）
// 鍵は声と同じ（../st-studio/.env の ELEVENLABS_API_KEY）。仕上げは ffmpeg：頭の無音を切る → 使う長さだけ残す → 音の大きさをそろえる → 大きすぎる所をおさえる → 終わりを消す
// ソフトテニスの球は空気の入ったやわらかいゴムの球（第15条）なので、打つ音・はねる音は硬式テニスやピックルボールの硬い音にしない。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const path = (rel) => new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const dry = process.argv.includes('--dry')

/** 名前 → [説明文（英語の方が意図どおりに出る）, 作る長さ（秒）, 仕上げの音量（LUFS）, 使う長さ（秒。後ろの余計な音を切る）] */
export const SFX = {
  pop: ['A soft-tennis racket hitting a soft hollow rubber ball: one short, light, bouncy "pong" impact with a hint of string twang. Close-up, dry, no crowd, no reverb, not a hard tennis ball, not plastic.', 0.5, -16, 0.16],
  bounce: ['A single soft hollow rubber ball bouncing once on a hard outdoor court: a short, light, muted "pon" thud. Dry, close, no reverb.', 0.5, -20, 0.25],
  ok: ['A short cheerful "correct answer" chime for a children\'s quiz game: three quick bright ascending marimba notes. Clean, friendly, no voice.', 1.0, -18, 0.65],
  ng: ['A short gentle "wrong answer" sound for a children\'s game: two soft descending low notes like a muted tuba "boo-boop". Playful, not harsh, no buzzer, no voice.', 0.8, -20, 0.65],
  whistle: ['A single short sports referee whistle blow, one clear tweet about half a second long. No crowd, no reverb.', 0.6, -20, 0.55],
  tick: ['A tiny soft wooden UI click for a button tap in a kids app: one very short dry "tok". No reverb.', 0.5, -24, 0.15],
  go: ['A single bright "go" start signal beep for a reaction game: one clean high "pip", short and crisp. No voice.', 0.5, -18, 0.3],
  fanfare: ['A short triumphant victory fanfare for a kids sports game: bright brass and glockenspiel, rising then a happy final chord, about two seconds. No voice, no crowd.', 2.0, -16, 1.7],
}

// .env を読む（値は表示しない）。鍵は st-studio と同じ
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
const FFMPEG = env.FFMPEG || path('../st-studio/node_modules/ffmpeg-static/ffmpeg.exe')
const srcDir = path('art/sfx/')
const outDir = path('public/sfx/')
mkdirSync(srcDir, { recursive: true })
mkdirSync(outDir, { recursive: true })
const todo = Object.keys(SFX).filter((n) => !existsSync(`${srcDir}${n}.mp3`))
console.log(`効果音 ${Object.keys(SFX).length} 種類。まだ無いもの ${todo.length}：${todo.join(', ') || 'なし'}`)
if (dry) {
  for (const n of todo) console.log(`  ${n}（${SFX[n][1]}秒）${SFX[n][0]}`)
  process.exit(0)
}
if (todo.length && !env.ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY がありません（../st-studio/.env）')
  process.exit(1)
}
for (const n of todo) {
  const [text, sec] = SFX[n]
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, duration_seconds: sec, prompt_influence: 0.6 }),
  })
  if (!res.ok) {
    console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`)
    process.exit(1)
  }
  writeFileSync(`${srcDir}${n}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log(`  作った：${n}`)
}
// 仕上げ（毎回すべて）
for (const [n, [, , lufs, keep]] of Object.entries(SFX)) {
  const fade = Math.min(0.06, keep / 3)
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', `${srcDir}${n}.mp3`,
    '-af', `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005,atrim=0:${keep},loudnorm=I=${lufs}:TP=-2:LRA=7,alimiter=limit=0.7:level=disabled,afade=t=out:st=${(keep - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    '-ar', '44100', '-ac', '1', '-b:a', '96k', `${outDir}${n}.mp3`])
}
console.log('仕上げ：public/sfx/ に', Object.keys(SFX).length, '種類')
