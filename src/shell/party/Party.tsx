/**
 * じゅんばんモード（2〜6人）。1台を順番に回して、ひとりで遊ぶゲームの記録で勝負する。
 * ホークアイ先生が司会：ラウンドのゲームを発表 →「◯◯の ばん！」→ 遊ぶ → ラウンドの結果 → 最後に表彰。
 * 同じラウンドでは全員に同じ障害・同じ球が出る（乱数の種が同じ）。レベルは1人ずつ選べる。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { countGame } from '../../core/counter'
import { LEVELS, LEVEL_INFO } from '../../core/players'
import type { Level } from '../../core/players'
import { getProgress, recordPlay, recordStart } from '../../core/progress'
import type { Reward } from '../../core/progress'
import { hashString, mulberry32 } from '../../core/rng'
import { sfx, unlockAudio } from '../../core/sound'
import { speak, stopSpeaking } from '../../core/speak'
import { Stage } from '../../core/Stage'
import { load, save } from '../../core/storage'
import { PHRASES } from '../../core/voiceLines'
import { useWakeLock } from '../../core/wakelock'
import { GameMenu, RewardList } from '../../ui/GameUI'
import { Handoff } from '../../ui/Handoff'
import { HowToSheet } from '../../ui/HowToSheet'
import { Hawk } from '../../ui/Hawk'
import { HawkCut } from '../../ui/hawkArt'
import { ShareSheet } from '../../ui/ShareSheet'
import { formatValue, gameById, GAMES } from '../games'
import type { GameId } from '../games'
import { GameView, HANDHELD } from '../Play'
import { PlayContext } from '../playContext'
import type { GameResult, PlayContextValue } from '../playContext'
import { champLine, MAX_PLAYERS, nextGameLine, PARTY_COLORS, teamWinLine, turnLine } from './colors'
import { defaultTeams, pickGames, pointsFor, ranks, standings, teamTotals, TEAMS } from './scoring'
import type { PartyPlayer } from './scoring'
import '../setup.css'
import './party.css'

type Phase = 'setup' | 'intro' | 'handoff' | 'play' | 'turn' | 'round' | 'final'

interface Run {
  players: PartyPlayer[]
  games: GameId[]
  seeds: number[]
  /** [ラウンド][人] の記録 */
  scores: number[][]
  /** そのラウンドのゲームは小さい記録ほど良いか */
  low: boolean[]
  /** チーム戦か */
  team: boolean
}

interface SavedSetup {
  count: number
  levels: Level[]
  rounds: number
  team?: boolean
  teams?: number[]
}

const POOL = GAMES.filter((g) => g.party).map((g) => g.id)
const ROUND_CHOICES = [3, 5]
/** そのゲームだけで遊ぶとき（同じゲームを何回するか） */
const FIXED_ROUND_CHOICES = [1, 2, 3]
const MEDAL = ['🥇', '🥈', '🥉']

