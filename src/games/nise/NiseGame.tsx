/**
 * にせピクルくんは だれだ？（3〜6人。1台を手わたし）の画面。
 * 準備 → 1人ずつ こっそり お題を見る → 話しあい → せーので ゆびさし → 発表（ばれたら ぎゃくてん チャンス）→ 結果。
 * 名前は入れず、じゅんばんモードと同じ色で呼ぶ。お題は声に出さない（みんなに聞こえてしまうので）。
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
import { dealRound, judgeOutcome, majorityWord, MIN_PLAYERS, pairOf, starsFor, tally, TALK_HINTS, TALK_TIMES, TIE_TIME, VOTE_MODES, wolfWord, wordFor } from './nise'
import type { NiseRound, Outcome, VoteMode } from './nise'
import { NisePic } from './pics'
import { DECK_INFO, DECKS } from './words'
import type { Deck, Word } from './words'
import '../../shell/setup.css'
import '../../shell/party/party.css'
import './nise.css'

type Phase = 'setup' | 'pass' | 'peek' | 'ready' | 'talk' | 'count' | 'point' | 'votePass' | 'vote' | 'reveal' | 'guess' | 'result'

interface SavedSetup {
  count: number
  deck: Deck
  talk: number
  vote?: VoteMode
}

const MAX = PARTY_COLORS.length
/** 発表：「◯◯は……」のあと、この秒数で正体を出す */
const REVEAL_AT = 1.8

