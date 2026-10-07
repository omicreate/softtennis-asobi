/**
 * おうちの方へ。入る前に おうちの人の確認（かけ算）を出す。
 * この端末の記録・匿名の回数集計の説明とオンオフ・アプリの紹介・記録を消す。
 */
import { useState } from 'react'
import { counterStatus, onPublicSite, PUBLIC_URL } from '../core/counter'
import { medalCount, resetProgress, useProgress } from '../core/progress'
import { setSettings, useSettings } from '../core/settings'
import { ParentGate } from '../ui/ParentGate'
import { GAMES } from './games'
import './setup.css'
import './collection.css'
import './parents.css'
import '../ui/share.css'

/** この画面を開いているあいだは、確認を1回で済ませる */
let passed = false

/** つづけて遊んだら声をかける時間（分。0＝声をかけない） */
const BREAK_CHOICES = [0, 20, 30, 45]

const STATUS_TEXT: Record<ReturnType<typeof counterStatus>, string> = {
  on: 'いまは送っています。',
  'off-user': '「送らない」になっています。',
  'off-dnt': 'ブラウザの「トラッキングしない」設定がオンなので、送っていません。',
  'off-site': '公開版（GitHub Pages）以外で開いているので、送っていません。',
  'off-config': 'まだ集計先を設定していないので、送っていません。',
}

export function Parents() {
  const [ok, setOk] = useState(passed)
  if (!ok) {
    return (
      <main className="parents">
        <div className="share-sheet parents-gate">
          <ParentGate
            onPass={() => {
              passed = true
              setOk(true)
            }}
            onCancel={() => (location.hash = '#/')}
          />
        </div>
      </main>
    )
  }
  return <ParentsBody />
}

