/**
 * よみあい サーブ（ふたり）の画面。机に置いて上下で向かい合う。
 * 選ぶ番の人の半分に、ねらう所（まつ所）のボタン・2ばいカード・のこり時間・「きめた！」を出す。
 * 相手の半分は「めを とじてね」とピクルくん。話しかけて ゆさぶってよい（ヒントを出す）。
 * 発表は、サーブの球が飛んでいき、レシーブ側のパドルが待つ所へ動く演出で見せる。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '../../core/loop'
import { SIDE_COLOR, SIDE_NAME } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { getSettings } from '../../core/settings'
import { sfx, unlockAudio } from '../../core/sound'
import { speak } from '../../core/speak'
import { Half } from '../../core/Stage'
import { PHRASES } from '../../core/voiceLines'
import { turnLine } from '../../shell/party/colors'
import { usePlay } from '../../shell/playContext'
import { Notice, Result, Scores } from '../../ui/GameUI'
import type { NoticeData } from '../../ui/GameUI'
import { Handoff } from '../../ui/Handoff'
import { drawPaddleArt } from '../../ui/paddleArt'
import { PikuruCut } from '../../ui/pikuruArt'
import { choose, createSr, currentStep, FINAL_MULT, finishStep, isFinal, REVEAL_TIME, ROUNDS, SPOT_LABEL, SPOT_POINTS, SPOTS, stepSr, TAUNTS, toggleDouble } from './serveread'
import type { ServeResult, Spot, SrEvent, SrState } from './serveread'
import './serveread.css'

interface Props {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

/** 発表の時間割（秒） */
const T_SERVE = 1.0
const T_ARRIVE = 1.9
const T_TEXT = 2.1
const T_POINTS = 2.7

/** ねらう所の小さな図（相手のサービスコートを上から） */
function SpotIcon({ spot }: { spot: Spot }) {
  const x = spot === 'wide' ? 12 : spot === 'center' ? 52 : 32
  return (
    <svg className="sr-icon" viewBox="0 0 64 48" aria-hidden>
      <rect x="2" y="2" width="60" height="44" rx="4" fill="#2f5d9a" stroke="#fff" strokeWidth="2" />
      <line x1="62" y1="2" x2="62" y2="46" stroke="#fff" strokeWidth="3" />
      <circle cx="32" cy="22" r="6" fill="#ffe7b8" stroke="#12302b" strokeWidth="2" />
      <circle cx={x} cy={spot === 'body' ? 14 : 18} r="6" fill="#d4f03c" stroke="#2e5a1c" strokeWidth="2" />
    </svg>
  )
}

