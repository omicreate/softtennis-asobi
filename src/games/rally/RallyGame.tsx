/**
 * ラリーの画面。次の4つで使う：
 *   versus …… ラリーたいけつ（2人）／ホークアイ先生とラリー（cpu＝上はホークアイ先生）
 *   target …… ねらって ストローク（ひとりで。上はボールマシン）
 * 2人で遊ぶときは、指を置いた場所（上半分か下半分か）で持ち主を決める。ひとりのときは、どの指も下の人。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useFrame } from '../../core/loop'
import { LEVEL_INFO, LEVELS, SIDE_NAME, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { PHRASES } from '../../core/voiceLines'
import { Half, useStage } from '../../core/Stage'
import { getSettings } from '../../core/settings'
import { load, save } from '../../core/storage'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { Hawk } from '../../ui/Hawk'
import type { Face } from '../../ui/Hawk'
import { HawkCut } from '../../ui/hawkArt'
import { mulberry32 } from '../../core/rng'
import { usePlay } from '../../shell/playContext'
import { Cpu, CPU_SKILL } from './cpu'
import { drawRally, makeView, toWorld } from './draw'
import { RallyFx, STRONG_POWER } from './fx'
import { speedKmh } from './physics'
import { RallyEngine } from './engine'
import type { Games, Kind, ShotMiss } from './engine'
import { REASON_TEXT } from './rules'
import type { RuleMode } from './rules'
import { rankOf, SHOTS, shotHint, shotPoints, toNextRank } from './targets'
import './rally.css'

interface Props {
  kind: Kind
  levels: [Level, Level]
  mode: RuleMode
  target: number
  games?: Games
  /** 上の人をホークアイ先生（コンピューター）にする */
  cpu?: boolean
  paused: boolean
  onRestart: () => void
  /** レベルを変えて やりなおす（ホークアイ先生と ラリーの結果で、ひとつ やさしい／つよい レベルをすすめる） */
  onLevel?: (lv: Level) => void
}

const targetBest = (lv: Level) => `target-best-${lv}`
/** ねらって ストローク：さいこう得点（レベルごと。この端末にだけ保存） */
const targetScoreBest = (lv: Level) => `target-score-best-${lv}`
/** ホークアイ先生と ラリー：いちばん長く続いたラリー（レベルごと。この端末にだけ保存） */
const rallyBest = (lv: Level) => `sensei-rally-best-${lv}`
/** 試合の中のラリーの回数を画面に出しはじめる数 */
const RALLY_SHOW = 3
/** ひとりで遊ぶラリー・ねらって ストロークで、いちばん速かった球（km/h。この端末にだけ保存） */
const SPEED_BEST = 'rally-speed-best'

/** 打った手応えを、指に小さなふるえで返す（対応している端末だけ。Android の Chrome など）。音を切っているときは ふるえない */
function buzz(ms: number): void {
  if (!getSettings().sound) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    // ふるえに対応していない端末では何もしない
  }
}

/**
 * 結果のあとに すすめる レベル（かんたんルールだけ）。
 * 1てん以下で負けたら ひとつ やさしく、相手を1てん以下にして勝ったら ひとつ つよく。それ以外は すすめない。
 */
export function suggestLevel(lv: Level, won: boolean, mine: number, theirs: number): Level | null {
  const i = LEVELS.indexOf(lv)
  if (!won && mine <= 1 && i > 0) return LEVELS[i - 1]
  if (won && theirs <= 1 && i < LEVELS.length - 1) return LEVELS[i + 1]
  return null
}

const MISS_TEXT: Record<ShotMiss, { title: string; sub: string }> = {
  zone: { title: 'おしい！', sub: 'まとの そとに おちたよ' },
  out: { title: 'アウト！', sub: 'コートの そとに でたよ' },
  'double-bounce': { title: 'ツーバウンズ！', sub: '2かい はねる まえに かえそう' },
}

