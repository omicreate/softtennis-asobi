// ソフトテニスIQの「ルールドリル」の問題（ルールブックの条文で裏取り済み）を、クイズの大人向けの問題として取りこむ。
//   node scripts/import-drill.mjs   → src/games/quiz/stDrill.ts を書き直す
// 元のデータ：C:\Users\omi06\dev\stiq-apps\softtennis-iq\src\tools\drill\questions.ts（1問1行の q({...})）
// 問題を直すときは、元のルールドリルを直してから、これを動かし直す（ここで手直ししない）。
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.env.DRILL_SRC ?? 'C:/Users/omi06/dev/stiq-apps/softtennis-iq/src/tools/drill/questions.ts'
const path = (rel) => new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const text = readFileSync(SRC, 'utf8')
const drafts = []
for (const line of text.split('\n')) {
  const m = line.match(/^\s*q\((\{.*\})\),?\s*$/)
  if (!m) continue
  // 1行の JavaScript のオブジェクト（自分たちのデータ）をそのまま読む
  const d = new Function('RULEBOOK', 'JSTA_NOTICE', `return (${m[1]})`)([], [])
  drafts.push({ id: d.id, category: d.category, prompt: d.prompt, answer: d.answer, wrong: d.wrong, term: d.term, explain: d.explain, ref: d.ref })
}
if (drafts.length < 100) throw new Error(`問題が少なすぎる（${drafts.length}問）。元のファイルの形が変わったかもしれない`)

const out = `/**
 * ソフトテニスIQ「ルールドリル」の問題（自動で取りこんだもの。手で直さない）。
 * どの問題もルールブック（ソフトテニスハンドブック 2026）の条文で裏取り済み。ref に根拠の条番号。
 * 作り直し：node scripts/import-drill.mjs
 */
export interface DrillDraft {
  id: string
  category: string
  prompt: string
  answer: string
  wrong: [string, string, string]
  term: string
  explain: string
  ref: string
}

export const DRILL: DrillDraft[] = ${JSON.stringify(drafts, null, 2)}
`
writeFileSync(path('src/games/quiz/stDrill.ts'), out)
console.log(`${drafts.length}問を取りこみました`)