const clampCount = (n: number) => Math.max(MIN_PLAYERS, Math.min(MAX, n))
const mmss = (s: number) => {
  const n = Math.max(0, Math.ceil(s))
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

/** お題のカード（絵のお題は絵と文字、ことばのお題は大きな文字） */
function WordCard({ word, size = 'big' }: { word: Word; size?: 'big' | 'small' }) {
  return (
    <div className={`nise-word nise-word-${size}`}>
      {word.pic && <NisePic id={word.pic} size={size === 'big' ? 170 : 72} />}
      <span className="nise-word-text">{word.text}</span>
    </div>
  )
}

export function NiseGame() {
  useWakeLock()
  const saved = useMemo(() => load<SavedSetup>('nise-setup', { count: 4, deck: 'e', talk: 120 }), [])
  const [count, setCount] = useState(clampCount(saved.count))
  const [deck, setDeck] = useState<Deck>(DECKS.includes(saved.deck) ? saved.deck : 'e')
  const [talk, setTalk] = useState(TALK_TIMES.includes(saved.talk) ? saved.talk : 120)
  const [vote, setVote] = useState<VoteMode>(saved.vote && VOTE_MODES.includes(saved.vote) ? saved.vote : 'point')
  /** こっそり とうひょう：だれが とうひょうする番か・これまでの票・発表で見せる票の数 */
  const [voter, setVoter] = useState(0)
  const [votes, setVotes] = useState<number[]>([])
  const [counts, setCounts] = useState<number[] | null>(null)
  const [share, setShare] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [round, setRound] = useState<NiseRound | null>(null)
  /** いま手わたしで見ている人 */
  const [who, setWho] = useState(0)
  /** 話しあいの途中で、お題を見なおしている */
  const [recheck, setRecheck] = useState(false)
  /** 見なおす人を選んでいる */
  const [picking, setPicking] = useState(false)
  const [left, setLeft] = useState(0)
  const [tie, setTie] = useState(false)
  const [hint, setHint] = useState(0)
  const [pointed, setPointed] = useState<number | null>(null)
  /** ぎゃくてん チャンスで、答えを出したか */
  const [answerShown, setAnswerShown] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  /** これまでの ほしの合計（色ごと）と、さいごの回の分 */
  const [stars, setStars] = useState<number[]>([])
  const [gained, setGained] = useState<number[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [help, setHelp] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rest, setRest] = useState(false)
  const used = useRef(new Set<string>())
  const revealT = useRef(0)
  const [, setTick] = useState(0)

  const players = PARTY_COLORS.slice(0, count)
  usePlayClock(phase === 'setup' || paused || help || rest)

  useEffect(() => save('nise-setup', { count, deck, talk, vote }), [count, deck, talk, vote])
  useEffect(() => () => stopSpeaking(), [])
  // テスト用：だれが にせピクルくんか（開発中だけ）
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __nise?: NiseRound | null }).__nise = round
  }, [round])

  const startRound = (fresh: boolean) => {
    unlockAudio()
    sfx.go()
    const r = dealRound(deck, count, Math.random, used.current)
    setRound(r)
    setWho(0)
    setRecheck(false)
    setPicking(false)
    setTie(false)
    setPaused(false)
    setPointed(null)
    setCounts(null)
    setOutcome(null)
    setRewards([])
    if (fresh) {
      setStars(Array(count).fill(0))
      setGained(Array(count).fill(0))
    }
    setPhase('pass')
    speak(turnLine(PARTY_COLORS[0].name))
    recordStart('nise')
    countGame('nise')
  }

  const hidePeek = () => {
    sfx.tick()
    if (recheck) {
      setRecheck(false)
      setPhase('talk')
      return
    }
    if (who + 1 < count) {
      setWho(who + 1)
      setPhase('pass')
      speak(turnLine(PARTY_COLORS[who + 1].name))
    } else {
      setPhase('ready')
      speak(PHRASES.niseReady)
    }
  }

  const startTalk = (sec: number, isTie: boolean) => {
    unlockAudio()
    sfx.go()
    setLeft(sec)
    setTie(isTie)
    setHint(Math.floor(Math.random() * TALK_HINTS[deck].length))
    setPhase('talk')
    speak(isTie ? PHRASES.niseTie : PHRASES.niseTalk)
  }

  const toCount = () => {
    sfx.whistle()
    setPicking(false)
    setPaused(false)
    if (vote === 'secret') {
      setVotes([])
      setVoter(0)
      setPhase('votePass')
      speak(PHRASES.niseVote)
      return
    }
    setPhase('count')
    speak(PHRASES.nisePoint)
  }

  const reveal = (who: number) => {
    sfx.tick()
    revealT.current = 0
    setPointed(who)
    setPhase('reveal')
  }

  /** こっそり とうひょう：1票入れて、次の人へ。全員入れたら集計 */
  const castVote = (target: number) => {
    const next = [...votes, target]
    setVotes(next)
    if (voter + 1 < count) {
      sfx.tick()
      setVoter(voter + 1)
      setPhase('votePass')
      speak(turnLine(PARTY_COLORS[voter + 1].name))
      return
    }
    const t = tally(next, count)
    setCounts(t.counts)
    if (t.top === null) startTalk(TIE_TIME, true)
    else reveal(t.top)
  }

  const finishRound = (r: NiseRound, o: Outcome) => {
    const got = starsFor(r, o)
    setOutcome(o)
    setGained(got)
    setStars((s) => s.map((v, i) => v + (got[i] ?? 0)))
    setRewards(recordPlay({ type: 'finish', game: 'nise', two: true }))
    countFinish('nise')
    sfx.fanfare()
    speak(o.how === 'reverse' ? PHRASES.niseReverse : o.winner === 'minna' ? PHRASES.niseMinnaWin : PHRASES.niseWin)
    setPhase('result')
    if (breakDue()) setRest(true)
  }

  useFrame((dt) => {
    if (phase === 'talk' && !paused && !picking && !help) {
      const before = left
      const next = before - dt
      const n = Math.ceil(next)
      if (n !== Math.ceil(before) && n <= 5 && n > 0) sfx.tick()
      if (next <= 0) toCount()
      else setLeft(next)
    }
    if (phase === 'reveal' && round && pointed !== null) {
      const a = revealT.current
      const b = a + dt
      revealT.current = b
      for (const t of [0.3, 0.7, 1.1, 1.4, 1.6]) if (a < t && b >= t) sfx.tick()
      if (a < REVEAL_AT && b >= REVEAL_AT) {
        if (pointed === round.wolf) {
          sfx.ok()
          speak(PHRASES.niseCaught)
        } else {
          sfx.ng()
          speak(PHRASES.niseMissed)
        }
      }
      if (a < REVEAL_AT + 1) setTick((x) => (x + 1) % 1000)
    }
  })

  const pair = round ? pairOf(round) : null

  // ---------- 準備 ----------
  if (phase === 'setup') {
    return (
      <main className="party nise">
        <header className="party-head">
          <a className="btn btn-small" href="#/" aria-label="もどる">
            ←
          </a>
          <h1 className="party-title">にせピクルくんは だれだ？</h1>
        </header>
        <div className="party-intro">
          <PikuruCut art="think" height={92} />
          <p>ひとりだけ おだいが ちがう「にせピクルくん」が いるよ。はなして、せーので ゆびさし！ にせピクルくんは、じぶんが にせものだと しらないよ。</p>
          <button className="btn btn-small" aria-label="せつめいを よみあげる" onClick={() => speak(PHRASES.niseIntro)}>
            🗣️
          </button>
        </div>

        <h2 className="party-label">なんにんで あそぶ？</h2>
        <div className="seg party-seg" role="radiogroup" aria-label="にんずう">
          {Array.from({ length: MAX - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map((n) => (
            <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} data-testid={`nise-count-${n}`}>
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
        <p className="party-note">じぶんの いろを きめてね。この じゅんばんに てわたしするよ。</p>

        <h2 className="party-label">おだい</h2>
        <div className="seg party-seg nise-decks" role="radiogroup" aria-label="おだい">
          {DECKS.map((d) => (
            <button key={d} role="radio" aria-checked={deck === d} onClick={() => setDeck(d)} data-testid={`nise-deck-${d}`}>
              <b>{DECK_INFO[d].label}</b>
              <small>{DECK_INFO[d].hint}</small>
            </button>
          ))}
        </div>

        <h2 className="party-label">はなす じかん</h2>
        <div className="seg party-seg" role="radiogroup" aria-label="はなす じかん">
          {TALK_TIMES.map((t) => (
            <button key={t} role="radio" aria-checked={talk === t} onClick={() => setTalk(t)}>
              {t / 60}ふん
            </button>
          ))}
        </div>

        <h2 className="party-label">きめかた</h2>
        <div className="seg party-seg" role="radiogroup" aria-label="きめかた">
          {VOTE_MODES.map((m) => (
            <button key={m} role="radio" aria-checked={vote === m} onClick={() => setVote(m)} data-testid={`nise-vote-${m}`}>
              {m === 'point' ? 'せーので ゆびさし' : 'こっそり とうひょう'}
            </button>
          ))}
        </div>
        <p className="party-note">
          {vote === 'point' ? 'みんなで いっせいに ゆびさすよ。いちばん おおく さされた ひとを えらんでね。' : '1だいを まわして、ひとりずつ こっそり とうひょう。ひとを ゆびささずに きめられるよ。'}
        </p>

        <button className="btn solo-help" onClick={() => setHelp(true)}>
          ？ あそびかた・ルールを みる
        </button>
        <button className="btn btn-go party-start" onClick={() => startRound(true)} data-testid="nise-start">
          はじめる！
        </button>
        {help && <HowToSheet game="nise" onClose={() => setHelp(false)} fixed />}
      </main>
    )
  }

  if (!round || !pair) return null
  const p = players[who]
  const wolf = players[round.wolf]

  return (
    <main className="party nise" data-phase={phase}>
      {phase === 'pass' && (
        <Handoff
          name={p.name}
          color={p.color}
          sub={recheck ? 'おだいを もういちど みる' : `${who + 1} / ${count}にんめ`}
          note={`${p.name}の ひとに わたしてね。ほかの ひとは みないでね！`}
          go={`${p.name}だけで みる（タッチ）`}
          onGo={() => {
            unlockAudio()
            stopSpeaking()
            sfx.tick()
            setPhase('peek')
          }}
          testId="nise-go"
        />
      )}

      {phase === 'peek' && (
        <section className="party-card nise-peek" style={{ borderColor: p.color }} data-testid="nise-peek">
          <span className="party-chip party-chip-big" style={{ background: p.color }}>
            {p.name}の おだい
          </span>
          <WordCard word={wordFor(round, who)} />
          <p className="nise-peek-note">
            おだいの ことばは いわないでね。
            <br />
            みんなと ちがう おだいかも？ はなしながら たしかめよう。
          </p>
          <button className="btn btn-go" onClick={hidePeek} data-testid="nise-hide">
            おぼえた！ かくす
          </button>
        </section>
      )}

      {phase === 'ready' && (
        <section className="party-card">
          <PikuruCut art="ok" height={110} />
          <h2 className="party-game">みんな おだいを みたね！</h2>
          <p className="party-howto">つくえの まんなかに おいて、はなしあい スタート。おだいの ことばは いっちゃ だめだよ。</p>
          <button className="btn btn-go" onClick={() => startTalk(talk, false)} data-testid="nise-talk">
            はなしあい スタート！（{talk / 60}ふん）
          </button>
        </section>
      )}

      {phase === 'talk' && (
        <section className="party-card nise-talk" data-testid="nise-talk-card">
          {tie && <p className="nise-tie">けっせん！ もう すこし はなそう</p>}
          {tie && counts && <VoteCounts counts={counts} players={players} />}
          <div className="nise-timer" data-low={left <= 10 || undefined} aria-label={`のこり ${Math.ceil(left)}びょう`}>
            {mmss(left)}
          </div>
          <div className="nise-hint">
            <PikuruCut art="think" height={80} />
            <div>
              <p className="nise-hint-title">はなす ヒント</p>
              <p className="nise-hint-text">💬 {TALK_HINTS[deck][hint % TALK_HINTS[deck].length]}</p>
            </div>
            <button className="btn btn-small" aria-label="つぎの ヒント" onClick={() => setHint((h) => h + 1)}>
              ▶
            </button>
          </div>
          <div className="party-actions">
            <button className="btn" onClick={() => setPaused((x) => !x)} data-testid="nise-pause">
              {paused ? '▶ つづける' : '⏸ とめる'}
            </button>
            <button className="btn" onClick={() => setPicking(true)} data-testid="nise-recheck">
              👀 おだいを みなおす
            </button>
            <button className="btn btn-go" onClick={toCount} data-testid="nise-to-point">
              ゆびさしへ
            </button>
          </div>
          {picking && (
            <div className="nise-pick-who">
              <p>だれが みる？</p>
              <div className="nise-color-grid">
                {players.map((q, i) => (
                  <button
                    key={q.name}
                    className="nise-color"
                    style={{ background: q.color }}
                    onClick={() => {
                      sfx.tick()
                      setWho(i)
                      setRecheck(true)
                      setPicking(false)
                      setPhase('pass')
                    }}
                  >
                    {q.name}
                  </button>
                ))}
              </div>
              <button className="btn btn-small" onClick={() => setPicking(false)}>
                やめる
              </button>
            </div>
          )}
        </section>
      )}

      {phase === 'count' && (
        <section className="party-card nise-count">
          <PikuruCut art="eh" height={110} />
          <h2 className="party-game">にせピクルくんは だれ？</h2>
          <p className="party-howto">にせピクルくんだと おもう ひとを、せーので ゆびさそう！</p>
          <button
            className="btn btn-go nise-seno"
            onClick={() => {
              sfx.whistle()
              speak(PHRASES.niseSeno)
              setPhase('point')
            }}
            data-testid="nise-seno"
          >
            👉 せーの！
          </button>
        </section>
      )}

      {phase === 'point' && (
        <section className="party-card" data-testid="nise-point">
          <h2 className="party-game">いちばん おおく ゆびを さされた ひとは？</h2>
          <div className="nise-color-grid">
            {players.map((q, i) => (
              <button
                key={q.name}
                className="nise-color"
                style={{ background: q.color }}
                onClick={() => reveal(i)}
                data-testid={`nise-point-${i}`}
              >
                {q.name}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => startTalk(TIE_TIME, true)} data-testid="nise-tie">
            おなじ かずの ひとが いた
          </button>
        </section>
      )}

      {phase === 'votePass' && (
        <Handoff
          name={players[voter].name}
          color={players[voter].color}
          sub={`とうひょう ${voter + 1} / ${count}にんめ`}
          note={`${players[voter].name}の ひとに わたしてね。ほかの ひとは みないでね！`}
          go={`${players[voter].name}だけで とうひょう（タッチ）`}
          onGo={() => {
            unlockAudio()
            stopSpeaking()
            sfx.tick()
            setPhase('vote')
          }}
          testId="nise-vote-go"
        />
      )}

      {phase === 'vote' && (
        <section className="party-card" style={{ borderColor: players[voter].color }} data-testid="nise-vote">
          <span className="party-chip party-chip-big" style={{ background: players[voter].color }}>
            {players[voter].name}の とうひょう
          </span>
          <h2 className="party-game">にせピクルくんは だれ？</h2>
          <div className="nise-color-grid">
            {players.map((q, i) =>
              i === voter ? null : (
                <button key={q.name} className="nise-color" style={{ background: q.color }} onClick={() => castVote(i)} data-testid={`nise-vote-${i}`}>
                  {q.name}
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {phase === 'reveal' && pointed !== null && (
        <section className="party-card nise-reveal" data-testid="nise-reveal">
          <span className="party-chip party-chip-big" style={{ background: players[pointed].color }}>
            {players[pointed].name}
          </span>
          {revealT.current < REVEAL_AT ? (
            <p className="nise-drum">は……</p>
          ) : (
            <>
              <PikuruCut art={pointed === round.wolf ? 'ok' : 'oops'} height={96} />
              <p className="nise-big" data-caught={pointed === round.wolf || undefined}>
                {pointed === round.wolf ? 'にせピクルくん だった！' : 'ほんものの ピクルくん！'}
              </p>
              {counts && <VoteCounts counts={counts} players={players} />}
              {pointed !== round.wolf && (
                <p className="nise-sub">
                  にせピクルくんは <b style={{ color: wolf.color }}>{wolf.name}</b> でした
                </p>
              )}
              {/* ばれたときは、ぎゃくてん チャンスが終わるまで お題を見せない */}
              {pointed !== round.wolf && <Answers round={round} />}
              {pointed === round.wolf ? (
                <button
                  className="btn btn-go"
                  onClick={() => {
                    sfx.go()
                    setAnswerShown(false)
                    setPhase('guess')
                    speak(PHRASES.niseChance)
                  }}
                  data-testid="nise-chance"
                >
                  ぎゃくてん チャンス！
                </button>
              ) : (
                <button className="btn btn-go" onClick={() => finishRound(round, judgeOutcome(round, pointed))} data-testid="nise-next">
                  けっか
                </button>
              )}
            </>
          )}
        </section>
      )}

      {phase === 'guess' && pointed !== null && (
        <section className="party-card" data-testid="nise-guess">
          <span className="party-chip party-chip-big" style={{ background: wolf.color }}>
            {wolf.name}
          </span>
          <h2 className="party-game">ぎゃくてん チャンス！</h2>
          {!answerShown ? (
            <>
              <p className="party-howto">
                {wolf.name}は、みんなの おだいを こえに だして いってみよう。いえるのは 1かいだけ！
                <br />
                あたったら、にせピクルくんの ぎゃくてん かち。
              </p>
              <button
                className="btn btn-go"
                onClick={() => {
                  sfx.tick()
                  setAnswerShown(true)
                }}
                data-testid="nise-answer"
              >
                いった！ こたえを みる
              </button>
            </>
          ) : (
            <>
              <p className="nise-answers-label">みんなの おだいは…</p>
              <WordCard word={majorityWord(round)} />
              <p className="party-howto">{wolf.name}の こたえは あってた？ みんなで きめてね。</p>
              <div className="party-actions">
                <button className="btn btn-go" onClick={() => finishRound(round, judgeOutcome(round, pointed, true))} data-testid="nise-guess-right">
                  あってた！
                </button>
                <button className="btn" onClick={() => finishRound(round, judgeOutcome(round, pointed, false))} data-testid="nise-guess-wrong">
                  ちがった
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {phase === 'result' && outcome && (
        <section className="party-card party-wide" data-testid="nise-result">
          <div className="nise-art">
            <PikuruCut art={outcome.winner === 'minna' ? 'ok' : 'eh'} height={96} />
          </div>
          <h2 className="party-game nise-win" data-winner={outcome.winner}>
            {outcome.how === 'reverse' ? 'ぎゃくてん！ にせピクルくんの かち！' : outcome.winner === 'minna' ? 'みんなの かち！' : 'にせピクルくんの かち！'}
          </h2>
          <Answers round={round} />
          {pair.tip && (
            <div className="nise-tip">
              <b>ちがいは？</b>
              <p>{pair.tip}</p>
            </div>
          )}
          <ul className="party-totals nise-stars">
            {players.map((q, i) => (
              <li key={q.name}>
                <span className="party-chip" style={{ background: q.color }}>
                  {q.name}
                </span>
                {i === round.wolf && <span className="nise-mark">にせ</span>}
                <b>
                  ⭐ {stars[i] ?? 0}
                  {gained[i] ? <small> +{gained[i]}</small> : null}
                </b>
              </li>
            ))}
          </ul>
          <RewardList rewards={rewards} />
          <div className="party-actions">
            <button className="btn btn-go" onClick={() => startRound(false)} data-testid="nise-again">
              つぎの おだい
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
      {share && outcome && (
        <ShareSheet
          fixed
          card={{
            game: 'nise',
            gameTitle: 'にせピクルくんは だれだ？',
            title: outcome.how === 'reverse' ? 'ぎゃくてん！ にせピクルくんの かち' : outcome.winner === 'minna' ? 'みんなで みやぶった！' : 'にせピクルくんの かち！',
            sub: `${count}にん・おだい「${DECK_INFO[round.deck].label}」`,
            face: outcome.winner === 'minna' ? 'ok' : 'eh',
            wear: getProgress().wear,
          }}
          onClose={() => setShare(false)}
        />
      )}

      {!['pass', 'peek', 'votePass', 'vote'].includes(phase) && (
        <button className="btn btn-small nise-help" aria-label="あそびかた・ルール" onClick={() => setHelp(true)}>
          ？
        </button>
      )}
      {help && <HowToSheet game="nise" onClose={() => setHelp(false)} fixed />}
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

/** 答えあわせ：みんなのお題と、にせピクルくんのお題 */
function Answers({ round }: { round: NiseRound }) {
  return (
    <div className="nise-answers">
      <div>
        <span className="nise-answers-label">みんなの おだい</span>
        <WordCard word={majorityWord(round)} size="small" />
      </div>
      <div>
        <span className="nise-answers-label">にせピクルくんの おだい</span>
        <WordCard word={wolfWord(round)} size="small" />
      </div>
    </div>
  )
}

/** こっそり とうひょうの票の数 */
function VoteCounts({ counts, players }: { counts: number[]; players: readonly { name: string; color: string }[] }) {
  return (
    <ul className="nise-votes" aria-label="とうひょうの かず">
      {players.map((q, i) => (
        <li key={q.name}>
          <span className="party-chip" style={{ background: q.color }}>
            {q.name}
          </span>
          <b>{counts[i] ?? 0}ひょう</b>
        </li>
      ))}
    </ul>
  )
}