export function ServeReadGame({ paused, onRestart }: Props) {
  const play = usePlay()
  /** てわたし：1台を渡しあい、選ぶ人だけが画面を見る（始めたときの設定で固定） */
  const [pass] = useState(() => getSettings().srStyle === 'pass')
  const game = useMemo<SrState>(() => createSr(getSettings().srTime, !pass), [pass])
  /** てわたしの幕（次に選ぶ人の色）。幕の間は時間を止める */
  const [curtain, setCurtain] = useState(false)
  const [, setTick] = useState(0)
  const [notice, setNotice] = useState<NoticeData | null>({ title: `${ROUNDS}かい しょうぶ！`, sub: `さいごの ラウンドは とくてん ${FINAL_MULT}ばい`, face: 'think' })
  const [over, setOver] = useState<Side | null>(null)
  const [taunt, setTaunt] = useState(0)
  const noticeTimer = useRef(2.4)
  const revealT = useRef(0)

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sr?: SrState }).__sr = game
  }, [game])

  const handle = (events: SrEvent[]) => {
    for (const ev of events) {
      switch (ev.type) {
        case 'step':
          sfx.tick()
          setTaunt(Math.floor(Math.random() * TAUNTS.length))
          if (pass) {
            setCurtain(true)
            const final = ev.step.side === game.server && game.serveNo === 0 && ev.final
            speak(final ? PHRASES.srFinal : turnLine(SIDE_NAME[ev.step.side]))
          } else if (ev.step.kind === 'first' && ev.step.side === game.server && game.serveNo === 0 && ev.final) {
            setNotice({ title: 'ファイナル ラウンド！', sub: `とくてん ${FINAL_MULT}ばい！ ぎゃくてんの チャンス`, face: 'eh' })
            noticeTimer.current = 2
            speak(PHRASES.srFinal)
          } else if (ev.step.kind === 'last' && ev.step.side === game.server) {
            speak(PHRASES.srLast)
          }
          break
        case 'tick':
          sfx.tick()
          break
        case 'reveal':
          revealT.current = 0
          setNotice(null)
          break
        case 'over':
          sfx.fanfare()
          speak(ev.winner === 0 ? PHRASES.win0 : PHRASES.win1)
          play.finish({ winner: ev.winner })
          setOver(ev.winner)
          break
      }
    }
  }

  useFrame((dt) => {
    if (paused || over !== null) return
    if (noticeTimer.current > 0) {
      noticeTimer.current -= dt
      if (noticeTimer.current <= 0) setNotice(null)
    }
    if (pass && curtain) return
    // 発表の効果音（時間割に合わせて）
    if (game.phase === 'reveal' && game.last) {
      const a = revealT.current
      const b = a + dt
      revealT.current = b
      const cross = (t: number) => a < t && b >= t
      for (const t of [0.15, 0.35, 0.55, 0.7, 0.82]) if (cross(t)) sfx.tick()
      if (cross(T_SERVE)) sfx.pop(0.9)
      if (cross(T_ARRIVE)) {
        if (game.last.read) sfx.pop(0.6)
        else sfx.whistle()
      }
      if (cross(T_TEXT)) {
        if (game.last.read) {
          sfx.ok()
          speak(PHRASES.srRead)
        } else {
          sfx.ok()
          speak(PHRASES.srAce)
        }
      }
      if (cross(T_POINTS) && (game.last.doubles[game.last.gainer] || game.last.final)) sfx.fanfare()
    }
    handle(stepSr(game, dt))
    setTick((n) => (n + 1) % 1000)
  })

  const act = (fn: () => void) => {
    unlockAudio()
    if (paused || over !== null) return
    fn()
    setTick((n) => (n + 1) % 1000)
  }

  const step = currentStep(game)
  const final = isFinal(game)

  if (pass) {
    const picker = step?.side
    return (
      <div className="sr sr-pass" data-phase={game.phase}>
        <header className="sr-pass-head">
          <span className="sr-pass-score" style={{ background: SIDE_COLOR[0] }}>
            {SIDE_NAME[0]} {game.score[0]}
          </span>
          <span className="sr-round">
            {game.round > ROUNDS ? 'サドンデス' : `ラウンド ${game.round}/${ROUNDS}`}
            {final && <b className="sr-final">×{FINAL_MULT}</b>}
          </span>
          <span className="sr-pass-score" style={{ background: SIDE_COLOR[1] }}>
            {SIDE_NAME[1]} {game.score[1]}
          </span>
        </header>
        <div className="sr-pass-body">
          {game.phase === 'pick' && picker !== undefined && curtain && (
            <Handoff
              name={SIDE_NAME[picker]}
              color={SIDE_COLOR[picker]}
              sub={`${game.server === picker ? 'サーブ（ねらう ところ）' : 'レシーブ（まつ ところ）'}${final ? `・とくてん ${FINAL_MULT}ばい！` : ''}`}
              note={`${SIDE_NAME[picker]}の ひとに わたしてね。わたす ときの ゆさぶり：💬 ${TAUNTS[taunt]}`}
              go={`${SIDE_NAME[picker]}だけで みる（タッチ）`}
              onGo={() => {
                unlockAudio()
                sfx.tick()
                setCurtain(false)
              }}
              testId="sr-pass-go"
            />
          )}
          {game.phase === 'pick' && picker !== undefined && !curtain && (
            <PickPanel
              game={game}
              side={picker}
              last={false}
              onChoose={(spot) =>
                act(() => {
                  if (choose(game, picker, spot)) sfx.tick()
                })
              }
              onDouble={() =>
                act(() => {
                  if (toggleDouble(game, picker)) sfx.pop(0.3)
                })
              }
              onDone={() =>
                act(() => {
                  const ev: SrEvent[] = []
                  if (finishStep(game, picker, ev)) handle(ev)
                })
              }
            />
          )}
          {game.phase === 'reveal' && game.last && <RevealPanel r={game.last} t={revealT.current} side={game.last.gainer} />}
        </div>
        {!curtain && <Notice data={notice} single />}
        {over !== null && (
          <Result
            single
            title={() => `${SIDE_NAME[over]}の かち！ よみの てんさい`}
            sub={() => `${SIDE_NAME[0]} ${game.score[0]} たい ${game.score[1]} ${SIDE_NAME[1]}`}
            face={() => 'ok'}
            onAgain={onRestart}
            extra={<Summary results={game.results} />}
          />
        )}
      </div>
    )
  }

  return (
    <div className="sr" data-phase={game.phase}>
      {([1, 0] as Side[]).map((side) => (
        <Half key={side} side={side} className="sr-half-wrap">
          <div className="sr-half" data-side={side}>
            <header className="sr-head" hidden={over !== null}>
              <span className={`side-chip side-chip-${side}`}>{SIDE_NAME[side]}</span>
              <span className="sr-round">
                {game.round > ROUNDS ? 'サドンデス' : `ラウンド ${game.round}/${ROUNDS}`}
                {final && <b className="sr-final">×{FINAL_MULT}</b>}
              </span>
              <span className="sr-serve">{game.server === side ? 'サーブ' : 'レシーブ'}</span>
            </header>
            {game.phase === 'pick' && step?.side === side && (
              <PickPanel
                game={game}
                side={side}
                last={step.kind === 'last'}
                onChoose={(spot) =>
                  act(() => {
                    if (choose(game, side, spot)) sfx.tick()
                  })
                }
                onDouble={() =>
                  act(() => {
                    if (toggleDouble(game, side)) sfx.pop(0.3)
                  })
                }
                onDone={() =>
                  act(() => {
                    const ev: SrEvent[] = []
                    if (finishStep(game, side, ev)) handle(ev)
                  })
                }
              />
            )}
            {game.phase === 'pick' && step && step.side !== side && <WaitPanel game={game} picker={step.side} last={step.kind === 'last'} taunt={TAUNTS[taunt]} />}
            {game.phase === 'reveal' && game.last && <RevealPanel r={game.last} t={revealT.current} side={side} />}
          </div>
        </Half>
      ))}
      <Scores score={[game.score[0], game.score[1]]} />
      <Notice data={notice} />
      {over !== null && (
        <Result
          title={(side) => (side === over ? 'かち！ よみの てんさい' : 'おしい！')}
          sub={(side) => `${game.score[side]} たい ${game.score[side === 0 ? 1 : 0]}`}
          face={(side) => (side === over ? 'ok' : 'oops')}
          onAgain={onRestart}
          extra={<Summary results={game.results} />}
        />
      )}
    </div>
  )
}

