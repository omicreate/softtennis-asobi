/**
 * ピクルくずし（ブロック崩し）の進行。React に依存しない純粋な計算。
 * 座標は「場」の単位：幅 100。ひとりは高さ 160（下にパドル）、ふたりは高さ 180（上下にパドル、まんなかにブロック）。
 * ひとり：ブロックを全部くずすと次のステージ（3ステージ）。球を落とすとライフが1へる。
 * ふたり：それぞれ自分の球を持つ。最後に打った人の色になり、くずしたブロックはその人の点。時間切れか全部くずしたら終わり。
 */
import { other } from '../../core/players'
import type { Level, Side } from '../../core/players'
import { FACE_RATIO } from '../../ui/paddleArt'

export const FIELD_W = 100

export interface BreakoutLevel {
  /** パドルの面の長さ（場の単位。幅は100）。パドルは横に寝かせて置き、この長さで球を受ける */
  paddle: number
  /** 球の速さ（単位/秒） */
  speed: number
  /** ひとりで遊ぶときのライフ */
  lives: number
}

export const BREAKOUT_LEVEL: Record<Level, BreakoutLevel> = {
  chibi: { paddle: 30, speed: 62, lives: 5 },
  kids: { paddle: 25, speed: 80, lives: 4 },
  otona: { paddle: 21, speed: 100, lives: 3 },
  senshu: { paddle: 17, speed: 120, lives: 3 },
}

export interface Brick {
  x: number
  y: number
  w: number
  h: number
  /** あと何回当てるとくずれるか */
  hp: number
  /** ピクルス（緑）は2回、ほかは1回 */
  kind: 'ball' | 'pickle'
}

export interface BBall {
  x: number
  y: number
  vx: number
  vy: number
  /** 最後に打った人（ふたりのとき点が入る人） */
  owner: Side
  /** パドルの上にのっている（打ち出す前） */
  stuck: boolean
  /** 打ち出すまでの残り秒（自動で打ち出す） */
  wait: number
}

export interface BPaddle {
  x: number
  y: number
  w: number
  /** 横に動いている速さ（単位/秒）。動かしながら打つと球の向きが少し変わる */
  vx: number
  /** 前のフレームの位置（速さを測るため） */
  lastX: number
}

export type BPhase = 'play' | 'clear' | 'over'

export interface BreakoutState {
  two: boolean
  H: number
  levels: [Level, Level]
  bricks: Brick[]
  balls: BBall[]
  paddles: [BPaddle, BPaddle]
  score: [number, number]
  lives: number
  stage: number
  phase: BPhase
  /** ふたりの残り時間（秒） */
  timeLeft: number
  /** 時間切れで終わるか（ふたり、または じゅんばんモードのひとり） */
  timed: boolean
  /** ステージを進むごとに少し速く */
  speedUp: number
  /** ステージクリアの間の待ち */
  pause: number
}

export type BEvent =
  | { type: 'paddle'; side: Side }
  | { type: 'wall' }
  | { type: 'brick'; owner: Side; broke: boolean }
  | { type: 'miss'; side: Side; livesLeft: number }
  | { type: 'clear'; stage: number }
  | { type: 'over'; winner: Side | null }

export const BALL_R = 2.2
/** パドルの面の高さ（寝かせたときの縦）。本物の比率（面の幅÷長さ）のまま */
export const faceH = (p: { w: number }) => p.w * FACE_RATIO
/** 場のはしからパドルまでのすきま */
const EDGE = 5
export const STAGES = 3
/** ふたりの制限時間（秒） */
export const VERSUS_TIME = 90

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** ステージのブロックの並び。'o'＝ボール、'p'＝ピクルス（2回）、'.'＝なし */
const LAYOUTS = [
  ['oooooooo', 'oooooooo', 'oppooppo', 'oooooooo'],
  ['.oooooo.', 'ooppppoo', 'oooooooo', '.oo..oo.', 'oooooooo'],
  ['poooooop', 'opoooopo', 'oopoopoo', 'ooopppoo', 'oopoopoo', 'opoooopo'],
]
/** ふたり：まんなかに上下2段ずつ（まんなかの帯はボタンがあるので空ける） */
const VERSUS_TOP = ['oooooooo', 'opoopoop']
const VERSUS_BOTTOM = ['poopoopo', 'oooooooo']
const VERSUS_GAP = 8

export function makeBricks(rows: string[], top: number): Brick[] {
  const cols = 8
  const gap = 1.2
  const w = (FIELD_W - 4 - gap * (cols - 1)) / cols
  const h = 5.2
  const out: Brick[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      const ch = row[c]
      if (!ch || ch === '.') continue
      out.push({ x: 2 + c * (w + gap), y: top + r * (h + gap), w, h, hp: ch === 'p' ? 2 : 1, kind: ch === 'p' ? 'pickle' : 'ball' })
    }
  })
  return out
}