export function RallyGame({ kind, levels, mode, target, games, cpu = false, paused, onRestart, onLevel }: Props) {
  const stage = useStage()
  const play = usePlay()
  // じゅんばんモード（ねらって ストローク）：みんな同じ球の並び
  const contest = kind === 'target' ? play.contest : undefined
  const solo = cpu || kind === 'target'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useMemo(
    () => new RallyEngine({ kind, mode, levels, target, games, cpu: cpu ? 1 : undefined, rand: contest ? mulberry32(contest.seed) : undefined }),
    [kind, mode, levels, target, games, cpu, contest],
  )
  const sensei = useMemo(() => (cpu ? new Cpu(1, CPU_SKILL[levels[1]]) : null), [cpu, levels])
  const fx = useMemo(() => new RallyFx(), [engine])
  /** ねらって ストローク：つづけて入った数（いま・この回の さいこう） */
  const streak = useRef(0)
  const [bestStreak, setBestStreak] = useState(0)
  /** ラリーの節目（5・10・15…回）で回数の表示を はずませる */
  const [rallyBeat, setRallyBeat] = useState(0)
  const view = useMemo(() => makeView(stage.w, stage.h, kind === 'target' ? 1.3 : 0), [stage.w, stage.h, kind])
  const pointers = useRef(new Map<number, Side>())
  const owner = useRef<[number | null, number | null]>([null, null])
  const noticeTimer = useRef(0)

  const [score, setScore] = useState<[number, number]>([0, 0])
  const [notice, setNotice] = useState<NoticeData | null>(null)
  const [phase, setPhase] = useState(engine.phase)
  const [server, setServer] = useState<Side>(0)
  const [call, setCall] = useState('')
  const [gamesWon, setGamesWon] = useState<[number, number]>([0, 0])
  const [shots, setShots] = useState({ index: 0, hits: 0, label: '', best: load<number>(targetBest(levels[0]), 0), points: 0, bestPoints: load<number>(targetScoreBest(levels[0]), 0), record: false })
  const [over, setOver] = useState<{ winner: Side | null } | null>(null)
  /** ホークアイ先生と ラリー：いまのラリーで打った回数（サービスもふくむ）・この試合でいちばん長いラリー・これまでの さいこう */
  const [rallyNow, setRallyNow] = useState(0)
  const rallyHits = useRef(0)
  const [rallyLong, setRallyLong] = useState({ match: 0, best: load<number>(rallyBest(levels[0]), 0), record: false })
  /** ひとりのとき：この回で いちばん速かった球（km/h）と、これまでの さいこう */
  const topSpeed = useRef(0)
  const [speed, setSpeed] = useState({ match: 0, best: load<number>(SPEED_BEST, 0), record: false })
  /** ホークアイ先生（審判・相手・マシンの係）の表情。しばらくすると「かんがえる」に戻る */
  const [pkFace, setPkFace] = useState<Face>('think')
  const pkTimer = useRef(0)
  const react = (face: Face, seconds = 1.8) => {
    setPkFace(face)
    pkTimer.current = seconds
  }
  /** 審判のホークアイ先生を出すか（2人で遊ぶラリー） */
  const umpire = !solo

  const showLanding = levels.some((l) => LEVEL_INFO[l].assist > 0)
  /** 得点した側の名前（ひとりのときは「あなた」と「ホークアイ先生」） */
  const name = (s: Side) => (cpu ? (s === 0 ? 'あなた' : 'ホークアイ先生') : SIDE_NAME[s])

  // 開発中とテスト（Playwright）だけ、進行を外から見られるようにする
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __rally?: RallyEngine }).__rally = engine
  }, [engine])

  // canvas の大きさ（高精細の画面でもぼやけないように）
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    c.width = Math.round(stage.w * dpr)
    c.height = Math.round(stage.h * dpr)
    c.style.width = `${stage.w}px`
    c.style.height = `${stage.h}px`
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [stage.w, stage.h])

  /** 知らせを出す。ひとりのときは自分の側だけ（向きを回さない） */
  const flash = (data: NoticeData, seconds: number) => {
    setNotice(solo ? { ...data, only: 0, faces: undefined, face: data.faces?.[0] ?? data.face } : data)
    noticeTimer.current = seconds
  }

  /** いちばん新しいコマの時刻（ms。指の動いた時刻を、ゲームの時刻に直すのに使う） */
  const frameAt = useRef(0)

  useFrame((dt, now) => {
    frameAt.current = now
    // 強く打った瞬間は、球と相手をほんの一瞬止める（演出だけ。粒や輪は動かし続ける）
    const hold = !paused && fx.holding(dt)
    if (!paused && hold) fx.update(dt, null)
    if (!paused && !hold) {
      if (noticeTimer.current > 0) {
        noticeTimer.current -= dt
        if (noticeTimer.current <= 0) setNotice(null)
      }
      if (pkTimer.current > 0) {
        pkTimer.current -= dt
        if (pkTimer.current <= 0) setPkFace('think')
      }
      sensei?.update(engine, dt)
      for (const ev of engine.step(dt)) {
        switch (ev.type) {
          case 'countdown':
            sfx.tick()
            flash({ title: String(ev.n), big: true }, 0.9)
            break
          case 'serve':
            fx.reset()
            rallyHits.current = 0
            if (cpu) setRallyNow(0)
            setServer(ev.server)
            setCall(mode === 'real' && kind === 'versus' ? `${engine.serveNo === 2 ? 'セカンド　' : ''}${engine.scoreCall()}` : '')
            if (kind === 'versus') sfx.go()
            break
          case 'feed':
            fx.reset()
            setShots((s) => ({ ...s, index: ev.index, label: ev.zone.label }))
            break
          case 'hit': {
            sfx.pop(Math.min(1, ev.power))
            rallyHits.current += 1
            const mine = !cpu || ev.side === 0
            fx.hit({ x: engine.ball.x, y: engine.ball.y }, ev.power, mine)
            // ひとりで遊ぶとき：自分の球の速さを見せる（振る速さが そのまま球の速さになる）
            if (solo && ev.side === 0) {
              const strong = ev.power >= STRONG_POWER
              const kmh = speedKmh(ev.power)
              fx.speed({ x: engine.ball.x, y: engine.ball.y }, kmh, strong)
              topSpeed.current = Math.max(topSpeed.current, kmh)
              buzz(strong ? 18 : 8)
            } else if (!solo) buzz(8)
            if (cpu) {
              setRallyNow(rallyHits.current)
              if (rallyHits.current % 5 === 0) {
                fx.celebrate({ x: engine.ball.x, y: engine.ball.y })
                setRallyBeat((b) => b + 1)
              }
            }
            break
          }
          case 'bounce':
            sfx.bounce()
            break
          case 'fault': {
            // ファーストサービスのフォールト：点は動かず、セカンドサービス
            sfx.ng()
            const why = REASON_TEXT.fault
            flash({ title: why.kids, sub: mode === 'real' ? why.rule : undefined }, 1.4)
            react('eh')
            break
          }
          case 'point': {
            sfx.whistle()
            const why = REASON_TEXT[ev.fault.reason]
            const faces: [NoticeData['face'], NoticeData['face']] = [undefined, undefined]
            faces[ev.winner] = 'ok'
            faces[other(ev.winner)] = 'oops'
            const sub = mode === 'real' ? `${why.kids} ${why.rule}` : why.kids
            const title = ev.game ? `ゲーム！ ${name(ev.winner)}` : `${name(ev.winner)}の てん！`
            flash({ title, sub, faces }, 1.8)
            setScore([engine.score[0], engine.score[1]])
            if (cpu) {
              const n = rallyHits.current
              setRallyLong((r) => (n > r.match ? { ...r, match: n } : r))
            }
            setGamesWon([engine.gamesWon[0], engine.gamesWon[1]])
            if (cpu) react(ev.winner === 1 ? 'ok' : 'oops')
            // 審判：サービスの反則（ダブルフォールト・ダイレクト）は「えっ！？」、ふつうの得点は「！」
            else react(['double-fault', 'direct'].includes(ev.fault.reason) ? 'eh' : 'ok')
            break
          }
          case 'shot':
            if (ev.ok) {
              sfx.ok()
              streak.current += 1
              const n = streak.current
              setBestStreak((b) => Math.max(b, n))
              // 入った場所で はじけて、その球の得点（れんぞくの数とボーナスは下の知らせに出す）
              if (ev.at) fx.celebrate(ev.at, `+${ev.points}`)
              const deep = ev.at ? shotPoints(ev.at, 0, 1).deep : false
              const bonus = [deep ? 'ふかい！' : '', n >= 2 ? `れんぞく ボーナス` : ''].filter(Boolean).join('　')
              flash({ title: n >= 2 ? `${n}れんぞく！` : 'ナイス！', sub: bonus || (n >= 3 ? 'その ちょうし！' : 'ねらいどおり'), face: 'ok' }, 1.3)
              speak(PHRASES.nice)
              react('ok', 1.3)
            } else {
              sfx.ng()
              streak.current = 0
              const m = MISS_TEXT[ev.reason ?? 'zone']
              // どちらへ ずれたかと 直し方（落ちた場所が分かるとき）
              const hint = ev.at && engine.zone ? shotHint(engine.zone, ev.at) : ''
              flash({ title: m.title, sub: hint || m.sub, face: 'oops' }, hint ? 1.9 : 1.3)
              react('oops', 1.3)
            }
            setShots((s) => ({ ...s, hits: ev.hits, points: ev.total }))
            break
          case 'over':
            sfx.fanfare()
            setNotice(null)
            play.finish(kind === 'target' ? { value: engine.hits } : { winner: ev.winner })
            if (solo && !contest) {
              const top = topSpeed.current
              setSpeed((sp) => {
                if (top > sp.best) save(SPEED_BEST, top)
                return { match: top, best: Math.max(sp.best, top), record: top > sp.best && sp.best > 0 }
              })
            }
            if (contest) {
              setOver({ winner: ev.winner })
              break
            }
            if (kind === 'target') {
              setShots((s) => {
                const best = Math.max(s.best, engine.hits)
                save(targetBest(levels[0]), best)
                const record = engine.points > s.bestPoints && engine.points > 0
                if (record) save(targetScoreBest(levels[0]), engine.points)
                if (record) speak(PHRASES.great)
                return { ...s, hits: engine.hits, best, points: engine.points, bestPoints: Math.max(s.bestPoints, engine.points), record }
              })
            } else if (cpu) {
              speak(ev.winner === 0 ? PHRASES.youWin : PHRASES.senseiWin)
              setRallyLong((r) => {
                if (r.match > r.best) save(rallyBest(levels[0]), r.match)
                // 「さいこう きろく！」と言うのは、ある程度 続いたときだけ
                const record = r.match > r.best && r.match >= RALLY_SHOW
                return { ...r, best: Math.max(r.best, r.match), record }
              })
            } else if (ev.winner !== null) {
              speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
            }
            setOver({ winner: ev.winner })
            break
        }
      }
      if (engine.phase !== phase) setPhase(engine.phase)
      fx.update(dt, engine.ballVisible && engine.phase === 'play' ? engine.ball : null)
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawRally(ctx, stage.w, stage.h, view, engine, { fx, showLanding, realRules: mode === 'real' && kind === 'versus', solo, senseiFace: pkFace, paddles: play.paddles })
  })

  // 指
  const toCourt = (e: PointerEvent) => {
    const p = stage.toLogical(e.clientX, e.clientY)
    // ひとりのときは、どこを触っても自分（下）のラケット
    const side: Side = solo ? 0 : p.y < stage.h / 2 ? 1 : 0
    return { side, ...toWorld(view, p.x, p.y) }
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 指を捕まえられなくても動く（canvas の外に出た指を追えないだけ）
    }
    const { side, x, y } = toCourt(e)
    pointers.current.set(e.pointerId, side)
    owner.current[side] = e.pointerId
    engine.setFinger(side, true, x, y, fingerTime(e))
  }
  /**
   * 指が動いた時刻を、ゲームの時刻（秒）に直す。いまのコマから先へ最大 0.05 秒まで。
   * 指の時刻とコマの時刻の物差しが ちがう端末（1秒以上ずれる）では、コマの時刻を使う（速さが いつも 0 にならないように）
   */
  const fingerTime = (e: PointerEvent) => {
    const ahead = (e.timeStamp - frameAt.current) / 1000
    if (!Number.isFinite(ahead) || Math.abs(ahead) > 1) return engine.time
    return engine.time + Math.min(0.05, Math.max(0, ahead))
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId)
    if (side === undefined || owner.current[side] !== e.pointerId) return
    const { x, y } = toCourt(e)
    engine.setFinger(side, true, x, y, fingerTime(e))
  }
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const side = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (side === undefined || owner.current[side] !== e.pointerId) return
    owner.current[side] = null
    engine.setFinger(side, false, 0, 0)
  }

  const again = () => onRestart()

  const showServeHint = phase === 'serve' && !over && kind !== 'target' && !(cpu && server === 1)
  /** ほんかくの複数ゲームのとき「1-0」のようにゲーム数を見せる */
  const gameText = mode === 'real' && kind === 'versus' && (games ?? 1) > 1 ? `${gamesWon[0]}-${gamesWon[1]}` : ''

  return (
    <div className="rally" data-kind={kind} data-phase={phase} data-solo={solo || undefined}>
      <canvas
        ref={canvasRef}
        className="rally-canvas"
        data-testid="rally-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {umpire && (
        <div className="umpire" aria-label="しんぱんの ホークアイ先生">
          <HawkCut art={pkFace} height={Math.round(Math.min(96, stage.w * 0.2))} />
        </div>
      )}
      {kind === 'target' && (
        <>
          <div className="solo-banner" aria-live="polite">
            <Hawk face="think" size={40} />
            <span>{shots.label || 'ボールマシンから ボールが くるよ'}</span>
          </div>
          <div className="solo-score">
            <span>
              {Math.min(shots.index + 1, SHOTS)} / {SHOTS} きゅう
            </span>
            <span className="solo-score-main" data-testid="target-points">
              {shots.points}てん
            </span>
            <span>まと {shots.hits}</span>
          </div>
        </>
      )}
      {kind === 'versus' && cpu && (
        <div className="solo-score" aria-label={`あなた ${score[0]}てん、ホークアイ先生 ${score[1]}てん${gameText ? `、ゲーム ${gameText}` : ''}`}>
          <span>あなた</span>
          <span className="solo-score-main">
            {score[0]} - {score[1]}
          </span>
          <span>せんせい</span>
          {gameText && <span className="solo-score-games">ゲーム {gameText}</span>}
        </div>
      )}
      {kind === 'versus' && cpu && phase === 'play' && rallyNow >= RALLY_SHOW && (
        <div className="rally-count" data-testid="rally-count" data-beat={rallyBeat % 2} key={rallyBeat}>
          ラリー <b>{rallyNow}</b>かい
        </div>
      )}
      {kind === 'versus' && !cpu && <Scores score={score} games={gameText ? gamesWon : undefined} />}
      {showServeHint && <ServeHint side={server} level={levels[server]} call={call} />}
      <Notice data={notice} />
      {over && kind === 'target' && !contest && (
        <Result
          single
          title={() => `ランク ${rankOf(shots.points)}　${shots.points}てん`}
          sub={() => `${SHOTS}きゅう中 ${shots.hits}きゅう まとに はいった！ ${shots.record ? 'さいこう きろく！' : `さいこうは ${shots.bestPoints}てん（${LEVEL_INFO[levels[0]].label}）`}`}
          face={() => (rankOf(shots.points) === 'S' || rankOf(shots.points) === 'A' ? 'ok' : 'eh')}
          onAgain={again}
          extra={
            <>
              <RankLine points={shots.points} />
              {bestStreak >= 2 && (
                <div className="rally-long">
                  いちばん ながい れんぞく <b>{bestStreak}きゅう</b>
                </div>
              )}
              <SpeedLine speed={speed} />
            </>
          }
        />
      )}
      {over && kind === 'versus' && cpu && (
        <Result
          single
          title={() => (over.winner === 0 ? 'かち！ ホークアイ先生に かったね' : 'ホークアイ先生の かち！')}
          sub={() => (gameText ? `ゲーム ${gameText}（あなた たい せんせい）` : `あなた ${score[0]} たい ${score[1]} せんせい`)}
          face={() => (over.winner === 0 ? 'oops' : 'ok')}
          onAgain={again}
          extra={
            <>
              <SenseiExtra long={rallyLong} level={levels[0]} next={mode === 'easy' ? suggestLevel(levels[0], over.winner === 0, score[0], score[1]) : null} onLevel={onLevel} />
              <SpeedLine speed={speed} />
            </>
          }
        />
      )}
      {over && kind === 'versus' && !cpu && (
        <Result
          title={(side) => (side === over.winner ? 'かち！ やったね' : 'おしい！')}
          sub={(side) => (gameText ? `ゲーム ${gamesWon[side]} たい ${gamesWon[other(side)]}` : `${score[side]} たい ${score[other(side)]}`)}
          face={(side) => (side === over.winner ? 'ok' : 'oops')}
          onAgain={again}
        />
      )}
    </div>
  )
}