/** fixed：ひとりで遊ぶゲームの準備画面から来たとき、そのゲームだけで勝負する */
export function Party({ fixed }: { fixed?: GameId }) {
  useWakeLock()
  const saved = useMemo(() => load<SavedSetup>('party-setup', { count: 3, levels: Array(MAX_PLAYERS).fill('kids'), rounds: 3 }), [])
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(saved.count)
  const [levels, setLevels] = useState<Level[]>(saved.levels)
  const firstOnly = fixed && POOL.includes(fixed) ? fixed : undefined
  const [rounds, setRounds] = useState(firstOnly ? 1 : saved.rounds)
  /** そのゲームだけで遊ぶ（無いときは、ラウンドごとにちがうゲーム） */
  const [only, setOnly] = useState<GameId | undefined>(firstOnly)
  const roundChoices = only ? FIXED_ROUND_CHOICES : ROUND_CHOICES
  const [teamMode, setTeamMode] = useState(saved.team ?? false)
  const [teams, setTeams] = useState<number[]>(saved.teams ?? defaultTeams(MAX_PLAYERS))
  const [run, setRun] = useState<Run | null>(null)
  const [round, setRound] = useState(0)
  const [turn, setTurn] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [menu, setMenu] = useState(false)
  const [help, setHelp] = useState(false)
  const [share, setShare] = useState(false)
  const finishing = useRef(false)

  // そのゲームだけのときのラウンド数は、いつもの設定（いろいろ）に残さない
  const mixRounds = useRef(ROUND_CHOICES.includes(saved.rounds) ? saved.rounds : 3)
  if (!only) mixRounds.current = rounds
  useEffect(() => save('party-setup', { count, levels, rounds: mixRounds.current, team: teamMode, teams }), [count, levels, rounds, teamMode, teams, only])
  useEffect(() => () => stopSpeaking(), [])

  const players: PartyPlayer[] = PARTY_COLORS.slice(0, count).map((c, i) => ({ name: c.name, color: c.color, level: levels[i] ?? 'kids', team: teamMode ? (teams[i] ?? i % 2) : undefined }))
  // チーム戦は、どちらのチームにも1人はいること
  const teamsOk = !teamMode || (players.some((p) => p.team === 0) && players.some((p) => p.team === 1))
  const game = run ? gameById(run.games[round]) : undefined
  const player = run?.players[turn]

  const start = () => {
    unlockAudio()
    sfx.go()
    const base = hashString(`${Date.now()}:${Math.random()}`)
    const games = only ? Array.from({ length: rounds }, () => only) : pickGames(POOL, rounds, mulberry32(base))
    setRun({
      players,
      games,
      seeds: games.map((_, i) => hashString(`${base}:${i}`)),
      scores: games.map(() => []),
      low: games.map((g) => gameById(g)?.better === 'low'),
      team: teamMode,
    })
    setRound(0)
    setTurn(0)
    setRewards([])
    setPhase('intro')
    recordStart('party')
    countGame('party')
    const g = gameById(games[0])
    if (g) speak([nextGameLine(g.title), g.howto])
  }

  const goHandoff = (r: Run, t: number) => {
    setTurn(t)
    setPhase('handoff')
    speak(turnLine(r.players[t].name))
  }

  const finishTurn = (r: GameResult) => {
    if (!run || finishing.current) return
    finishing.current = true
    const value = r.value ?? 0
    const g = run.games[round]
    // 記録は1回だけ（更新関数の中で呼ぶと、開発中の StrictMode で2回数えてしまう）
    const got = recordPlay({ type: 'finish', game: g, value, two: false })
    setRewards((x) => [...x, ...got])
    setRun((cur) => {
      if (!cur) return cur
      const scores = cur.scores.map((s) => [...s])
      scores[round][turn] = value
      return { ...cur, scores }
    })
    // 終わった瞬間を少し見せてから
    window.setTimeout(() => {
      finishing.current = false
      setMenu(false)
      setHelp(false)
      setPhase('turn')
    }, 900)
  }

  const nextAfterTurn = () => {
    if (!run) return
    sfx.tick()
    if (turn + 1 < run.players.length) goHandoff(run, turn + 1)
    else {
      setPhase('round')
      speak(PHRASES.partyRound)
    }
  }

  const nextAfterRound = () => {
    if (!run) return
    sfx.tick()
    if (round + 1 < run.games.length) {
      setRound(round + 1)
      setTurn(0)
      setPhase('intro')
      const g = gameById(run.games[round + 1])
      if (g) speak([nextGameLine(g.title), g.howto])
    } else {
      setPhase('final')
      sfx.fanfare()
      if (run.team) {
        const [a, b] = teamTotals(run.scores, run.players.map((p) => p.team ?? 0), run.low)
        speak(a === b ? PHRASES.partyEnd : [teamWinLine(TEAMS[a > b ? 0 : 1].name), PHRASES.partyEnd])
      } else {
        const st = standings(run.scores, run.players.length, run.low)
        const champs = st.filter((s) => s.rank === 1)
        speak(champs.length === 1 ? [champLine(run.players[champs[0].player].name), PHRASES.partyEnd] : PHRASES.partyEnd)
      }
      const got = recordPlay({ type: 'party' })
      setRewards((x) => [...x, ...got])
    }
  }

  const ctx = useMemo<PlayContextValue | null>(
    () =>
      run && player && game
        ? {
            game: game.id,
            contest: { seed: run.seeds[round] },
            paddles: [
              { design: 'orange', shape: 'std', tint: player.color },
              { design: 'blue', shape: 'std' },
            ],
            finish: finishTurn,
            rewards: [],
          }
        : null,
    // finishTurn は round・turn が変わると作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run?.seeds, round, turn, player?.color, game?.id],
  )

  // テスト用：いまの人の記録を決めて終わらせる（開発中だけ）
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __partyFinish?: (v: number) => void }
    w.__partyFinish = phase === 'play' && ctx ? (v: number) => ctx.finish({ value: v }) : undefined
  }, [phase, ctx])

  // ---------- 遊んでいるところ ----------
  if (phase === 'play' && run && player && game && ctx) {
    const handheld = HANDHELD.includes(game.id)
    return (
      <PlayContext.Provider value={ctx}>
        <Stage rotate={!handheld}>
          <GameView game={game.id} round={round * 10 + turn} props={{ levels: [player.level, player.level], paused: menu || help, onRestart: () => {} }} />
          <div className="party-badge" style={{ background: player.color }} data-corner={handheld || undefined}>
            {player.name}
          </div>
          <GameMenu
            open={menu}
            onOpen={() => setMenu(true)}
            onClose={() => setMenu(false)}
            onHelp={() => {
              stopSpeaking()
              setMenu(false)
              setHelp(true)
            }}
            corner={handheld}
          />
          {help && <HowToSheet game={game.id} onClose={() => setHelp(false)} />}
        </Stage>
      </PlayContext.Provider>
    )
  }

  return (
    <main className="party">
      {phase === 'setup' && (
        <>
          <header className="party-head">
            <a className="btn btn-small" href="#/" aria-label="もどる">
              ←
            </a>
            <h1 className="party-title">じゅんばんモード</h1>
          </header>
          <div className="party-intro">
            <HawkCut art="ok" height={92} />
            <p>1だいを じゅんばんに まわして、おなじ ゲームの きろくで しょうぶ！ さいごに ホークアイ先生が ひょうしょう するよ。</p>
            <button className="btn btn-small" aria-label="せつめいを よみあげる" onClick={() => speak(PHRASES.partyIntro)}>
              🗣️
            </button>
          </div>

          <h2 className="party-label">なんにんで あそぶ？</h2>
          <div className="seg party-seg" role="radiogroup" aria-label="にんずう">
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} data-testid={`party-count-${n}`}>
                {n}にん
              </button>
            ))}
          </div>

          <ul className={`party-players ${teamMode ? 'party-players-team' : ''}`}>
            {players.map((p, i) => (
              <li key={p.name}>
                <span className="party-chip" style={{ background: p.color }}>
                  {p.name}
                </span>
                <button
                  className="party-level"
                  aria-label={`${p.name}の レベル ${LEVEL_INFO[p.level].label}（おすと かわる）`}
                  onClick={() => {
                    sfx.tick()
                    setLevels((ls) => {
                      const next = [...ls]
                      next[i] = LEVELS[(LEVELS.indexOf(ls[i] ?? 'kids') + 1) % LEVELS.length]
                      return next
                    })
                  }}
                >
                  <span aria-hidden>{LEVEL_INFO[p.level].mark}</span> {LEVEL_INFO[p.level].label}
                </button>
                {teamMode && (
                  <button
                    className="party-team"
                    style={{ background: TEAMS[p.team ?? 0].color }}
                    aria-label={`${p.name}の チーム ${TEAMS[p.team ?? 0].name}（おすと かわる）`}
                    data-testid={`party-team-${i}`}
                    onClick={() => {
                      sfx.tick()
                      setTeams((ts) => {
                        const next = [...ts]
                        next[i] = (ts[i] ?? i % 2) === 0 ? 1 : 0
                        return next
                      })
                    }}
                  >
                    {TEAMS[p.team ?? 0].name}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="party-note">レベルを おすと かわるよ（ちびっこ → キッズ → おとな → せんしゅ）</p>

          <h2 className="party-label">あそびかた</h2>
          <div className="seg party-seg" role="radiogroup" aria-label="ひとりずつ か チームせん">
            {([false, true] as const).map((t) => (
              <button key={String(t)} role="radio" aria-checked={teamMode === t} onClick={() => setTeamMode(t)} data-testid={t ? 'party-team-mode' : 'party-solo-mode'}>
                {t ? 'チームせん' : 'ひとりずつ'}
              </button>
            ))}
          </div>
          {teamMode && (
            <p className="party-note">
              「{TEAMS[0].name}」と「{TEAMS[1].name}」の 2チーム。チームの ボタンを おすと かわるよ。チームの みんなの てんを たして しょうぶ（にんずうが ちがう ときは そろえて くらべる）。
            </p>
          )}

          <h2 className="party-label">でる ゲーム</h2>
          <div className="seg party-seg" role="radiogroup" aria-label="でる ゲーム">
            <button
              role="radio"
              aria-checked={!only}
              onClick={() => {
                setOnly(undefined)
                if (!ROUND_CHOICES.includes(rounds)) setRounds(3)
              }}
              data-testid="party-mix"
            >
              いろいろ
            </button>
            {(only ?? fixed) && (
              <button
                role="radio"
                aria-checked={!!only}
                onClick={() => {
                  setOnly(only ?? fixed)
                  if (!FIXED_ROUND_CHOICES.includes(rounds)) setRounds(1)
                }}
                data-testid="party-only"
              >
                {gameById(only ?? fixed)?.title}だけ
              </button>
            )}
          </div>

          <h2 className="party-label">なんラウンド？</h2>
          <div className="seg party-seg" role="radiogroup" aria-label="ラウンド">
            {roundChoices.map((n) => (
              <button key={n} role="radio" aria-checked={rounds === n} onClick={() => setRounds(n)} data-testid={`party-rounds-${n}`}>
                {n}ラウンド
              </button>
            ))}
          </div>
          <p className="party-note">{only ? `ぜんぶ ${gameById(only)?.title}。みんな おなじ コースで しょうぶ！` : `でる ゲーム：${POOL.map((id) => gameById(id)?.title).join('・')}`}</p>

          <button className="btn btn-go party-start" onClick={start} disabled={!teamsOk} data-testid="party-start">
            {teamsOk ? 'はじめる！' : 'どちらの チームにも 1にんは いれてね'}
          </button>
        </>
      )}

      {phase === 'intro' && run && game && (
        <section className="party-card" aria-live="polite">
          <p className="party-round">
            ラウンド {round + 1} / {run.games.length}
          </p>
          <Hawk face={game.face} size={110} />
          <h2 className="party-game">{game.title}</h2>
          <p className="party-howto">{game.howto}</p>
          <div className="party-actions">
            <button className="btn btn-small" aria-label="よみあげる" onClick={() => speak([nextGameLine(game.title), game.howto])}>
              🗣️
            </button>
            <button className="btn btn-go" onClick={() => goHandoff(run, 0)} data-testid="party-next">
              つぎへ
            </button>
          </div>
        </section>
      )}

      {phase === 'handoff' && run && player && game && (
        <Handoff
          name={player.name}
          color={player.color}
          sub={`${game.title}・${LEVEL_INFO[player.level].label}`}
          onGo={() => {
            unlockAudio()
            stopSpeaking()
            sfx.go()
            setPhase('play')
          }}
          testId="party-go"
        />
      )}

      {phase === 'turn' && run && player && game && (
        <section className="party-card">
          <span className="party-chip party-chip-big" style={{ background: player.color }}>
            {player.name}
          </span>
          <HawkCut art={isTop(run.scores[round], turn, run.low[round]) ? 'ok' : 'eh'} height={110} />
          <p className="party-value">{formatValue(game, run.scores[round][turn] ?? 0)}</p>
          {isTop(run.scores[round], turn, run.low[round]) && turn > 0 && <p className="party-top">いま トップ！</p>}
          <button className="btn btn-go" onClick={nextAfterTurn} data-testid="party-next">
            {turn + 1 < run.players.length ? `つぎは ${run.players[turn + 1].name}` : 'ラウンドの けっか'}
          </button>
        </section>
      )}

      {phase === 'round' && run && game && <RoundResult run={run} round={round} onNext={nextAfterRound} last={round + 1 >= run.games.length} />}

      {phase === 'final' && run && (
        <Final
          run={run}
          rewards={rewards}
          onAgain={() => {
            setPhase('setup')
            setRun(null)
          }}
          onShare={() => setShare(true)}
        />
      )}
      {share && run && (
        <ShareSheet
          fixed
          card={(() => {
            const st = standings(run.scores, run.players.length, run.low)
            const champ = run.players[st[0].player]
            const tt = run.team ? teamTotals(run.scores, run.players.map((p) => p.team ?? 0), run.low) : null
            return {
              game: 'party',
              gameTitle: 'じゅんばんモード',
              title: tt ? (tt[0] === tt[1] ? 'ひきわけ！' : teamWinLine(TEAMS[tt[0] > tt[1] ? 0 : 1].name)) : champLine(champ.name),
              sub: `${run.players.length}にん・${run.games.length}ラウンド`,
              face: 'ok' as const,
              wear: getProgress().wear,
              look: { design: 'orange' as const, shape: 'std' as const, tint: champ.color },
            }
          })()}
          onClose={() => setShare(false)}
        />
      )}
    </main>
  )
}

/** このラウンドで、いまの人が いちばん上か（low＝小さいほど良い） */
function isTop(round: number[], turn: number, low = false): boolean {
  const v = round[turn] ?? 0
  return round.slice(0, turn + 1).every((w) => (low ? w >= v : w <= v))
}

/** チーム戦の合計（2チーム） */
function TeamTotals({ run, upTo }: { run: Run; upTo: number }) {
  const t = teamTotals(run.scores.slice(0, upTo), run.players.map((p) => p.team ?? 0), run.low)
  return (
    <div className="party-teams">
      {TEAMS.map((tm, k) => (
        <div key={tm.name} className="party-team-total" style={{ borderColor: tm.color }}>
          <span className="party-team" style={{ background: tm.color }}>
            {tm.name}
          </span>
          <b>{t[k]}てん</b>
          <span className="party-team-members">
            {run.players
              .filter((p) => (p.team ?? 0) === k)
              .map((p) => (
                <i key={p.name} style={{ background: p.color }} title={p.name} />
              ))}
          </span>
        </div>
      ))}
    </div>
  )
}

function RoundResult({ run, round, onNext, last }: { run: Run; round: number; onNext: () => void; last: boolean }) {
  const values = run.scores[round]
  const g = gameById(run.games[round])
  const r = ranks(values, run.low[round])
  const order = run.players.map((p, i) => ({ p, i, v: values[i] ?? 0, rank: r[i] })).sort((a, b) => a.rank - b.rank)
  const st = standings(run.scores.slice(0, round + 1), run.players.length, run.low)
  return (
    <section className="party-card party-wide" data-testid="party-round">
      <p className="party-round">
        ラウンド {round + 1} の けっか（{gameById(run.games[round])?.title}）
      </p>
      <ol className="party-rank">
        {order.map(({ p, i, v, rank }) => (
          <li key={i}>
            <span className="party-medal">{MEDAL[rank - 1] ?? `${rank}い`}</span>
            <span className="party-chip" style={{ background: p.color }}>
              {p.name}
            </span>
            <span className="party-v">{formatValue(g, v)}</span>
            <span className="party-pt">+{pointsFor(rank)}</span>
          </li>
        ))}
      </ol>
      <p className="party-sub">ごうけい</p>
      {run.team && <TeamTotals run={run} upTo={round + 1} />}
      <ul className="party-totals">
        {st.map((s) => (
          <li key={s.player}>
            <span className="party-chip" style={{ background: run.players[s.player].color }}>
              {run.players[s.player].name}
            </span>
            <b>{s.total}</b>
          </li>
        ))}
      </ul>
      <button className="btn btn-go" onClick={onNext} data-testid="party-next">
        {last ? 'けっか はっぴょう！' : 'つぎの ラウンド'}
      </button>
    </section>
  )
}

function Final({ run, rewards, onAgain, onShare }: { run: Run; rewards: Reward[]; onAgain: () => void; onShare: () => void }) {
  const st = standings(run.scores, run.players.length, run.low)
  const podium = [1, 0, 2].map((k) => st[k]).filter(Boolean)
  const tt = run.team ? teamTotals(run.scores, run.players.map((p) => p.team ?? 0), run.low) : null
  return (
    <section className="party-card party-wide" data-testid="party-final">
      <h2 className="party-game">ひょうしょうしき</h2>
      {tt && (
        <div className="party-team-win" data-testid="party-team-win">
          <HawkCut art="ok" height={84} />
          <p className="party-game">{tt[0] === tt[1] ? 'ひきわけ！' : `チーム「${TEAMS[tt[0] > tt[1] ? 0 : 1].name}」の かち！`}</p>
          <TeamTotals run={run} upTo={run.scores.length} />
          <p className="party-sub">ひとりずつの けっか</p>
        </div>
      )}
      <div className="podium">
        {podium.map((s) => (
          <div key={s.player} className="podium-col" data-rank={s.rank}>
            {s.rank === 1 && !tt && <HawkCut art="ok" height={84} />}
            <span className="party-chip" style={{ background: run.players[s.player].color }}>
              {run.players[s.player].name}
            </span>
            <div className="podium-step">
              <span>{MEDAL[s.rank - 1] ?? `${s.rank}い`}</span>
              <b>{s.total}てん</b>
            </div>
          </div>
        ))}
      </div>
      {st.length > 3 && (
        <ul className="party-totals">
          {st.slice(3).map((s) => (
            <li key={s.player}>
              <span>{s.rank}い</span>
              <span className="party-chip" style={{ background: run.players[s.player].color }}>
                {run.players[s.player].name}
              </span>
              <b>{s.total}てん</b>
            </li>
          ))}
        </ul>
      )}
      <RewardList rewards={rewards} />
      <div className="party-actions">
        <button className="btn btn-go" onClick={onAgain}>
          もういちど
        </button>
        <a className="btn" href="#/">
          ホームへ
        </a>
        <button className="btn result-share" aria-label="きねんカード（おうちの人と いっしょに）" onClick={onShare}>
          📸
        </button>
      </div>
    </section>
  )
}
