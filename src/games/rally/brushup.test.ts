import { describe, expect, it } from 'vitest'
import { COURT } from './court'
import { RallyEngine } from './engine'
import type { EngineEvent } from './engine'
import { suggestLevel } from './RallyGame'
import { makeZone, shotHint } from './targets'

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
