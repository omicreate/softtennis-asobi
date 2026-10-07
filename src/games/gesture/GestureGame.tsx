/**
 * ジェスチャー ピックル（2〜6人。1台を手わたし）の画面。
 * 準備 → 「◯◯の ばん！」→ 3・2・1 → やる人だけが お題を見て体で表す（あたり／パス）→ その人の結果 → 次の人 → みんなの合計。
 * お題は声に出さない（ほかの人に聞こえてしまうので）。パドルは持たずに手でやる。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { countFinish, countGame } from '../../core/counter'
import { useFrame } from '../../core/loop'
import { breakDue, oneMore, tookBreak } from '../../core/playtime'
import { getProgress, recordPlay, recordStart } from '../../core/progress'
import type { Reward } from '../../core/progress'
import { sfx, unlockAudio } from '../../core/sound'
import { speak, stopSpeaking } from '../../core/speak'
import { load, save } from '../../core/storage'
import { usePlayClock } from '../../core/usePlayClock'
import { PHRASES } from '../../core/voiceLines'
import { useWakeLock } from '../../core/wakelock'
import { PARTY_COLORS, turnLine } from '../../shell/party/colors'
import { BreakSheet } from '../../ui/BreakSheet'
import { RewardList } from '../../ui/GameUI'
import { Handoff } from '../../ui/Handoff'
import { HowToSheet } from '../../ui/HowToSheet'
import { PikuruCut } from '../../ui/pikuruArt'
import { ShareSheet } from '../../ui/ShareSheet'
import { ACT_TIMES, bestActors, COUNTDOWN, drawCard, G_DECK_INFO, G_DECKS, teamTotal, turnScore } from './gesture'
import type { GCard, GDeck, TurnLog } from './gesture'
import '../../shell/setup.css'
import '../../shell/party/party.css'
import '../nise/nise.css'
import './gesture.css'

type Phase = 'setup' | 'pass' | 'countdown' | 'act' | 'turn' | 'final'

interface SavedSetup {
  count: number
  deck: GDeck
  time: number
}

const MIN = 2
const MAX = PARTY_COLORS.length

export function GestureGame() {
  useWakeLock()
  const saved = useMemo(() => load<SavedSetup>('gesture-setup', { count: 3, deck: 'kids', time: 60 }), [])
  const [count, setCount] = useState(Math.max(MIN, Math.min(MAX, saved.count)))
  const [deck, setDeck] = useState<GDeck>(G_DECKS.includes(saved.deck) ? saved.deck : 'kids')
  const [time, setTime] = useState(ACT_TIMES.includes(saved.time) ? saved.time : 60)
  const [phase, setPhase] = useState<Phase>('setup')
  const [actor, setActor] = useState(0)
  const [left, setLeft] = useState(0)
  const [card, setCard] = useState<GCard | null>(null)
  const [logs, setLogs] = useState<TurnLog[][]>([])
  const [paused, setPaused] = useState(false)
  const [help, setHelp] = useState(false)
  const [rest, setRest] = useState(false)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [best, setBest] = useState<Record<string, number>>(() => load('gesture-best', {}))
  const [newBest, setNewBest] = useState(false)
  const [share, setShare] = useState(false)
  const used = useRef(new Set<string>())

  const players = PARTY_COLORS.slice(0, count)
  const bestKey = `${deck}-${time}`
  usePlayClock(phase === 'setup' || paused || help || rest)

  useEffect(() => save('gesture-setup', { count, deck, time }), [count, deck, time])
  useEffect(() => () => stopSpeaking(), [])

  const endTurn = () => {
    sfx.whistle()
    speak(PHRASES.gestEnd)
    setPaused(false)
    setPhase('turn')
  }
  // テスト用：いまの人の時間を終わらせる（開発中だけ）
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __gestureEnd?: () => void }
    w.__gestureEnd = phase === 'act' ? endTurn : undefined
  })

  const start = () => {
    unlockAudio()
    sfx.go()
    setLogs(players.map(() => []))
    setActor(0)
    setRewards([])
    setNewBest(false)
    setPhase('pass')
    speak(turnLine(PARTY_COLORS[0].name))
    recordStart('gesture')
    countGame('gesture')
  }

  const next = (log: TurnLog) => {
    setLogs((ls) => ls.map((l, i) => (i === actor ? [...l, log] : l)))
    setCard(drawCard(deck, used.current))
  }

  const toFinal = () => {
    const total = teamTotal(logs)
    const prev = best[bestKey] ?? 0
    if (total > prev) {
      const b = { ...best, [bestKey]: total }
      setBest(b)
      save('gesture-best', b)
      setNewBest(prev > 0)
    }
    setRewards(recordPlay({ type: 'finish', game: 'gesture', value: total, two: true }))
    countFinish('gesture')
    sfx.fanfare()
    speak(PHRASES.gestFinal)
    setPhase('final')
    if (breakDue()) setRest(true)
  }

  useFrame((dt) => {
    if (paused || help) return
    if (phase === 'countdown') {
      const before = left
      const nx = before - dt
      if (Math.ceil(nx) !== Math.ceil(before) && nx > 0) sfx.tick()
      if (nx <= 0) {
        sfx.go()
        speak(PHRASES.gestStart)
        setCard(drawCard(deck, used.current))
        setLeft(time)
        setPhase('act')
      } else setLeft(nx)
    } else if (phase === 'act') {
      const before = left
      const nx = before - dt
      const n = Math.ceil(nx)
      if (n !== Math.ceil(before) && n <= 5 && n > 0) sfx.tick()
      if (nx <= 0) {
        setLeft(0)
        endTurn()
      } else setLeft(nx)
    }
  })

  // ---------- 準備 ----------
  if (phase === 'setup') {
    return (
      <main className="party gesture">
        <header className="party-head">
          <a className="btn btn-small" href="#/" aria-label="もどる">
            ←
          </a>
          <h1 className="party-title">ジェスチャー ピックル</h1>
        </header>
        <div className="party-intro">
          <PikuruCut art="ok" height={92} />
          <p>やる ひとだけ がめんを みて、こえを ださずに からだで まねしよう。みんなで いくつ あてられるかな？</p>
          <button className="btn btn-small" aria-label="せつめいを よみあげる" onClick={() => speak(PHRASES.gestIntro)}>
            🗣️
          </button>
        </div>
        <p className="gesture-safe">⚠️ パドルは もたずに、てで やろう。まわりに ぶつからない ひろい ところで。</p>

        <h2 className="party-label">なんにんで あそぶ？</h2>
        <div className="seg party-seg" role="radiogroup" aria-label="にんずう">
          {Array.from({ length: MAX - MIN + 1 }, (_, i) => i + MIN).map((n) => (
            <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} data-testid={`gesture-count-${n}`}>
              {n}にん
            </button>
          ))}
        </div>
        <p className="nise-chips">
          {players.map((p) => (
            <span key={p.name} className="party-chip" style={{ background: p.color }}>
              {p.name}
            </span>
          ))}
        </p>

        <h2 className="party-label">おだい</h2>
        <div className="seg party-seg nise-decks" role="radiogroup" aria-label="おだい">
          {G_DECKS.map((d) => (
            <button key={d} role="radio" aria-checked={deck === d} onClick={() => setDeck(d)} data-testid={`gesture-deck-${d}`}>
              <b>{G_DECK_INFO[d].label}</b>
              <small>{G_DECK_INFO[d].hint}</small>
            </button>
          ))}
        </div>

        <h2 className="party-label">ひとりの じかん</h2>
        <div className="seg party-seg" role="radiogroup" aria-label="ひとりの じかん">
          {ACT_TIMES.map((t) => (
            <button key={t} role="radio" aria-checked={time === t} onClick={() => setTime(t)}>
              {t}びょう
            </button>
          ))}
        </div>
        {best[bestKey] ? <p className="party-note">じこベスト：みんなで {best[bestKey]}こ</p> : null}
        <p className="party-note">じが よめない ときは、おうちの ひとが こっそり よんであげてね。</p>

        <button className="btn solo-help" onClick={() => setHelp(true)}>
          ？ あそびかた・ルールを みる
        </button>
        <button className="btn btn-go party-start" onClick={start} data-testid="gesture-start">
          はじめる！
        </button>
        {help && <HowToSheet game="gesture" onClose={() => setHelp(false)} fixed />}
      </main>
    )
  }

  const p = players[actor]
  const myLog = logs[actor] ?? []

  return (
    <main className="party gesture" data-phase={phase}>
      {phase === 'pass' && (
        <Handoff
          name={p.name}
          color={p.color}
          sub={`${actor + 1} / ${count}にんめ・${time}びょう`}
          note="やる ひとだけ がめんを みてね。こえは だしちゃ だめ！"
          go="じゅんび OK（タッチで スタート）"
          onGo={() => {
            unlockAudio()
            stopSpeaking()
            setLeft(COUNTDOWN)
            setPhase('countdown')
          }}
          testId="gesture-go"
        />
      )}

      {phase === 'countdown' && (
        <section className="party-card gesture-count" style={{ borderColor: p.color }}>
          <span className="party-chip party-chip-big" style={{ background: p.color }}>
            {p.name}
          </span>
          <div className="gesture-num">{Math.max(1, Math.ceil(left))}</div>
        </section>
      )}

      {phase === 'act' && card && (
        <section className="gesture-act" style={{ borderColor: p.color }} data-testid="gesture-act">
          <div className="gesture-top">
            <span className="party-chip" style={{ background: p.color }}>
              {p.name}
            </span>
            <div className="gesture-timer" aria-label={`のこり ${Math.ceil(left)}びょう`}>
              <i style={{ width: `${Math.max(0, Math.min(1, left / time)) * 100}%` }} data-low={left <= 10 || undefined} />
              <span>{Math.ceil(left)}</span>
            </div>
            <span className="gesture-got">あたり {turnScore(myLog)}</span>
          </div>
          <div className="gesture-card" data-testid="gesture-card">
            <span className="gesture-say">{card.say}</span>
            <span className="gesture-how">こんな ふうに：{card.act}</span>
          </div>
          <div className="gesture-buttons">
            <button
              className="btn gesture-pass"
              onClick={() => {
                sfx.tick()
                next({ card, got: false })
              }}
              data-testid="gesture-pass"
            >
              パス
            </button>
            <button
              className="btn btn-go gesture-hit"
              onClick={() => {
                sfx.ok()
                next({ card, got: true })
              }}
              data-testid="gesture-hit"
            >
              あたり！
            </button>
          </div>
          <button className="btn btn-small gesture-pause" onClick={() => setPaused((x) => !x)} aria-label={paused ? 'つづける' : 'とめる'}>
            {paused ? '▶' : '⏸'}
          </button>
          {paused && <div className="gesture-paused">とまっているよ（▶ で つづき）</div>}
        </section>
      )}

      {phase === 'turn' && (
        <section className="party-card party-wide" data-testid="gesture-turn">
          <span className="party-chip party-chip-big" style={{ background: p.color }}>
            {p.name}
          </span>
          <p className="party-value">
            {turnScore(myLog)}
            <small>こ つたわった！</small>
          </p>
          <CardList log={myLog} />
          <button
            className="btn btn-go"
            onClick={() => {
              sfx.tick()
              if (actor + 1 < count) {
                setActor(actor + 1)
                setPhase('pass')
                speak(turnLine(PARTY_COLORS[actor + 1].name))
              } else toFinal()
            }}
            data-testid="gesture-next"
          >
            {actor + 1 < count ? `つぎは ${players[actor + 1].name}` : 'みんなの けっか'}
          </button>
        </section>
      )}

      {phase === 'final' && (
        <section className="party-card party-wide" data-testid="gesture-final">
          <div className="nise-art">
            <PikuruCut art="ok" height={96} />
          </div>
          <p className="party-round">みんなで つたえた かず</p>
          <p className="party-value" data-testid="gesture-total">
            {teamTotal(logs)}
            <small>こ</small>
          </p>
          {newBest && <p className="party-top">じこベスト こうしん！</p>}
          <p className="party-note">じこベスト：{best[bestKey] ?? teamTotal(logs)}こ（{G_DECK_INFO[deck].label}・{time}びょう）</p>
          <ul className="party-totals">
            {players.map((q, i) => (
              <li key={q.name}>
                <span className="party-chip" style={{ background: q.color }}>
                  {q.name}
                </span>
                {bestActors(logs).includes(i) && <span className="nise-mark">つたえ めいじん</span>}
                <b>{turnScore(logs[i] ?? [])}こ</b>
              </li>
            ))}
          </ul>
          <Tips logs={logs} />
          <RewardList rewards={rewards} />
          <div className="party-actions">
            <button className="btn btn-go" onClick={start} data-testid="gesture-again">
              もういちど
            </button>
            <button className="btn" onClick={() => setPhase('setup')}>
              にんずう・おだいを かえる
            </button>
            <a className="btn" href="#/">
              おわる
            </a>
            <button className="btn result-share" aria-label="きねんカード（おうちの人と いっしょに）" onClick={() => setShare(true)} data-testid="share-btn">
              📸
            </button>
          </div>
        </section>
      )}
      {share && (
        <ShareSheet
          fixed
          card={{
            game: 'gesture',
            gameTitle: 'ジェスチャー ピックル',
            title: `みんなで ${teamTotal(logs)}こ つたわった！`,
            sub: `${count}にん・${G_DECK_INFO[deck].label}・${time}びょう`,
            face: 'ok',
            wear: getProgress().wear,
          }}
          onClose={() => setShare(false)}
        />
      )}

      {phase !== 'pass' && phase !== 'act' && phase !== 'countdown' && (
        <button className="btn btn-small nise-help" aria-label="あそびかた・ルール" onClick={() => setHelp(true)}>
          ？
        </button>
      )}
      {help && <HowToSheet game="gesture" onClose={() => setHelp(false)} fixed />}
      {rest && (
        <BreakSheet
          single
          onRest={tookBreak}
          onMore={() => {
            oneMore()
            setRest(false)
          }}
        />
      )}
    </main>
  )
}

/** その人のお題（あたり・パス） */
function CardList({ log }: { log: TurnLog[] }) {
  if (!log.length) return <p className="party-note">こんどは きっと つたわるよ！</p>
  return (
    <ul className="gesture-list">
      {log.map((x, i) => (
        <li key={i} data-got={x.got || undefined}>
          <span>{x.got ? '⭕' : '➖'}</span>
          {x.card.say}
        </li>
      ))}
    </ul>
  )
}

/** まめちしき：出たお題のうち、ルールにかかわるもの（同じものは1回） */
function Tips({ logs }: { logs: TurnLog[][] }) {
  const seen = new Map<string, GCard>()
  for (const l of logs) for (const x of l) if (x.card.tip) seen.set(x.card.id, x.card)
  if (!seen.size) return null
  return (
    <div className="nise-tip">
      <b>まめちしき</b>
      {[...seen.values()].map((c) => (
        <p key={c.id}>
          <b>{c.say}</b>：{c.tip}
        </p>
      ))}
    </div>
  )
}
