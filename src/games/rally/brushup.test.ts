import { describe, expect, it } from 'vitest'
import { COURT } from './court'
import { RallyEngine } from './engine'
import type { EngineEvent } from './engine'
import { suggestLevel } from './RallyGame'
import { makeZone, shotHint } from './targets'
import { RallyFx } from './fx'

const W = COURT.W
const N = COURT.NET_Y

describe('ねらって ストローク：外れたときの一言', () => {
  const right = makeZone('kids', 0) // みぎがわ（x が W/2〜W）
  const deep = makeZone('senshu', 0, () => 0) // 正クロスの深い所（x 0〜W/2、y 0〜3）

  it('的より左に落ちたら「みぎへ」、右に落ちたら「ひだりへ」', () => {
    expect(shotHint(right, { x: 1, y: 5 })).toMatch(/^もうすこし みぎへ/)
    expect(shotHint(deep, { x: W - 1, y: 2 })).toMatch(/^もうすこし ひだりへ/)
  })

  it('コートの横の外（アウト）でも向きを教える', () => {
    expect(shotHint(right, { x: W + 0.5, y: 5 })).toMatch(/ひだりへ/)
    expect(shotHint(right, { x: -0.5, y: 5 })).toMatch(/みぎへ/)
  })

  it('ベースラインをこえたら「そっと」、的より手前なら「ふかく」', () => {
    expect(shotHint(deep, { x: 2, y: -0.5 })).toMatch(/そっと/)
    expect(shotHint(deep, { x: 2, y: 5 })).toMatch(/ふかく/)
    // 自分の陣地に落ちた（ネットをこえない）ときも「ふかく」
    expect(shotHint(right, { x: W - 1, y: N + 1 })).toMatch(/ふかく/)
  })

  it('的の中（ラインの上もふくむ）なら何も言わない', () => {
    expect(shotHint(right, { x: W / 2, y: N })).toBe('')
  })

  it('打球の向きの説明が、打ち方の決まり（右はしで当てる・右へ振る＝右へ飛ぶ）と合っている', () => {
    // physics.ts の planShot：tx = 打点の x + 当てた位置 × 3 + 横に振った速さ × 0.3
    expect(shotHint(right, { x: 0.5, y: 5 })).toContain('みぎはし')
    expect(shotHint(right, { x: W + 1, y: 5 })).toContain('ひだりはし')
  })
})

describe('ねらって ストローク：外れた球の目印', () => {
  it('返せた球が外れたら、落ちた場所を覚え、次の球を送ると消す', () => {
    const e = new RallyEngine({ kind: 'target', mode: 'easy', levels: ['kids', 'kids'], target: 0, rand: () => 0.5 })
    const events: EngineEvent[] = []
    const dt = 1 / 60
    let sawMiss = false
    let clearedAfterMiss = false
    // 指を球の少し右に置いて、いつも左へ（的の外へ）返す
    for (let t = 0; t < 40 && e.phase !== 'over'; t += dt) {
      e.setFinger(0, true, e.ball.x + 0.9, COURT.L - 1.2)
      for (const ev of e.step(dt)) {
        events.push(ev)
        if (ev.type === 'shot' && !ev.ok && ev.at) {
          sawMiss = true
          expect(e.missAt).toEqual(ev.at)
        }
        if (ev.type === 'feed' && sawMiss) clearedAfterMiss = e.missAt === null
      }
    }
    expect(sawMiss).toBe(true)
    expect(clearedAfterMiss).toBe(true)
  })
})

describe('ホークアイ先生と ラリー：つぎに すすめる レベル', () => {
  it('1てん以下で負けたら ひとつ やさしく', () => {
    expect(suggestLevel('otona', false, 1, 5)).toBe('kids')
    expect(suggestLevel('kids', false, 0, 5)).toBe('chibi')
  })
  it('相手を1てん以下にして勝ったら ひとつ つよく', () => {
    expect(suggestLevel('kids', true, 5, 1)).toBe('otona')
    expect(suggestLevel('otona', true, 5, 0)).toBe('senshu')
  })
  it('接戦・いちばん下や上では すすめない', () => {
    expect(suggestLevel('otona', false, 3, 5)).toBeNull()
    expect(suggestLevel('otona', true, 5, 3)).toBeNull()
    expect(suggestLevel('chibi', false, 0, 5)).toBeNull()
    expect(suggestLevel('senshu', true, 5, 0)).toBeNull()
  })
})

describe('手応えの演出（RallyFx）', () => {
  const rand = () => 0.5
  it('強く打つと粒が多く、ゆれる。ふつうの打球はゆれない', () => {
    const weak = new RallyFx(rand, false)
    weak.hit({ x: 4, y: 20 }, 0.4, true)
    const strong = new RallyFx(rand, false)
    strong.hit({ x: 4, y: 20 }, 1.2, true)
    expect(strong.counts().sparks).toBeGreaterThan(weak.counts().sparks)
    expect(weak.offset()).toEqual({ x: 0, y: 0 })
    // rand=0.5 だと ずれが 0 になるので、ゆれている時間があることを別の乱数で確かめる
    const s2 = new RallyFx(() => 0.9, false)
    s2.hit({ x: 4, y: 20 }, 1.2, true)
    expect(Math.abs(s2.offset().x)).toBeGreaterThan(0)
  })
  it('ホークアイ先生の強打では画面をゆらさない', () => {
    const f = new RallyFx(() => 0.9, false)
    f.hit({ x: 4, y: 3 }, 1.2, false)
    expect(f.offset()).toEqual({ x: 0, y: 0 })
  })
  it('動きを減らす設定では、粒もゆれも出さない（輪と文字は出す）', () => {
    const f = new RallyFx(() => 0.9, true)
    f.hit({ x: 4, y: 20 }, 1.2, true)
    f.celebrate({ x: 4, y: 5 }, '2れんぞく！')
    expect(f.counts().sparks).toBe(0)
    expect(f.offset()).toEqual({ x: 0, y: 0 })
    expect(f.counts().rings).toBe(2)
    expect(f.counts().pops).toBe(1)
  })
  it('時間がたつと消える。球の残像は新しいポイントで消す', () => {
    const f = new RallyFx(rand, false)
    f.celebrate({ x: 4, y: 5 }, 'ナイス！')
    for (let i = 0; i < 5; i++) f.update(0.05, { x: 4, y: 10 + i })
    expect(f.counts().trail).toBeGreaterThan(1)
    f.reset()
    expect(f.counts().trail).toBe(0)
    for (let i = 0; i < 40; i++) f.update(0.05, null)
    expect(f.counts()).toEqual({ sparks: 0, rings: 0, pops: 0, trail: 0 })
  })
})