/** timeLimit：ひとりでも時間切れで終わる（じゅんばんモード。同じ時間で点を比べる） */
export function createBreakout(levels: [Level, Level], two: boolean, timeLimit?: number): BreakoutState {
  const H = two ? 180 : 160
  const w0 = BREAKOUT_LEVEL[levels[0]].paddle
  const w1 = BREAKOUT_LEVEL[levels[1]].paddle
  const p0: BPaddle = { x: FIELD_W / 2, y: H - EDGE - faceH({ w: w0 }) / 2, w: w0, vx: 0, lastX: FIELD_W / 2 }
  const p1: BPaddle = { x: FIELD_W / 2, y: EDGE + faceH({ w: w1 }) / 2, w: w1, vx: 0, lastX: FIELD_W / 2 }
  const s: BreakoutState = {
    two,
    H,
    levels,
    bricks: two
      ? [...makeBricks(VERSUS_TOP, H / 2 - VERSUS_GAP - 2 * 6.4 + 1.2), ...makeBricks(VERSUS_BOTTOM, H / 2 + VERSUS_GAP)]
      : makeBricks(LAYOUTS[0], 22),
    balls: [],
    paddles: [p0, p1],
    score: [0, 0],
    lives: BREAKOUT_LEVEL[levels[0]].lives,
    stage: 0,
    phase: 'play',
    timeLeft: timeLimit ?? VERSUS_TIME,
    timed: two || timeLimit !== undefined,
    speedUp: 1,
    pause: 0,
  }
  s.balls.push(newBall(s, 0))
  if (two) s.balls.push(newBall(s, 1))
  return s
}

function newBall(s: BreakoutState, side: Side): BBall {
  const p = s.paddles[side]
  return { x: p.x, y: side === 0 ? p.y - faceH(p) / 2 - BALL_R : p.y + faceH(p) / 2 + BALL_R, vx: 0, vy: 0, owner: side, stuck: true, wait: 1.6 }
}

/** 球が向かっている側の人のレベルで、速さを決める（小さい子のところへは遅く） */
function speedToward(s: BreakoutState, b: BBall): number {
  const toward: Side = b.vy > 0 ? 0 : s.two ? 1 : 0
  return BREAKOUT_LEVEL[s.levels[toward]].speed * s.speedUp
}

function setSpeed(s: BreakoutState, b: BBall): void {
  const v = Math.hypot(b.vx, b.vy) || 1
  const want = speedToward(s, b)
  b.vx = (b.vx / v) * want
  b.vy = (b.vy / v) * want
  // 真横に近い角度にならないように（いつまでも行き来しないように）
  const minVy = want * 0.35
  if (Math.abs(b.vy) < minVy) {
    b.vy = Math.sign(b.vy || 1) * minVy
    b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(0, want * want - minVy * minVy))
  }
}

/** 打ち出す（タップ、または待ち時間が過ぎたとき）。少し斜めに飛ばす */
export function launch(s: BreakoutState, side: Side): void {
  for (const b of s.balls) {
    if (!b.stuck || b.owner !== side) continue
    b.stuck = false
    const dir = side === 0 ? -1 : 1
    b.vx = (b.x < FIELD_W / 2 ? 1 : -1) * 0.45
    b.vy = dir
    setSpeed(s, b)
  }
}

/** パドルを指の位置へ（場の外には出ない） */
export function movePaddle(s: BreakoutState, side: Side, x: number): void {
  const p = s.paddles[side]
  p.x = clamp(x, p.w / 2, FIELD_W - p.w / 2)
}

export function stepBreakout(s: BreakoutState, dt: number): BEvent[] {
  const ev: BEvent[] = []
  if (s.phase === 'over') return ev
  if (s.phase === 'clear') {
    s.pause -= dt
    if (s.pause <= 0) nextStage(s, ev)
    return ev
  }
  if (s.timed) {
    s.timeLeft = Math.max(0, s.timeLeft - dt)
    if (s.timeLeft === 0) return finish(s, ev)
  }
  for (const p of s.paddles) {
    // 速さは少しなめらかにする（指のふるえで向きが暴れないように）
    p.vx = p.vx * 0.6 + ((p.x - p.lastX) / Math.max(dt, 1e-3)) * 0.4
    p.lastX = p.x
  }
  const n = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / n
  for (let i = 0; i < n; i++) stepBalls(s, h, ev)
  if (s.bricks.length === 0 && s.phase === 'play') {
    if (s.two) return finish(s, ev)
    s.phase = 'clear'
    s.pause = 1.6
    ev.push({ type: 'clear', stage: s.stage })
  }
  return ev
}