function ParentsBody() {
  const progress = useProgress()
  const settings = useSettings()
  const [confirmReset, setConfirmReset] = useState(false)
  const status = counterStatus()
  const total = Object.values(progress.plays).reduce((a, b) => a + b, 0)
  const rows = GAMES.map((g) => ({ g, n: progress.plays[g.id] ?? 0 })).sort((a, b) => b.n - a.n)
  const party = progress.plays.party ?? 0
  const max = Math.max(1, ...rows.map((r) => r.n), party)
  const canShare = typeof navigator.share === 'function'

  const shareApp = async () => {
    try {
      await navigator.share({ title: 'ピクルくんとあそぼ', text: 'スマホやタブレット1台で、親子や友だちと遊べるピックルボールのミニゲーム集', url: PUBLIC_URL })
    } catch {
      // とじただけ
    }
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_URL)
    } catch {
      // コピーできない端末もある
    }
  }

  return (
    <main className="parents">
      <header className="col-head">
        <a className="btn btn-small" href="#/" aria-label="もどる">
          ←
        </a>
        <h1 className="col-title">おうちの方へ</h1>
      </header>

      <section className="par-card">
        <h2>あそびかた</h2>
        <ul>
          <li>スマホやタブレットを机に置き、2人で向かい合って座ります。手前の人と向こうの人が、それぞれ自分の側の画面を触ります。</li>
          <li>レベルは1人ずつ選べます。ちびっこ・キッズは球がゆっくりで、パドルも大きくなります。親子でも同じ条件で勝負できます。</li>
          <li>「じゅんばんモード」は、1台を順番に回して2〜6人で記録を比べる遊び方です。同じラウンドでは、全員に同じ障害・同じ球が出ます。</li>
          <li>机に平らに置くと画面が勝手に回ることがあります。画面の向きを固定（回転ロック）してから遊ぶのがおすすめです。</li>
          <li>
            ブラウザの「ホーム画面に追加」でアプリのように全画面で開けます。一度開けば、電波のない場所でも遊べます。<a href="#/install">ホーム画面に入れる方法（図つき）</a>
          </li>
          <li>ルールは USA Pickleball 公式ルールブック（2026年版）にもとづいています。各ゲームの「？」から、くわしいルールと根拠を見られます。</li>
        </ul>
      </section>

      <section className="par-card" aria-labelledby="par-rec">
        <h2 id="par-rec">この端末の記録</h2>
        <p className="par-sum">
          遊んだ回数 <b>{total}</b> 回 ／ 遊んだ日（スタンプ） <b>{progress.days.length}</b> 日 ／ クリアしたミッション <b>{progress.cleared}</b> こ ／ メダル <b>{medalCount(progress)}</b> ／ ほし <b>{progress.stars}</b> こ
        </p>
        <ul className="par-bars">
          {rows.map(({ g, n }) => (
            <li key={g.id}>
              <span className="par-bar-label">{g.title}</span>
              <span className="par-bar" style={{ width: `${(n / max) * 100}%` }} />
              <span className="par-bar-n">{n}</span>
            </li>
          ))}
          <li>
            <span className="par-bar-label">じゅんばんモード</span>
            <span className="par-bar" style={{ width: `${(party / max) * 100}%` }} />
            <span className="par-bar-n">{party}</span>
          </li>
        </ul>
        <p className="par-note">この記録は端末の中だけにあり、外には送りません。</p>
      </section>

      <section className="par-card" aria-labelledby="par-break">
        <h2 id="par-break">遊びすぎの声かけ</h2>
        <p>続けて遊んだ時間が決めた時間をこえると、ゲームの結果が出たときに、ピクルくんが「ちょっと きゅうけい しよう」と声をかけます（ゲームの途中では止めません）。10分以上はなれると、休んだとみなして数え直します。</p>
        <div className="seg par-seg" role="radiogroup" aria-label="声をかけるまでの時間">
          {BREAK_CHOICES.map((m) => (
            <button key={m} role="radio" aria-checked={settings.breakMin === m} onClick={() => setSettings({ breakMin: m })} data-testid={`break-${m}`}>
              {m === 0 ? 'かけない' : `${m}分`}
            </button>
          ))}
        </div>
      </section>

      <section className="par-card" aria-labelledby="par-count">
        <h2 id="par-count">遊ばれた回数の集計（匿名）</h2>
        <p>
          どのゲームがよく遊ばれ、どれが最後まで遊ばれているかを知って、ゲームを良くするために、<b>次のことだけ</b>を集計（Googleスプレッドシート）に送ります。
        </p>
        <ul>
          <li>送るもの：アプリを開いた・ゲームを始めた・最後まで遊んだ・きねんカードを共有した、のどれか／ゲームの名前／どのリンクから来たか（例：Instagram のプロフィール）／ホーム画面に追加して開いたか／アプリの版。</li>
          <li>送らないもの：名前・点数・写真・端末を見分けるID・Cookie・位置情報。</li>
          <li>公開版で開いたときだけ送ります。電波がないときは送らずに捨てます。</li>
          <li>ブラウザの「トラッキングしない」設定がオンなら送りません。</li>
        </ul>
        <p className="par-status" data-testid="counter-status">
          {STATUS_TEXT[status]}
        </p>
        <div className="seg par-seg" role="radiogroup" aria-label="集計に送る">
          {([true, false] as const).map((v) => (
            <button key={String(v)} role="radio" aria-checked={settings.counter === v} onClick={() => setSettings({ counter: v })}>
              {v ? '送る' : '送らない'}
            </button>
          ))}
        </div>
      </section>

      <section className="par-card" aria-labelledby="par-share">
        <h2 id="par-share">アプリを紹介する</h2>
        {onPublicSite() ? (
          <>
            <p>お友だちやピックルボール仲間に、このアプリのURLを送れます。</p>
            <div className="par-actions">
              {canShare && (
                <button className="btn btn-go" onClick={shareApp}>
                  シェアする
                </button>
              )}
              <button className="btn" onClick={copyLink}>
                URLをコピー
              </button>
            </div>
            <p className="par-url">{PUBLIC_URL}</p>
          </>
        ) : (
          <p>公開版（{PUBLIC_URL}）で開くと、ここからURLを送れます。</p>
        )}
        <p className="par-note">ゲームの結果画面の 📸 からは、名前の入らない「きねんカード」の画像を作れます（作る前にこの確認が出ます）。</p>
      </section>

      <section className="par-card" aria-labelledby="par-reset">
        <h2 id="par-reset">記録を消す</h2>
        <p>ほし・きせかえ・スタンプ・ミッション・メダル・遊んだ回数を、はじめの状態に戻します。設定は残ります。</p>
        {confirmReset ? (
          <div className="par-actions">
            <button
              className="btn par-danger"
              onClick={() => {
                resetProgress()
                setConfirmReset(false)
              }}
            >
              本当に消す
            </button>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              やめる
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>
            記録を消す…
          </button>
        )}
      </section>
    </main>
  )
}