/** ねらって ストロークの結果：ランクと、つぎのランクまで あと何点か */
function RankLine({ points }: { points: number }) {
  const rank = rankOf(points)
  const next = toNextRank(points)
  return (
    <div className="rally-rank" data-rank={rank} data-testid="target-rank">
      <span className="rally-rank-badge">{rank}</span>
      <small>{next ? `ランク ${next.rank}まで あと ${next.need}てん` : 'さいこうランク！ ぜんぶ ねらいどおり'}</small>
    </div>
  )
}

/** 結果：この回で いちばん速かった球（ひとりのとき） */
function SpeedLine({ speed }: { speed: { match: number; best: number; record: boolean } }) {
  if (speed.match <= 0) return null
  return (
    <div className="rally-long rally-speed" data-testid="rally-speed">
      いちばん はやい ボール <b>{speed.match}km/h</b>
      <small>{speed.record ? 'さいこう きろく！' : `さいこう ${speed.best}km/h`}</small>
    </div>
  )
}

/** ホークアイ先生と ラリーの結果：いちばん長いラリーと、つぎに すすめる レベル */
function SenseiExtra({ long, level, next, onLevel }: { long: { match: number; best: number; record: boolean }; level: Level; next: Level | null; onLevel?: (lv: Level) => void }) {
  const up = next !== null && LEVELS.indexOf(next) > LEVELS.indexOf(level)
  return (
    <>
      {long.match > 0 && (
        <div className="rally-long" data-testid="rally-long">
          いちばん ながい ラリー <b>{long.match}かい</b>
          <small>{long.record ? 'さいこう きろく！' : `さいこう ${long.best}かい（${LEVEL_INFO[level].label}）`}</small>
        </div>
      )}
      {next && onLevel && (
        <button className="btn rally-next" data-testid="rally-next" onClick={() => onLevel(next)}>
          {LEVEL_INFO[next].mark} {up ? `つぎは ${LEVEL_INFO[next].label}に ちょうせん！` : `${LEVEL_INFO[next].label}で れんしゅう する`}
        </button>
      )}
    </>
  )
}

function ServeHint({ side, level, call }: { side: Side; level: Level; call: string }) {
  const auto = LEVEL_INFO[level].keepIn
  return (
    <Half side={side} interactive={false}>
      <div className="serve-hint">
        {call && (
          <span className="serve-call" aria-label={`スコアの コール ${call}`}>
            {call}
          </span>
        )}
        <span className="serve-arrow" aria-hidden>
          ⬆
        </span>
        {auto ? 'うえに シュッ！で サービス（まってもOK）' : 'うえに シュッ！と ふって サービス'}
      </div>
    </Half>
  )
}