function Timer({ left, total }: { left: number; total: number }) {
  return (
    <div className="sr-timer" aria-label={`のこり ${Math.ceil(left)}びょう`}>
      <i style={{ width: `${Math.max(0, Math.min(1, left / total)) * 100}%` }} data-low={left <= 5 || undefined} />
      <span>{Math.max(0, Math.ceil(left))}</span>
    </div>
  )
}

function PickPanel({
  game,
  side,
  last,
  onChoose,
  onDouble,
  onDone,
}: {
  game: SrState
  side: Side
  last: boolean
  onChoose: (spot: Spot) => void
  onDouble: () => void
  onDone: () => void
}) {
  const serving = game.server === side
  const mine = game.picks[side]
  const total = last ? 8 : game.pickTime
  return (
    <div className="sr-pick" data-testid={`sr-pick-${side}`}>
      <p className="sr-title">{last ? 'さいごの チャンス！ かえる？' : serving ? 'どこを ねらう？（こっそり）' : 'どこで まつ？（こっそり）'}</p>
      <div className="sr-buttons" role="radiogroup" aria-label={serving ? 'ねらう ところ' : 'まつ ところ'}>
        {SPOTS.map((spot) => (
          <button key={spot} className="sr-btn" role="radio" aria-checked={mine === spot} data-testid={`sr-${side}-${spot}`} onPointerDown={() => onChoose(spot)}>
            <SpotIcon spot={spot} />
            <span>{SPOT_LABEL[spot]}</span>
            <small>{SPOT_POINTS[spot] * (isFinal(game) ? FINAL_MULT : 1)}てん</small>
          </button>
        ))}
      </div>
      <div className="sr-row">
        {!game.doubleUsed[side] && (
          <button className="sr-double" aria-pressed={game.doubleNow[side]} onPointerDown={onDouble} data-testid={`sr-double-${side}`}>
            2ばい カード{game.doubleNow[side] ? ' つかう！' : ''}
          </button>
        )}
        <button className="btn btn-go sr-done" disabled={!mine} onPointerDown={onDone} data-testid={`sr-done-${side}`}>
          {last ? (mine ? 'これで けってい！' : 'えらんでね') : mine ? 'きめた！' : 'えらんでね'}
        </button>
      </div>
      <Timer left={game.left} total={total} />
    </div>
  )
}

