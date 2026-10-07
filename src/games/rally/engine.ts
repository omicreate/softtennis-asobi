/**
 * ラリーの進行（サービス → 打ち合い → 失ポイント → 次のサービス）。
 * 「ラリーたいけつ」「ホークアイ先生とラリー」「ねらって ストローク」で共通に使う。
 * 描画と音は画面側（RallyGame.tsx）が受け持つ。
 * ほんかくルールの数え方はソフトテニスの競技規則：1ゲームは4ポイント先取・3-3からデュース（第20条）、
 * ファイナルゲームは7ポイント先取・6-6からデュース（第20条2）、サービスは1ゲームずつ交互（シングルス 第4条）、
 * ファイナルゲームは2ポイントごとに交代（第34条2）。サービスは2本まで（第27条2・第29条）。
 */
import { LEVEL_INFO, other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { COURT, serveHalf, toNet } from './court'
import { assistShift, contact, HIT_Z, launch, planShot, powerFromSwing, stepBall } from './physics'
import type { Ball, Paddle, Vec } from './physics'
import { judgeBounce, judgeHit } from './rules'
import type { Fault, RallyState, RuleMode } from './rules'
import { feedLanding, inZone, makeZone, SHOTS } from './targets'
import type { Zone } from './targets'

/** versus＝たいけつ（2人／ホークアイ先生）、target＝ねらって ストローク（ひとりで。上はボールマシン） */
export type Kind = 'versus' | 'target'
export type Phase = 'countdown' | 'serve' | 'play' | 'point' | 'over'
/** ほんかくルールのゲーム数（1・3・5ゲームマッチ。第19条2のショートマッチ） */
export type Games = 1 | 3 | 5

export interface EngineOptions {
  kind: Kind
  mode: RuleMode
  levels: [Level, Level]
  /** 何点先取か（かんたんルールのたいけつ） */
  target: number
  /** ほんかくルールのゲーム数（省略時は1ゲーム） */
  games?: Games
  /** 乱数（テストで結果を決めるため） */
  rand?: () => number
  /** ホークアイ先生（コンピューター）が受け持つ側。小さい子向けの吸い寄せは効かせない */
  cpu?: Side
}

export type EngineEvent =
  | { type: 'countdown'; n: number }
  | { type: 'serve'; server: Side }
  | { type: 'hit'; side: Side; power: number }
  | { type: 'bounce' }
  /** ラリーが終わって点が入った。game＝そのポイントでゲームを取った */
  | { type: 'point'; fault: Fault; winner: Side; game: boolean }
  /** ファーストサービスのフォールト（点は動かず、セカンドサービス） */
  | { type: 'fault'; server: Side }
  /** ねらってショット：ボールマシンが球を送った／打った球の結果 */
  | { type: 'feed'; index: number; zone: Zone }
  | { type: 'shot'; ok: boolean; reason: ShotMiss | null; index: number; hits: number }
  | { type: 'over'; winner: Side | null }

/** ねらってショットで外れた理由 */
export type ShotMiss = 'zone' | 'out' | 'double-bounce'

/** 振る動きを見せる時間（秒） */
export const SWING_TIME = 0.25
/** 利き手の向き（右利き）。下の人は上を向いているので右＝x が大きい側 */
export const hand = (side: Side): 1 | -1 => (side === 0 ? 1 : -1)
/** ボールマシンの位置（上のベースラインの後ろ） */
export const MACHINE = { x: COURT.W / 2, y: -1.9, z: 1.0 }

/** 指の位置から、ラケットをネット側へ少し出す（指でラケットが隠れないように） */
export const FINGER_LEAD = 1.2
/** 指の速さを測る時間幅（秒） */
const SWING_WINDOW = 0.09
/** サーブのときに「ネットへ向けて振った」とみなす速さ（m/s） */
const SERVE_SWING = 2.4

interface Sample {
  t: number
  x: number
  y: number
}

interface Finger {
  active: boolean
  x: number
  y: number
  samples: Sample[]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class RallyEngine {
  readonly opts: EngineOptions
  phase: Phase = 'countdown'
  timer = 3
  /** いまのゲームのポイント（かんたんは試合の点） */
  score: [number, number] = [0, 0]
  /** 取ったゲームの数（ほんかく） */
  gamesWon: [number, number] = [0, 0]
  /** ファーストサービス（1）か セカンドサービス（2）か */
  serveNo: 1 | 2 = 1
  server: Side = 0
  winner: Side | null = null
  ball: Ball = { x: COURT.W / 2, y: COURT.L, z: HIT_Z, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
  /** 球を見せるか（サーブ前は手元に見せる） */
  ballVisible = false
  paddles: [Paddle, Paddle]
  fingers: [Finger, Finger] = [
    { active: false, x: COURT.W / 2, y: COURT.L, samples: [] },
    { active: false, x: COURT.W / 2, y: 0, samples: [] },
  ]
  state: RallyState = { lastHitter: 0, shot: 0, bounces: 0, serverX: COURT.W / 2 }
  /** 最後のミス（画面に理由を出す） */
  lastFault: Fault | null = null
  /** 見た目：パドルの先が、体の中心から横にどれだけ出ているか（m）。球が来ると球の方へ伸ばす */
  head: [number, number] = [0.35, -0.35]
  /** 見た目：振っている残り時間（秒） */
  swingT: [number, number] = [0, 0]
  /** ねらってショット：今の的・何球目か・入った数 */
  zone: Zone | null = null
  shotIndex = 0
  hits = 0
  private readonly rand: () => number
  private serveWait = 0
  private now = 0
  /** カウントダウンで最後に知らせた数 */
  private announced = 4

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.rand = opts.rand ?? Math.random
    this.paddles = [
      { x: COURT.W / 2, y: COURT.L - 0.2, vx: 0, vy: 0, width: LEVEL_INFO[opts.levels[0]].paddleWidth },
      { x: COURT.W / 2, y: 0.2, vx: 0, vy: 0, width: LEVEL_INFO[opts.levels[1]].paddleWidth },
    ]
  }

  /** 指の位置（コートの座標 m）。active=false は指を離したとき */
  setFinger(side: Side, active: boolean, x: number, y: number): void {
    const f = this.fingers[side]
    f.active = active
    if (!active) return
    f.x = x
    f.y = y
    f.samples.push({ t: this.now, x, y })
  }

  /** 指の速さ（m/s） */
  private fingerVelocity(side: Side): Vec {
    const f = this.fingers[side]
    f.samples = f.samples.filter((s) => this.now - s.t <= SWING_WINDOW)
    if (f.samples.length < 2) return { x: 0, y: 0 }
    const a = f.samples[0]
    const b = f.samples[f.samples.length - 1]
    const dt = b.t - a.t
    if (dt < 0.012) return { x: 0, y: 0 }
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }
  }

  private levelOf(side: Side) {
    return LEVEL_INFO[this.opts.levels[side]]
  }

  /** そのゲームで何ポイント目か（サービスの右・左を決める） */
  pointInGame(): number {
    return this.score[0] + this.score[1]
  }

  /** ラケットが動ける範囲（自分の陣地。ほんかくルールのサービスはベースラインの外・決まった側。第25条） */
  private placePaddle(side: Side, x: number, y: number): Vec {
    const n = COURT.NET_Y
    let px = clamp(x, -1.4, COURT.W + 1.4)
    let py = side === 0 ? clamp(y, n + 0.4, COURT.L + 3.0) : clamp(y, -3.0, n - 0.4)
    if (this.phase === 'serve' && side === this.server && this.opts.mode === 'real') {
      py = side === 0 ? Math.max(py, COURT.L + 0.3) : Math.min(py, -0.3)
      const half = serveHalf(side, this.pointInGame())
      const mid = COURT.W / 2
      px = half === 'high' ? clamp(px, mid + 0.15, COURT.W - 0.1) : clamp(px, 0.1, mid - 0.15)
    }
    return { x: px, y: py }
  }

  private startServe(): void {
    this.phase = 'serve'
    this.serveWait = 0
    this.ballVisible = true
    this.lastFault = null
    if (this.opts.kind === 'target') this.zone = makeZone(this.opts.levels[0], this.shotIndex, this.rand)
  }

  /** ねらってショット：ボールマシンから下の人へ球を送る */
  private feed(ev: EngineEvent[]): void {
    const zone = this.zone!
    const at = feedLanding(this.opts.levels[0], zone, this.rand)
    this.ball = { x: MACHINE.x + (this.rand() - 0.5) * 2, y: MACHINE.y, z: MACHINE.z, vx: 0, vy: 0, vz: 0, bounces: 0, timeScale: 1 }
    launch(this.ball, at, 1.5, this.levelOf(0).ballSpeed)
    // 送った球はラリー中の球とみなす（下の人の球は3球目）
    this.state = { lastHitter: 1, shot: 2, bounces: 0, serverX: this.ball.x }
    this.phase = 'play'
    ev.push({ type: 'feed', index: this.shotIndex, zone })
  }

  /** ねらってショット：1球の結果 */
  private shotResult(ok: boolean, reason: ShotMiss | null, ev: EngineEvent[]): void {
    if (ok) this.hits += 1
    this.phase = 'point'
    this.timer = 1.4
    ev.push({ type: 'shot', ok, reason, index: this.shotIndex, hits: this.hits })
  }

  private holdBall(): void {
    const p = this.paddles[this.server]
    const s = toNet(this.server)
    this.ball.x = p.x
    // 手元の球はネットを越えない（自分の陣地の中に持つ）
    const y = p.y + s * 0.4
    this.ball.y = this.server === 0 ? Math.max(y, COURT.NET_Y + 0.15) : Math.min(y, COURT.NET_Y - 0.15)
    this.ball.z = HIT_Z
    this.ball.vx = this.ball.vy = this.ball.vz = 0
    this.ball.bounces = 0
  }

  private doServe(power: number, swingX: number): void {
    const side = this.server
    const lv = this.levelOf(side)
    const shot = planShot(this.ball, side, power, 0, swingX, { keepIn: lv.keepIn, serve: true })
    launch(this.ball, shot.target, shot.T, this.levelOf(other(side)).ballSpeed)
    this.state = { lastHitter: side, shot: 0, bounces: 0, serverX: this.ball.x }
    this.phase = 'play'
    this.swingT[side] = SWING_TIME
  }

  step(dt: number): EngineEvent[] {
    this.now += dt
    const ev: EngineEvent[] = []

    // パドル：指に合わせる（＋小さい子は球の方へ寄せる）
    const prevPaddles: Vec[] = this.paddles.map((p) => ({ x: p.x, y: p.y }))
    const swings: Vec[] = [this.fingerVelocity(0), this.fingerVelocity(1)]
    for (const side of [0, 1] as Side[]) {
      const f = this.fingers[side]
      const p = this.paddles[side]
      const want = this.placePaddle(side, f.x, f.y + toNet(side) * FINGER_LEAD)
      const assist = this.opts.cpu === side ? 0 : this.levelOf(side).assist
      const shift = this.phase === 'play' ? assistShift(this.ball, want, side, assist) : 0
      const placed = this.placePaddle(side, want.x + shift, want.y)
      p.vx = dt > 0 ? (placed.x - p.x) / dt : 0
      p.vy = dt > 0 ? (placed.y - p.y) / dt : 0
      p.x = placed.x
      p.y = placed.y

      // 見た目：球が来るときはパドルの先をその方へ、来ないときは利き手の側に構える
      const half = p.width / 2
      let wantHead = hand(side) * Math.min(0.35, half)
      const coming = this.phase === 'play' && this.state.lastHitter !== side && this.ball.vy * toNet(side) < 0
      if (coming) {
        const t = (p.y - this.ball.y) / this.ball.vy
        if (t > 0 && t < 2) wantHead = clamp(this.ball.x + this.ball.vx * t - p.x, -half, half)
      }
      this.head[side] += (wantHead - this.head[side]) * Math.min(1, dt * 14)
      this.swingT[side] = Math.max(0, this.swingT[side] - dt)
    }

    switch (this.phase) {
      case 'countdown': {
        const n = Math.ceil(this.timer)
        if (n < this.announced && n > 0) {
          this.announced = n
          ev.push({ type: 'countdown', n })
        }
        this.timer -= dt
        if (this.timer <= 0) {
          this.startServe()
          ev.push({ type: 'serve', server: this.server })
        }
        break
      }
      case 'serve': {
        if (this.opts.kind === 'target') {
          // ボールマシンは少し待ってから送る
          this.ball = { ...this.ball, x: MACHINE.x, y: MACHINE.y, z: MACHINE.z, vx: 0, vy: 0, vz: 0 }
          this.serveWait += dt
          if (this.serveWait > 0.9) this.feed(ev)
          break
        }
        this.holdBall()
        this.serveWait += dt
        const sw = swings[this.server]
        const vNet = sw.y * toNet(this.server)
        const lv = this.levelOf(this.server)
        const auto = lv.keepIn ? 3 : Infinity
        if (this.serveWait > 0.35 && vNet > SERVE_SWING) {
          this.doServe(powerFromSwing(vNet), sw.x)
          ev.push({ type: 'hit', side: this.server, power: 0.5 })
        } else if (this.serveWait > auto) {
          this.doServe(0.45, 0)
          ev.push({ type: 'hit', side: this.server, power: 0.4 })
        }
        break
      }
      case 'play':
      case 'point': {
        this.stepPlay(dt, prevPaddles, swings, ev)
        break
      }
      case 'over':
        break
    }
    return ev
  }

  private stepPlay(dt: number, prevPaddles: Vec[], swings: Vec[], ev: EngineEvent[]): void {
    if (this.phase === 'point') {
      this.timer -= dt
      if (this.timer <= 0 && this.opts.kind === 'target') {
        this.shotIndex += 1
        if (this.shotIndex >= SHOTS) {
          this.phase = 'over'
          this.ballVisible = false
          ev.push({ type: 'over', winner: null })
        } else {
          this.startServe()
        }
        return
      }
      if (this.timer <= 0) {
        if (this.winner !== null) {
          this.phase = 'over'
          this.ballVisible = false
          ev.push({ type: 'over', winner: this.winner })
          return
        }
        this.startServe()
        ev.push({ type: 'serve', server: this.server })
        return
      }
    }

    // 速い球でもパドルをすり抜けないよう、細かく区切って進める
    const n = Math.max(1, Math.ceil(dt / (1 / 240)))
    const h = dt / n
    for (let i = 1; i <= n; i++) {
      const prevBall = { x: this.ball.x, y: this.ball.y }
      const bounce = stepBall(this.ball, h)
      if (this.phase !== 'play') continue
      /** この区切りで打った（打つ直前の跳ねは、打った人の球の跳ねとして数えない） */
      let hitNow = false

      // 打つ
      for (const side of [0, 1] as Side[]) {
        if (this.state.lastHitter === side) continue
        // ねらってショットの上はボールマシンなので打ち返さない
        if (this.opts.kind === 'target' && side === 1) continue
        const p = this.paddles[side]
        const pp = prevPaddles[side]
        const k0 = (i - 1) / n
        const k1 = i / n
        const from = { x: pp.x + (p.x - pp.x) * k0, y: pp.y + (p.y - pp.y) * k0 }
        const to: Paddle = { ...p, x: pp.x + (p.x - pp.x) * k1, y: pp.y + (p.y - pp.y) * k1 }
        const lv = this.levelOf(side)
        const tol = 0.45 + (lv.assist > 0 ? 0.35 : 0)
        const off = contact(prevBall, this.ball, from, to, side, tol)
        if (off === null) continue
        const target = this.opts.kind === 'target'
        const fault = target ? null : judgeHit(this.state, side, this.opts.mode)
        if (fault) {
          this.endRally(fault, ev)
          break
        }
        const sw = swings[side]
        const power = powerFromSwing(sw.y * toNet(side))
        const shot = planShot(this.ball, side, power, off, sw.x, { keepIn: lv.keepIn })
        this.ball.z = Math.max(this.ball.z, 0.35)
        launch(this.ball, shot.target, shot.T, this.levelOf(other(side)).ballSpeed)
        this.state = { ...this.state, lastHitter: side, shot: this.state.shot + 1, bounces: 0 }
        this.swingT[side] = SWING_TIME
        this.head[side] = off * (p.width / 2)
        hitNow = true
        ev.push({ type: 'hit', side, power })
        break
      }

      if (bounce && !hitNow && this.phase === 'play' && this.opts.kind === 'target') {
        this.state.bounces = this.ball.bounces
        ev.push({ type: 'bounce' })
        if (this.state.lastHitter === 1) {
          // マシンの球を返せずに2回跳ねた
          if (this.state.bounces >= 2) this.shotResult(false, 'double-bounce', ev)
        } else if (this.state.bounces === 1) {
          // 打った球が最初に跳ねた場所で判定（ラインに触れた球はイン）
          const inCourtTop = bounce.y <= COURT.NET_Y && bounce.x >= -1e-6 && bounce.x <= COURT.W + 1e-6 && bounce.y >= -1e-6
          const ok = inCourtTop && !!this.zone && inZone(this.zone, bounce)
          this.shotResult(ok, ok ? null : inCourtTop ? 'zone' : 'out', ev)
        }
      } else if (bounce && !hitNow && this.phase === 'play') {
        this.state.bounces = this.ball.bounces
        ev.push({ type: 'bounce' })
        const fault = judgeBounce(this.state, bounce, this.opts.mode)
        if (fault) this.endRally(fault, ev)
      }
    }
  }

  private endRally(fault: Fault, ev: EngineEvent[]): void {
    // ファーストサービスのフォールトは点が動かず、セカンドサービスを打つ（第27条2）
    if (fault.reason === 'fault') {
      if (this.serveNo === 1) {
        this.serveNo = 2
        this.lastFault = fault
        this.phase = 'point'
        this.timer = 1.4
        ev.push({ type: 'fault', server: this.server })
        return
      }
      fault = { loser: fault.loser, reason: 'double-fault' }
    }
    this.lastFault = fault
    this.serveNo = 1
    const winner = other(fault.loser)
    this.score[winner] += 1
    this.phase = 'point'
    this.timer = 1.8
    let game = false
    if (this.opts.mode === 'real' && this.opts.kind === 'versus') {
      // ゲームの勝ち：4ポイント先取（ファイナルは7）、デュースからは2ポイント差（第20条）
      const need = this.isFinal() ? 7 : 4
      const s = this.score[winner]
      if (s >= need && s - this.score[fault.loser] >= 2) {
        game = true
        this.gamesWon[winner] += 1
        const toWin = Math.ceil((this.opts.games ?? 1) / 2)
        if (this.gamesWon[winner] >= toWin) this.winner = winner
        else {
          this.score = [0, 0]
          // サービスは1ゲームずつ交互（シングルス 第4条）
          this.gameServer = other(this.gameServer)
        }
      }
      // ファイナルゲームは2ポイントごとにサービスを交代（第34条2）
      this.server = this.isFinal() ? (Math.floor(this.pointInGame() / 2) % 2 === 0 ? this.gameServer : other(this.gameServer)) : this.gameServer
    } else {
      if (this.score[winner] >= this.opts.target) this.winner = winner
      // かんたん：サービスは2ポイントずつ交代
      this.server = Math.floor(this.pointInGame() / 2) % 2 === 0 ? 0 : 1
    }
    ev.push({ type: 'point', fault, winner, game })
  }

  /** そのゲームの最初にサービスをした人 */
  private gameServer: Side = 0

  /** ファイナルゲームか（ゲーム数が並んで、最後の1ゲーム。第20条2） */
  isFinal(): boolean {
    const g = this.opts.games ?? 1
    if (this.opts.mode !== 'real' || g === 1) return false
    const half = (g - 1) / 2
    return this.gamesWon[0] === half && this.gamesWon[1] === half
  }

  /** スコアのコール。サーバーの点を先に言う */
  scoreCall(): string {
    return `${this.score[this.server]}-${this.score[other(this.server)]}`
  }
}