function stepBalls(s: BreakoutState, h: number, ev: BEvent[]): void {
  for (const b of [...s.balls]) {
    const pOwn = s.paddles[b.owner]
    if (b.stuck) {
      b.x = pOwn.x
      b.wait -= h
      if (b.wait <= 0) launch(s, b.owner)
      continue
    }
    b.x += b.vx * h
    b.y += b.vy * h

    // 左右の壁
    if (b.x < BALL_R) {
      b.x = BALL_R
      b.vx = Math.abs(b.vx)
      setSpeed(s, b)
      ev.push({ type: 'wall' })
    } else if (b.x > FIELD_W - BALL_R) {
      b.x = FIELD_W - BALL_R
      b.vx = -Math.abs(b.vx)
      setSpeed(s, b)
      ev.push({ type: 'wall' })
    }
    // ひとりのときは上も壁
    if (!s.two && b.y < BALL_R) {
      b.y = BALL_R
      b.vy = Math.abs(b.vy)
      setSpeed(s, b)
      ev.push({ type: 'wall' })
    }

    // パドル：パドルのどこに当たったかで角度が変わる（端ほど斜め）
    for (const side of (s.two ? [0, 1] : [0]) as Side[]) {
      const p = s.paddles[side]
      const coming = side === 0 ? b.vy > 0 : b.vy < 0
      if (!coming) continue
      const fh = faceH(p)
      const face = side === 0 ? p.y - fh / 2 : p.y + fh / 2
      const near = side === 0 ? b.y + BALL_R >= face && b.y < p.y + fh / 2 : b.y - BALL_R <= face && b.y > p.y - fh / 2
      if (!near || Math.abs(b.x - p.x) > p.w / 2 + BALL_R) continue
      const off = clamp((b.x - p.x) / (p.w / 2), -1, 1)
      // 当たった場所で角度が決まり、パドルを動かしながら打つと、その向きに少し流れる
      const angle = clamp(off * (Math.PI / 3) + clamp(p.vx / 300, -0.35, 0.35), -1.2, 1.2)
      b.vx = Math.sin(angle)
      b.vy = (side === 0 ? -1 : 1) * Math.cos(angle)
      b.y = side === 0 ? face - BALL_R : face + BALL_R
      b.owner = side
      setSpeed(s, b)
      ev.push({ type: 'paddle', side })
    }

    // ブロック（1回の計算で1つだけ当てる）
    for (const k of s.bricks) {
      const cx = clamp(b.x, k.x, k.x + k.w)
      const cy = clamp(b.y, k.y, k.y + k.h)
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BALL_R * BALL_R) continue
      // めりこみの浅い方の向きに跳ね返す
      const overlapX = Math.min(b.x + BALL_R - k.x, k.x + k.w - (b.x - BALL_R))
      const overlapY = Math.min(b.y + BALL_R - k.y, k.y + k.h - (b.y - BALL_R))
      if (overlapX < overlapY) b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx)
      else b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy)
      setSpeed(s, b)
      k.hp -= 1
      const broke = k.hp <= 0
      if (broke) {
        s.bricks = s.bricks.filter((x) => x !== k)
        s.score[b.owner] += k.kind === 'pickle' ? 2 : 1
      }
      ev.push({ type: 'brick', owner: b.owner, broke })
      break
    }

    // 落とした
    const lostBottom = b.y > s.H + BALL_R
    const lostTop = s.two && b.y < -BALL_R
    if (lostBottom || lostTop) {
      const side: Side = lostBottom ? 0 : 1
      s.balls = s.balls.filter((x) => x !== b)
      if (s.two) {
        // ふたり：落とした人の手元に、その人の球が戻ってくる（落とした時間がそのまま損）
        if (!s.balls.some((x) => x.owner === side && x.stuck)) s.balls.push({ ...newBall(s, side), wait: 1.2 })
        // もう1つの球が持ち主をなくしたら、その人にも戻す
        if (!s.balls.some((x) => x.owner === other(side)) && s.balls.length < 2) s.balls.push(newBall(s, other(side)))
        ev.push({ type: 'miss', side, livesLeft: 0 })
      } else {
        s.lives -= 1
        ev.push({ type: 'miss', side: 0, livesLeft: s.lives })
        if (s.lives <= 0) {
          finish(s, ev)
          return
        }
        s.balls.push(newBall(s, 0))
      }
    }
  }
}

function nextStage(s: BreakoutState, ev: BEvent[]): void {
  s.stage += 1
  if (s.stage >= STAGES) {
    finish(s, ev)
    return
  }
  s.bricks = makeBricks(LAYOUTS[s.stage], 22)
  s.speedUp = 1 + s.stage * 0.1
  s.balls = [newBall(s, 0)]
  s.phase = 'play'
}

function finish(s: BreakoutState, ev: BEvent[]): BEvent[] {
  s.phase = 'over'
  const winner: Side | null = s.two ? (s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1) : s.lives > 0 ? 0 : null
  ev.push({ type: 'over', winner })
  return ev
}