function WaitPanel({ game, picker, last, taunt }: { game: SrState; picker: Side; last: boolean; taunt: string }) {
  return (
    <div className="sr-wait">
      <PikuruCut art="oops" height={84} />
      <div>
        <p className="sr-title">
          {SIDE_NAME[picker]}が {last ? 'さいごの まよい中…' : 'えらんでいるよ'}
        </p>
        <p className="sr-close">めを とじてね！ はなしかけるのは OK</p>
        <p className="sr-taunt">💬 {taunt}</p>
      </div>
      <Timer left={game.left} total={last ? 8 : game.pickTime} />
    </div>
  )
}

/** 発表：サービスコートの図に、サーブの球とレシーブ側のパドルを動かす */
function RevealPanel({ r, t, side }: { r: ServeResult; t: number; side: Side }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const W = 300
  const H = 150
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    if (c.width !== W * dpr) {
      c.width = W * dpr
      c.height = H * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawReveal(ctx, W, H, r, t)
  })
  const mine = r.gainer === side
  return (
    <div className="sr-reveal" data-testid={`sr-reveal-${side}`}>
      <canvas ref={ref} style={{ width: W, height: H }} />
      <div className="sr-picks">
        <span style={{ color: SIDE_COLOR[r.server] }}>
          サーブ：{SPOT_LABEL[r.serve]}
          {r.auto[r.server] ? '（じかんぎれ）' : ''}
        </span>
        <span style={{ color: SIDE_COLOR[r.receiver] }}>
          レシーブ：{t >= 0.4 ? SPOT_LABEL[r.wait] : '？'}
          {t >= 0.4 && r.auto[r.receiver] ? '（じかんぎれ）' : ''}
        </span>
      </div>
      {t >= T_TEXT && (
        <p className="sr-big" data-read={r.read || undefined}>
          {r.read ? 'よんだ！ リターン！' : 'サービスエース！'}
        </p>
      )}
      {t >= T_POINTS && (
        <p className="sr-points" data-mine={mine || undefined}>
          {SIDE_NAME[r.gainer]} +{r.points}
          {r.final && <b>ファイナル×{FINAL_MULT}</b>}
          {r.doubles[r.gainer] && <b>2ばい カード！</b>}
          {r.doubles[r.gainer === 0 ? 1 : 0] && <em>（{SIDE_NAME[r.gainer === 0 ? 1 : 0]}の 2ばいカードは むだに…）</em>}
        </p>
      )}
    </div>
  )
}

const SPOT_X: Record<Spot, number> = { wide: 0.17, body: 0.5, center: 0.83 }

function drawReveal(ctx: CanvasRenderingContext2D, W: number, H: number, r: ServeResult, t: number) {
  ctx.clearRect(0, 0, W, H)
  // レシーブ側のサービスコート（上）と、サーブを打つ所（下）
  const cx0 = 20
  const cw = W - 40
  const top = 8
  const box = H * 0.62
  ctx.fillStyle = '#2f5d9a'
  ctx.fillRect(cx0, top, cw, box)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.strokeRect(cx0, top, cw, box)
  ctx.fillStyle = '#3d8f7a'
  ctx.fillRect(cx0, top + box, cw, H - top - box - 4)
  ctx.fillStyle = '#12302b'
  ctx.fillRect(cx0 - 6, top + box - 1, cw + 12, 3)
  // 的（点つき）
  const sy = top + box * 0.42
  ctx.font = `900 13px 'Zen Maru Gothic', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const sp of SPOTS) {
    const x = cx0 + cw * SPOT_X[sp]
    ctx.beginPath()
    ctx.arc(x, sy, 16, 0, Math.PI * 2)
    ctx.fillStyle = sp === r.serve && t >= T_ARRIVE ? 'rgba(212,240,60,0.55)' : 'rgba(255,255,255,0.15)'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${SPOT_LABEL[sp]} ${SPOT_POINTS[sp]}`, x, top + 12)
  }
  // レシーブ側のパドル：まんなかから、まつ所へ動く
  const wx = cx0 + cw * SPOT_X[r.wait]
  const startX = cx0 + cw * 0.5
  const u = Math.max(0, Math.min(1, (t - 0.4) / 0.5))
  const px = startX + (wx - startX) * (1 - (1 - u) * (1 - u))
  drawPaddleArt(ctx, { x: px, y: sy + 6, faceLen: 26, angle: Math.PI / 2, color: SIDE_COLOR[r.receiver] })
  // サーブの球
  const fromX = cx0 + cw * 0.5
  const fromY = H - 10
  const tx = cx0 + cw * SPOT_X[r.serve]
  let bx = fromX
  let by = fromY
  let br = 6
  if (t >= T_SERVE && t < T_ARRIVE) {
    const k = (t - T_SERVE) / (T_ARRIVE - T_SERVE)
    bx = fromX + (tx - fromX) * k
    by = fromY + (sy - fromY) * k - Math.sin(Math.PI * k) * 28
    br = 6 + Math.sin(Math.PI * k) * 3
  } else if (t >= T_ARRIVE) {
    const k = Math.min(1, (t - T_ARRIVE) / 0.6)
    if (r.read) {
      // 打ちかえす
      bx = tx + (fromX - tx) * k
      by = sy + (fromY - sy) * k - Math.sin(Math.PI * k) * 30
    } else {
      // 抜けていく
      bx = tx + (tx - fromX) * 0.15 * k
      by = sy - (sy - 0) * k
    }
  }
  if (t >= T_SERVE * 0.6) {
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fillStyle = '#d4f03c'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#2e5a1c'
    ctx.stroke()
  }
  // 当たった瞬間の光
  if (t >= T_ARRIVE && t < T_ARRIVE + 0.35) {
    ctx.beginPath()
    ctx.arc(tx, sy, 16 + (t - T_ARRIVE) * 80, 0, Math.PI * 2)
    ctx.strokeStyle = r.read ? '#d4f03c' : '#ff8a3d'
    ctx.lineWidth = 4
    ctx.stroke()
  }
}

/** 試合のまとめ（ラウンドごとに1行：だれが何点とったか） */
function Summary({ results }: { results: ServeResult[] }) {
  const rounds = [...new Set(results.map((r) => r.round))]
  return (
    <ul className="sr-summary">
      {rounds.map((rd) => (
        <li key={rd}>
          <b>{rd > ROUNDS ? 'サドンデス' : `ラウンド${rd}`}</b>
          {results
            .filter((r) => r.round === rd)
            .map((r, i) => (
              <span key={i} style={{ color: SIDE_COLOR[r.gainer] }}>
                {r.read ? 'よんだ' : 'エース'} +{r.points}
              </span>
            ))}
        </li>
      ))}
    </ul>
  )
}

