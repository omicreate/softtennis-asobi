import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type Level = 'chibi' | 'kids' | 'otona' | 'senshu'

/** はじめて開いたときの記録（プレゼントの知らせは出さない） */
const PROGRESS = {
  stars: 3,
  owned: ['design:orange', 'design:blue', 'shape:std'],
  wear: {},
  plays: {},
  days: [],
  mission: { day: '2000-01-01', progress: [0, 0, 0], done: [false, false, false], bonus: false },
  cleared: 0,
  parties: 0,
}

/** 設定（レベル・音なし）と記録を入れてから開く */
async function open(page: Page, hash: string, levels: [Level, Level] = ['kids', 'otona'], progress: object = PROGRESS) {
  await page.addInitScript(
    ([lv, pr]) => {
      // 同じテストの中でページを開き直しても、記録はそのまま
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('softtennis-asobi:settings', JSON.stringify({ sound: false, speak: false, levels: lv, rallyRules: 'easy', rallyTarget: 5, soloLevel: 'kids' }))
      localStorage.setItem('softtennis-asobi:progress', JSON.stringify(pr))
    },
    [levels, progress] as const,
  )
  await page.goto(hash)
}

/** 要素に指の操作を送る */
async function touch(page: Page, testId: string, type: 'pointerdown' | 'pointermove' | 'pointerup', id: number, x: number, y: number) {
  await page.getByTestId(testId).evaluate(
    (el, a) => el.dispatchEvent(new PointerEvent(a.type, { pointerId: a.id, clientX: a.x, clientY: a.y, bubbles: true, pointerType: 'touch', isPrimary: a.id === 1 })),
    { type, id, x, y },
  )
}

/** 開発中だけ window に出している、ゲームの中の値を読む（fn は s を使う式） */
const dev = <T,>(page: Page, name: string, fn: string) =>
  page.evaluate(([n, f]) => new Function('s', `return ${f}`)((window as unknown as Record<string, unknown>)[n]) as T, [name, fn] as const)

/** canvas に指の操作を送る（clientX/Y は画面の座標） */
async function pointer(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', id: number, x: number, y: number) {
  await page.locator('[data-testid=rally-canvas]').evaluate(
    (el, a) => el.dispatchEvent(new PointerEvent(a.type, { pointerId: a.id, clientX: a.x, clientY: a.y, bubbles: true, pointerType: 'touch', isPrimary: a.id === 1 })),
    { type, id, x, y },
  )
}

const paddles = (page: Page) => page.evaluate(() => (window as unknown as { __rally: { paddles: { x: number; y: number }[] } }).__rally.paddles.map((p) => ({ x: p.x, y: p.y })))

test('ホームから2人そろって「じゅんびOK」でラリーが始まる', async ({ page }) => {
  await open(page, './')
  // ふたりで8つ・ひとりで7つ・おとなも むちゅう5つ・みんなで3つ・じゅんばんモード
  await expect(page.locator('.game-card')).toHaveCount(24)
  await page.locator('[data-game=rally]').click()
  await expect(page).toHaveURL(/#\/setup\/rally/)
  await page.getByTestId('ready-1').click()
  await page.getByTestId('ready-0').click()
  await expect(page).toHaveURL(/#\/play\/rally/)
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
})

test('2人とも「せんしゅ」を選ぶと、ラリーはほんかくルールになる', async ({ page }) => {
  await open(page, './#/setup/rally', ['senshu', 'otona'])
  await page.locator('.setup-side-1 [data-level=senshu]').click()
  await expect(page.getByRole('radio', { name: 'ほんかく' })).toHaveAttribute('aria-checked', 'true')
})

test('上と下の指で、それぞれのパドルが別々に動く', async ({ page }) => {
  await open(page, './#/play/rally')
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  // 下の人は左へ、上の人は右へ（同時に触れている）
  await pointer(page, 'pointerdown', 1, vp.width * 0.2, vp.height * 0.85)
  await pointer(page, 'pointerdown', 2, vp.width * 0.8, vp.height * 0.15)
  await pointer(page, 'pointermove', 1, vp.width * 0.25, vp.height * 0.8)
  await pointer(page, 'pointermove', 2, vp.width * 0.75, vp.height * 0.2)
  await page.waitForTimeout(150)
  const [p0, p1] = await paddles(page)
  expect(p0.x).toBeLessThan(3.05)
  expect(p1.x).toBeGreaterThan(3.05)
  // 下の人のパドルは下の陣地、上の人は上の陣地
  expect(p0.y).toBeGreaterThan(13.41 / 2)
  expect(p1.y).toBeLessThan(13.41 / 2)
})

test('横向きの画面では回して表示し、指の持ち主も正しく決まる', async ({ page }) => {
  const vp = page.viewportSize()!
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) })
  await open(page, './#/play/rally')
  await expect(page.locator('.stage[data-rotated]')).toBeVisible()
  const { width, height } = page.viewportSize()!
  // 90°回すと、画面の左端が「下の人」、右端が「上の人」
  await pointer(page, 'pointerdown', 1, width * 0.1, height * 0.2)
  await pointer(page, 'pointermove', 1, width * 0.12, height * 0.2)
  await pointer(page, 'pointerdown', 2, width * 0.9, height * 0.8)
  await pointer(page, 'pointermove', 2, width * 0.88, height * 0.8)
  await page.waitForTimeout(150)
  const [p0, p1] = await paddles(page)
  expect(p0.y).toBeGreaterThan(13.41 / 2)
  expect(p1.y).toBeLessThan(13.41 / 2)
  // 画面の上の方＝論理座標の左（x が小さい）
  expect(p0.x).toBeLessThan(3.05)
  expect(p1.x).toBeGreaterThan(3.05)
})

test('はやタッチ：みどりに光ったら押した子に1点', async ({ page }) => {
  await open(page, './#/play/hayatouch', ['kids', 'otona'])
  await expect(page.locator('.half-bottom .flash-pad')).toBeVisible()
  await expect(page.locator('.half-top .line-pad')).toBeVisible()
  await expect(page.locator('.half-bottom .flash-pad[data-state=go]')).toBeVisible({ timeout: 10_000 })
  await page.locator('.half-bottom .flash-pad').dispatchEvent('pointerdown')
  await expect(page.locator('.half-bottom .score-pill')).toHaveText('1')
})

test('はやタッチ：光る前に押すとお手つき', async ({ page }) => {
  await open(page, './#/play/hayatouch', ['chibi', 'otona'])
  // 「よーい」が終わって、合図を待っているあいだに押す
  await expect(page.locator('.haya[data-phase=wait]')).toBeVisible({ timeout: 5_000 })
  await page.locator('.half-bottom .flash-pad').dispatchEvent('pointerdown')
  await expect(page.locator('.half-bottom .flash-pad[data-state=locked]')).toBeVisible()
})

test('クイズ：こどもには絵の選択肢、おとなには文字の選択肢。答えると説明が出る', async ({ page }) => {
  await open(page, './#/play/quiz', ['kids', 'senshu'])
  await expect(page.locator('.half-bottom .quiz-choices-pics .pic').first()).toBeVisible()
  await expect(page.locator('.half-top .quiz-choices-pics')).toHaveCount(0)
  await expect(page.locator('.half-bottom .quiz-choice').first()).toBeEnabled()
  await page.locator('.half-bottom .quiz-choice').first().dispatchEvent('pointerdown')
  await page.locator('.half-top .quiz-choice').first().dispatchEvent('pointerdown')
  await expect(page.locator('.quiz-explain').first()).toBeVisible()
})

test('ディンク：最初はキッチンラインに立っている', async ({ page }) => {
  await open(page, './#/play/dink')
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  const [p0, p1] = await paddles(page)
  expect(Math.abs(p0.y - 13.41 / 2)).toBeLessThan(3)
  expect(Math.abs(p1.y - 13.41 / 2)).toBeLessThan(3)
})

test('ひとりで：ねらってショットは、どこを触っても自分のパドルが動き、的が出る', async ({ page }) => {
  await open(page, './')
  await page.locator('[data-game=target]').click()
  await expect(page).toHaveURL(/#\/setup\/target/)
  await page.getByTestId('solo-start').click()
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  // 画面の上の方を触っても、下（自分）のパドルが動く
  await pointer(page, 'pointerdown', 1, vp.width * 0.8, vp.height * 0.3)
  await pointer(page, 'pointermove', 1, vp.width * 0.82, vp.height * 0.3)
  await page.waitForTimeout(150)
  const [p0] = await paddles(page)
  expect(p0.x).toBeGreaterThan(3.05)
  await expect(page.locator('.solo-banner')).toContainText(/いれよう|おとそう|ふかく|ドロップ|コーナー/, { timeout: 8_000 })
})

test('ひとりで：ピクルくんとラリーでは、ピクルくんが自分で動いて打ち返す', async ({ page }) => {
  await open(page, './#/play/pikuru')
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  // 自分のサーブを打つ
  await page.waitForTimeout(3300)
  const vp = page.viewportSize()!
  await pointer(page, 'pointerdown', 1, vp.width * 0.6, vp.height * 0.95)
  for (let i = 1; i <= 6; i++) {
    await pointer(page, 'pointermove', 1, vp.width * 0.6, vp.height * (0.95 - i * 0.03))
    await page.waitForTimeout(16)
  }
  await pointer(page, 'pointerup', 1, vp.width * 0.6, vp.height * 0.77)
  // ピクルくんが打ち返す（上の人が打った＝lastHitter が 1 になる）か、点が入るまで待つ
  await page.waitForFunction(
    () => {
      const e = (window as unknown as { __rally: { state: { lastHitter: number; shot: number }; score: number[] } }).__rally
      return (e.state.lastHitter === 1 && e.state.shot >= 1) || e.score[0] + e.score[1] > 0
    },
    undefined,
    { timeout: 20_000 },
  )
  await expect(page.locator('.solo-score')).toContainText('ピクルくん')
})

test('ひとりで：ピクルくんジャンプは、タップで3段まで跳べる', async ({ page }) => {
  await open(page, './#/play/jump')
  const canvas = page.getByTestId('jump-canvas')
  await expect(canvas).toBeVisible()
  // 走り出すのを待ってから、すばやく4回タップ
  await page.waitForTimeout(2600)
  for (let i = 0; i < 4; i++) {
    await canvas.dispatchEvent('pointerdown')
    await page.waitForTimeout(60)
  }
  const s = await page.evaluate(() => {
    const r = (window as unknown as { __jump: { y: number; jumps: number } }).__jump
    return { y: r.y, jumps: r.jumps }
  })
  expect(s.y).toBeGreaterThan(0)
  expect(s.jumps).toBe(3)
  await expect(page.locator('.jump-dots i[data-used]')).toHaveCount(3)
})

test('ふたりで：ピクルくずし たいせんは、上と下のパドルが別々に動く', async ({ page }) => {
  await open(page, './#/play/breakout2')
  const canvas = page.getByTestId('breakout-canvas')
  await expect(canvas).toBeVisible()
  const vp = page.viewportSize()!
  const fire = (type: string, id: number, x: number, y: number) =>
    canvas.evaluate((el, a) => el.dispatchEvent(new PointerEvent(a.type, { pointerId: a.id, clientX: a.x, clientY: a.y, bubbles: true, pointerType: 'touch' })), { type, id, x, y })
  await fire('pointerdown', 1, vp.width * 0.2, vp.height * 0.9)
  await fire('pointerdown', 2, vp.width * 0.8, vp.height * 0.1)
  await page.waitForTimeout(100)
  const xs = await page.evaluate(() => (window as unknown as { __breakout: { paddles: { x: number }[] } }).__breakout.paddles.map((p) => p.x))
  expect(xs[0]).toBeLessThan(50)
  expect(xs[1]).toBeGreaterThan(50)
})

test('「？」で、あそびかた・ルールのページが開き、ゲームが止まる。とじると続きから', async ({ page }) => {
  await open(page, './#/play/rally')
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  await page.getByTestId('help-btn').click()
  await expect(page.getByRole('dialog', { name: /ラリーたいけつの あそびかた/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ルールと はんてい' })).toBeVisible()
  const timer = () => page.evaluate(() => (window as unknown as { __rally: { timer: number } }).__rally.timer)
  const t0 = await timer()
  await page.waitForTimeout(700)
  expect(await timer()).toBe(t0)
  await page.getByTestId('howto-close').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(400)
  expect(await timer()).toBeLessThan(t0)
})

test('ひとりで遊ぶ準備画面からも、あそびかた・ルールが見られる', async ({ page }) => {
  await open(page, './#/setup/jump')
  await page.getByRole('button', { name: /あそびかた・ルールを みる/ }).click()
  await expect(page.getByRole('dialog', { name: /ピクルくん ジャンプの あそびかた/ })).toContainText('3だん')
})

test('はじめて開くと、プレゼント（ほし3つ）の知らせが出る', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: 'はじめての プレゼント' })).toBeVisible()
  await page.getByRole('button', { name: 'ありがとう！' }).click()
  await expect(page.getByTestId('home-stars')).toContainText('3')
  await expect(page.getByTestId('missions').locator('.mission-list li')).toHaveCount(3)
})

test('きせかえ：ほしと こうかんして、つけられる', async ({ page }) => {
  await open(page, './#/collection')
  await page.getByTestId('item-wear:flower').click()
  await page.getByTestId('trade').click()
  await expect(page.getByTestId('stars')).toContainText('1')
  await expect(page.getByTestId('item-wear:flower')).toHaveAttribute('data-on', 'true')
  // パドルの色：持っていない物は こうかんの確認が出る（ほしが足りない）
  await page.getByRole('tab', { name: 'パドルの いろ' }).click()
  await page.getByTestId('item-design:rainbow').click()
  await expect(page.getByText(/たりないよ/)).toBeVisible()
})

test('2人の準備画面で、それぞれパドルを えらべる', async ({ page }) => {
  await open(page, './#/setup/air', ['kids', 'otona'], { ...PROGRESS, owned: [...PROGRESS.owned, 'design:dots'] })
  await page.getByTestId('paddle-btn-1').click()
  const picker = page.getByTestId('paddle-picker')
  await picker.getByRole('radio', { name: /みずたま/ }).click()
  await picker.getByRole('button', { name: 'OK' }).click()
  const paddles = await page.evaluate(() => JSON.parse(localStorage.getItem('softtennis-asobi:settings') ?? '{}').paddles)
  expect(paddles[1].design).toBe('dots')
  expect(paddles[0].design).toBe('orange')
})

test('れんだ つなひき：たくさんタッチした方へボールが進む', async ({ page }) => {
  await open(page, './#/play/tug')
  await expect(page.getByTestId('tug-canvas')).toBeVisible()
  await page.waitForFunction(() => (window as unknown as { __tug?: { phase: string } }).__tug?.phase === 'pull', undefined, { timeout: 6_000 })
  const vp = page.viewportSize()!
  for (let i = 0; i < 10; i++) {
    await touch(page, 'tug-canvas', 'pointerdown', i + 1, vp.width * 0.2, vp.height * 0.85)
    await page.waitForTimeout(90)
  }
  expect(await dev<number>(page, '__tug', 's.pos')).toBeGreaterThan(0.1)
})

test('エアピックル：上と下のパドルは、それぞれ自分の半分で動く', async ({ page }) => {
  await open(page, './#/play/air')
  await expect(page.getByTestId('air-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  await touch(page, 'air-canvas', 'pointerdown', 1, vp.width * 0.2, vp.height * 0.6)
  await touch(page, 'air-canvas', 'pointerdown', 2, vp.width * 0.8, vp.height * 0.3)
  await touch(page, 'air-canvas', 'pointermove', 1, vp.width * 0.2, vp.height * 0.1)
  await page.waitForTimeout(300)
  const ps = await dev<{ x: number; y: number }[]>(page, '__air', 's.paddles.map((p) => ({ x: p.x, y: p.y }))')
  expect(ps[0].x).toBeLessThan(50)
  expect(ps[0].y).toBeGreaterThan(85)
  expect(ps[1].x).toBeGreaterThan(50)
  expect(ps[1].y).toBeLessThan(85)
})

test('ポンポン リフティング：パドルを外すと終わり、結果から きねんカード（おうちの人の確認つき）', async ({ page }) => {
  await open(page, './#/play/lift')
  await expect(page.getByTestId('lift-canvas')).toBeVisible()
  // 1回目のボールが落ちる前に、パドルを遠くへ
  await page.evaluate(() => {
    const s = (window as unknown as { __lift: { paddle: { x: number; y: number } } }).__lift
    s.paddle.x = 90
    s.paddle.y = 140
  })
  await expect(page.getByText('0かい つづいた！')).toBeVisible({ timeout: 8_000 })
  await page.getByTestId('share-btn').click()
  await expect(page.getByTestId('parent-gate')).toBeVisible()
  await page.locator('[data-testid=parent-gate] button[data-answer]').click()
  await expect(page.getByTestId('share-sheet').locator('img.share-img')).toBeVisible({ timeout: 8_000 })
  // 保存のしかたは端末しだい。どの端末でも やり方の文が出る
  await expect(page.getByTestId('share-hint')).not.toBeEmpty()
})

test.describe('きねんカードの保存：iPhone は「写真に保存」（共有の画面から）', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' })
  test('ダウンロードのリンクは出さず、共有の画面に画像だけを渡す', async ({ page }) => {
    await page.addInitScript(() => {
      // 共有の画面を まねる（渡されたものを記録する）
      const w = window as unknown as { __shared?: { files: number; text?: string } }
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      Object.defineProperty(navigator, 'share', {
        value: async (d: { files?: File[]; text?: string }) => {
          w.__shared = { files: d.files?.length ?? 0, text: d.text }
        },
        configurable: true,
      })
    })
    await open(page, './#/play/lift')
    await page.evaluate(() => {
      const s = (window as unknown as { __lift: { paddle: { x: number; y: number } } }).__lift
      s.paddle.x = 90
      s.paddle.y = 140
    })
    await page.getByTestId('share-btn').click({ timeout: 10_000 })
    await page.locator('[data-testid=parent-gate] button[data-answer]').click()
    await expect(page.getByTestId('share-save')).toHaveText('写真に保存', { timeout: 8_000 })
    await expect(page.locator('[data-testid=share-sheet] a[download]')).toHaveCount(0)
    await page.getByTestId('share-save').click()
    expect(await page.evaluate(() => (window as unknown as { __shared: { files: number; text?: string } }).__shared)).toEqual({ files: 1 })
    await expect(page.getByTestId('share-hint')).toContainText('画像を保存')
  })
})

test('ボールキャッチ：指を動かすと かごが ついてくる', async ({ page }) => {
  await open(page, './#/play/catch')
  await expect(page.getByTestId('catch-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  await touch(page, 'catch-canvas', 'pointerdown', 1, vp.width * 0.15, vp.height * 0.7)
  expect(await dev<number>(page, '__catch', 's.basketX')).toBeLessThan(35)
  await touch(page, 'catch-canvas', 'pointermove', 1, vp.width * 0.85, vp.height * 0.7)
  expect(await dev<number>(page, '__catch', 's.basketX')).toBeGreaterThan(65)
})

test('じゅんばんモード：2人で3ラウンド遊ぶと表彰式。おうかんが もらえる', async ({ page }) => {
  await open(page, './#/party')
  await page.getByTestId('party-count-2').click()
  await page.getByRole('radio', { name: '3ラウンド' }).click()
  await page.getByTestId('party-start').click()
  for (let round = 0; round < 3; round++) {
    await page.getByTestId('party-next').click() // ラウンドの発表 → 1人目
    for (let p = 0; p < 2; p++) {
      // 小さいほど良い記録のゲーム（反応の時間・ずれ）かどうかは、交代の画面のゲーム名で見る
      const low = /リアクション|ピタッと|ピクルくん さがし/.test((await page.getByTestId('party-go').textContent()) ?? '')
      await page.getByTestId('party-go').click()
      await page.waitForFunction(() => typeof (window as unknown as { __partyFinish?: unknown }).__partyFinish === 'function')
      // いつもオレンジ（1人目）が勝つ記録
      await page.evaluate((v) => (window as unknown as { __partyFinish: (v: number) => void }).__partyFinish(v), p === 0 ? (low ? 5 : 10) : low ? 10 : 5)
      await page.getByTestId('party-next').click() // つぎの人 or ラウンドの結果
    }
    await expect(page.getByTestId('party-round')).toBeVisible()
    await page.getByTestId('party-next').click()
  }
  const final = page.getByTestId('party-final')
  await expect(final).toBeVisible()
  await expect(final.locator('.podium-col[data-rank="1"]')).toContainText('オレンジ')
  await expect(final.getByTestId('rewards')).toContainText('おうかん')
})

test('おうちの方へ：かけ算の確認のあとに、記録と集計の説明が見られる', async ({ page }) => {
  await open(page, './')
  await page.getByTestId('parents-link').click()
  await expect(page.getByTestId('parent-gate')).toBeVisible()
  await page.locator('[data-testid=parent-gate] button[data-answer]').click()
  await expect(page.getByRole('heading', { name: '遊ばれた回数の集計（匿名）' })).toBeVisible()
  // 開発中・集計先が未設定のときは送らない
  await expect(page.getByTestId('counter-status')).toContainText('送っていません')
})

test('おとなも むちゅう：5つのゲームがホームにある', async ({ page }) => {
  await open(page, './')
  const adult = page.locator('#games-adult').locator('..')
  for (const id of ['linestop', 'curling', 'serveread', 'reaction', 'stop10']) await expect(adult.locator(`[data-game=${id}]`)).toBeVisible()
})

test('ラインぎわ ストップ：タップで自分のボールだけが止まる', async ({ page }) => {
  await open(page, './#/play/linestop')
  await page.waitForFunction(() => (window as unknown as { __ls?: { phase: string } }).__ls?.phase === 'roll', undefined, { timeout: 6_000 })
  await page.waitForTimeout(400)
  const vp = page.viewportSize()!
  await touch(page, 'linestop-canvas', 'pointerdown', 1, vp.width / 2, vp.height * 0.8)
  const lanes = await dev<{ stopped: boolean; byTap: boolean }[]>(page, '__ls', 's.lanes.map((l) => ({ stopped: l.stopped, byTap: l.byTap }))')
  expect(lanes[0]).toEqual({ stopped: true, byTap: true })
  expect(lanes[1].byTap).toBe(false)
})

test('キッチン カーリング：自分の番に、引いて はなすと投げる', async ({ page }) => {
  await open(page, './#/play/curling')
  await expect(page.getByTestId('curling-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  // 上の人は番ではないので投げられない
  await touch(page, 'curling-canvas', 'pointerdown', 2, vp.width / 2, vp.height * 0.3)
  await touch(page, 'curling-canvas', 'pointermove', 2, vp.width / 2, vp.height * 0.1)
  await touch(page, 'curling-canvas', 'pointerup', 2, vp.width / 2, vp.height * 0.1)
  expect(await dev<number>(page, '__curling', 's.stones.length')).toBe(0)
  // 下の人：下へ引いて はなす
  await touch(page, 'curling-canvas', 'pointerdown', 1, vp.width / 2, vp.height * 0.7)
  await touch(page, 'curling-canvas', 'pointermove', 1, vp.width / 2, vp.height * 0.7 + 110)
  await touch(page, 'curling-canvas', 'pointerup', 1, vp.width / 2, vp.height * 0.7 + 110)
  expect(await dev<number>(page, '__curling', 's.stones.length')).toBe(1)
  await page.waitForFunction(() => (window as unknown as { __curling: { turn: number; phase: string } }).__curling.turn === 1, undefined, { timeout: 8_000 })
})

test('よみあい サーブ：1人ずつ こっそり選ぶ。番でない人の半分は「めを とじてね」', async ({ page }) => {
  await open(page, './#/play/serveread')
  await expect(page.getByTestId('sr-pick-0')).toBeVisible({ timeout: 6_000 })
  await expect(page.locator('.sr-half[data-side="1"]')).toContainText('めを とじて')
  await page.getByTestId('sr-0-wide').dispatchEvent('pointerdown')
  await page.getByTestId('sr-done-0').dispatchEvent('pointerdown')
  await expect(page.getByTestId('sr-pick-1')).toBeVisible()
  await page.getByTestId('sr-1-body').dispatchEvent('pointerdown')
  await page.getByTestId('sr-done-1').dispatchEvent('pointerdown')
  // さいごの かけひき：そのまま
  await page.getByTestId('sr-done-0').dispatchEvent('pointerdown')
  await page.getByTestId('sr-done-1').dispatchEvent('pointerdown')
  await expect(page.getByTestId('sr-reveal-0')).toBeVisible()
  await expect(page.getByTestId('sr-reveal-0')).toContainText('サービスエース', { timeout: 4_000 })
  expect(await dev<number[]>(page, '__sr', 's.score')).toEqual([3, 0])
})

test('リアクション ボレー：早く押すとフライング。球が出てから押すと時間がのこる', async ({ page }) => {
  await open(page, './#/play/reaction')
  await page.waitForFunction(() => (window as unknown as { __rx: { phase: string } }).__rx.phase === 'wait', undefined, { timeout: 6_000 })
  await page.getByTestId('rx-area').dispatchEvent('pointerdown')
  await expect(page.getByText('フライング！')).toBeVisible()
  await page.waitForFunction(() => (window as unknown as { __rx: { phase: string } }).__rx.phase === 'go', undefined, { timeout: 10_000 })
  await page.getByTestId('rx-area').dispatchEvent('pointerdown')
  const res = await dev<number[]>(page, '__rx', 's.results')
  expect(res[0]).toBe(1000)
  expect(res[1]).toBeLessThan(1000)
})

test('ピタッと 10びょう：タップで打ち上げ、もう一度タップで止める', async ({ page }) => {
  await open(page, './#/play/stop10')
  await page.getByTestId('s10-area').dispatchEvent('pointerdown')
  await page.waitForTimeout(600)
  await page.getByTestId('s10-area').dispatchEvent('pointerdown')
  const r = await dev<number[]>(page, '__s10', 's.results')
  expect(r).toHaveLength(1)
  expect(r[0]).toBeGreaterThan(8000)
})

test('じゅんばんモード：チーム戦で遊ぶと、チームの勝ち負けが出る', async ({ page }) => {
  await open(page, './#/party')
  await page.getByTestId('party-count-4').click()
  await page.getByTestId('party-team-mode').click()
  await page.getByRole('radio', { name: '3ラウンド' }).click()
  await page.getByTestId('party-start').click()
  for (let round = 0; round < 3; round++) {
    await page.getByTestId('party-next').click()
    for (let p = 0; p < 4; p++) {
      const lowGame = /リアクション|ピタッと|ピクルくん さがし/.test((await page.getByTestId('party-go').textContent()) ?? '')
      await page.getByTestId('party-go').click()
      await page.waitForFunction(() => typeof (window as unknown as { __partyFinish?: unknown }).__partyFinish === 'function')
      // チーム0（オレンジ・ピンク）がいつも勝つ記録を入れる
      const good = p % 2 === 0
      await page.evaluate((v) => (window as unknown as { __partyFinish: (v: number) => void }).__partyFinish(v), lowGame ? (good ? 100 : 900) : good ? 90 : 10)
      await page.getByTestId('party-next').click()
    }
    await page.getByTestId('party-next').click()
  }
  await expect(page.getByTestId('party-team-win')).toContainText('ピクルス')
})

test('れんだ つなひき：準備画面で 2たい2 を選べる', async ({ page }) => {
  await open(page, './#/setup/tug')
  await page.getByTestId('tug-team').click()
  await page.getByTestId('ready-1').click()
  await page.getByTestId('ready-0').click()
  await page.waitForFunction(() => (window as unknown as { __tug?: { maxRate: number } }).__tug?.maxRate === 28)
})

test('ホーム：どのカードにも ゲームの絵。ひとりで記録を出すと メダルと「また あそぶ」に出る', async ({ page }) => {
  await open(page, './')
  await expect(page.locator('.game-card .game-icon')).toHaveCount(23)
  await page.goto('./#/play/lift')
  await expect(page.getByTestId('lift-canvas')).toBeVisible()
  // 6かい つづいた ことにして、パドルを遠くへ（どうメダルは 5かい）
  await page.evaluate(() => {
    const s = (window as unknown as { __lift: { count: number; paddle: { x: number; y: number } } }).__lift
    s.count = 6
    s.paddle.x = 90
    s.paddle.y = 140
  })
  await expect(page.getByText('6かい つづいた！')).toBeVisible({ timeout: 8_000 })
  await expect(page.getByTestId('rewards')).toContainText('どうメダル')
  await page.goto('./#/')
  await expect(page.locator('[data-recent=lift]')).toBeVisible()
  await expect(page.getByTestId('best-lift')).toContainText('6かい')
  await page.getByTestId('records-link').click()
  await expect(page.getByTestId('medal-total')).toContainText('1')
  await expect(page.getByTestId('rec-lift')).toContainText('つぎは ぎんメダル')
})

test('遊びすぎの声かけ：決めた時間をこえると、結果のときに「きゅうけい しよう」', async ({ page }) => {
  await open(page, './#/play/lift')
  await expect(page.getByTestId('lift-canvas')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __setPlayed: (s: number) => void }).__setPlayed(31 * 60)
    const s = (window as unknown as { __lift: { paddle: { x: number; y: number } } }).__lift
    s.paddle.x = 90
    s.paddle.y = 140
  })
  await expect(page.getByTestId('break-sheet')).toBeVisible({ timeout: 8_000 })
  await page.getByRole('button', { name: 'あと 1かい だけ' }).click()
  await expect(page.getByTestId('break-sheet')).toBeHidden()
})

test('よみあい サーブの準備：レベルは えらばず、えらぶ時間だけ', async ({ page }) => {
  await open(page, './#/setup/serveread')
  await expect(page.locator('.setup-nolevel')).toHaveCount(2)
  await expect(page.locator('.level-grid')).toHaveCount(0)
  await page.getByTestId('ready-0').click()
  await page.getByTestId('ready-1').click()
  await expect(page.getByTestId('sr-pick-0')).toBeVisible({ timeout: 6_000 })
})

test('にせピクルくん：1人ずつ お題を見る（1人だけ ちがう）→ ゆびさし → ぎゃくてん チャンス → 結果', async ({ page }) => {
  await open(page, './#/')
  await expect(page.locator('[data-game=nise]')).toBeVisible()
  await expect(page.locator('[data-game=gesture]')).toBeVisible()
  await page.locator('[data-game=nise]').click()
  await page.getByTestId('nise-count-3').click()
  await page.getByTestId('nise-deck-e').click()
  await page.getByTestId('nise-start').click()
  const words: string[] = []
  for (let i = 0; i < 3; i++) {
    // 手わたしの幕の間は、お題が画面に無い
    await expect(page.getByTestId('nise-go')).toBeVisible()
    await expect(page.locator('.nise-word')).toHaveCount(0)
    await page.getByTestId('nise-go').click()
    words.push((await page.locator('.nise-word-text').textContent()) ?? '')
    await page.getByTestId('nise-hide').click()
  }
  const wolf = await page.evaluate(() => (window as unknown as { __nise: { wolf: number } }).__nise.wolf)
  const odd = words.filter((w) => w !== words[(wolf + 1) % 3])
  expect(odd).toEqual([words[wolf]])
  await page.getByTestId('nise-talk').click()
  await expect(page.getByTestId('nise-talk-card')).toBeVisible()
  await page.getByTestId('nise-to-point').click()
  await page.getByTestId('nise-seno').click()
  await page.getByTestId(`nise-point-${wolf}`).click()
  await expect(page.getByTestId('nise-reveal')).toContainText('にせピクルくん だった', { timeout: 4_000 })
  // ばれたときは、ぎゃくてん チャンスまで お題を見せない
  await expect(page.locator('.nise-answers')).toHaveCount(0)
  await page.getByTestId('nise-chance').click()
  await page.getByTestId('nise-answer').click()
  await page.getByTestId('nise-guess-wrong').click()
  const result = page.getByTestId('nise-result')
  await expect(result).toContainText('みんなの かち')
  await expect(result.locator('.nise-mark')).toHaveCount(1)
  // つぎの おだい：また1人目から
  await page.getByTestId('nise-again').click()
  await expect(page.getByTestId('nise-go')).toContainText('オレンジ')
})

test('ジェスチャー ピックル：あたり・パスを数えて、みんなの合計を出す', async ({ page }) => {
  await open(page, './#/setup/gesture')
  await page.getByTestId('gesture-count-2').click()
  await page.getByTestId('gesture-start').click()
  for (const hits of [2, 1]) {
    await page.getByTestId('gesture-go').click()
    await expect(page.getByTestId('gesture-act')).toBeVisible({ timeout: 6_000 })
    for (let i = 0; i < hits; i++) await page.getByTestId('gesture-hit').click()
    await page.getByTestId('gesture-pass').click()
    await page.evaluate(() => (window as unknown as { __gestureEnd: () => void }).__gestureEnd())
    await expect(page.getByTestId('gesture-turn')).toContainText(`${hits}`)
    await page.getByTestId('gesture-next').click()
  }
  await expect(page.getByTestId('gesture-total')).toContainText('3')
})

test('よみあい サーブ「てわたし」：選ぶ人だけが画面を見る。幕の間は選べない', async ({ page }) => {
  await open(page, './#/setup/serveread')
  await page.getByTestId('sr-style-pass').click()
  await page.getByTestId('ready-0').click()
  await page.getByTestId('ready-1').click()
  await expect(page.getByTestId('sr-pass-go')).toContainText('オレンジ', { timeout: 6_000 })
  await expect(page.locator('[data-testid^=sr-pick-]')).toHaveCount(0)
  await page.getByTestId('sr-pass-go').click()
  await page.getByTestId('sr-0-wide').dispatchEvent('pointerdown')
  await page.getByTestId('sr-done-0').dispatchEvent('pointerdown')
  await expect(page.getByTestId('sr-pass-go')).toContainText('あお')
  await page.getByTestId('sr-pass-go').click()
  await page.getByTestId('sr-1-body').dispatchEvent('pointerdown')
  await page.getByTestId('sr-done-1').dispatchEvent('pointerdown')
  // さいごの かけひきは なく、すぐ発表
  await expect(page.getByTestId('sr-reveal-0')).toContainText('サービスエース', { timeout: 4_000 })
  expect(await dev<number[]>(page, '__sr', 's.score')).toEqual([3, 0])
})

test('ひとりのゲームを「みんなで じゅんばん」：そのゲームだけで勝負する', async ({ page }) => {
  await open(page, './#/setup/jump')
  await page.getByTestId('solo-party').click()
  await expect(page.getByTestId('party-only')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('party-rounds-1')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('party-count-2').click()
  await page.getByTestId('party-start').click()
  await expect(page.locator('.party-game')).toContainText('ピクルくん ジャンプ')
  await page.getByTestId('party-next').click()
  await expect(page.getByTestId('party-go')).toContainText('ピクルくん ジャンプ')
})

test('にせピクルくん「こっそり とうひょう」：1台を回して1人ずつ選ぶ。票の数で決まる', async ({ page }) => {
  await open(page, './#/setup/nise')
  await page.getByTestId('nise-count-3').click()
  await page.getByTestId('nise-vote-secret').click()
  await page.getByTestId('nise-start').click()
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('nise-go').click()
    await page.getByTestId('nise-hide').click()
  }
  const wolf = await page.evaluate(() => (window as unknown as { __nise: { wolf: number } }).__nise.wolf)
  await page.getByTestId('nise-talk').click()
  await page.getByTestId('nise-to-point').click()
  for (let v = 0; v < 3; v++) {
    await page.getByTestId('nise-vote-go').click()
    // 自分には とうひょうできない
    await expect(page.getByTestId(`nise-vote-${v}`)).toHaveCount(0)
    const target = v === wolf ? (wolf + 1) % 3 : wolf
    await page.getByTestId(`nise-vote-${target}`).click()
  }
  await expect(page.getByTestId('nise-reveal')).toContainText('にせピクルくん だった', { timeout: 4_000 })
  await expect(page.locator('.nise-votes')).toContainText('2ひょう')
})

test('いしんでんしん「むかいあう」：上下で同時に選ぶ。同じなら いしんでんしん', async ({ page }) => {
  await open(page, './#/setup/ishin')
  await page.getByTestId('ishin-size-2').click()
  await page.getByTestId('ishin-style-face').click()
  await page.getByTestId('ishin-n-5').click()
  await page.getByTestId('ishin-start').click()
  // 1もんめ：同じもの → いしんでんしん
  await page.getByTestId('ishin-face-0-0').click()
  await expect(page.getByText('えらんだ！ あいてを まってね')).toBeVisible()
  await page.getByTestId('ishin-face-1-0').click()
  await expect(page.getByTestId('ishin-verdict').first()).toContainText('いしんでんしん', { timeout: 3_000 })
  await page.getByTestId('ishin-next').first().click()
  // のこり4もん：ちがうもの
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('ishin-face-0-0').click()
    await page.getByTestId('ishin-face-1-1').click()
    await expect(page.getByTestId('ishin-verdict').first()).toContainText('おしい', { timeout: 3_000 })
    await page.getByTestId('ishin-next').first().click()
  }
  await expect(page.getByTestId('ishin-score')).toContainText('1')
})

test('いしんでんしん 4人：てわたしで2ペアたいせん。そろった数で勝ち負け', async ({ page }) => {
  await open(page, './#/setup/ishin')
  await page.getByTestId('ishin-size-4').click()
  await page.getByTestId('ishin-n-5').click()
  await page.getByTestId('ishin-start').click()
  for (let k = 0; k < 5; k++) {
    await page.getByTestId('ishin-go-pick').click()
    // じゅんばんは オレンジ → ピンク → あお → みどり（ペアが続かない）
    for (const [j, name] of ['オレンジ', 'ピンク', 'あお', 'みどり'].entries()) {
      await expect(page.getByTestId('ishin-pass-go')).toContainText(name)
      await page.getByTestId('ishin-pass-go').click()
      // ピクルス（オレンジ・あお）は いつも そろう、パドル（ピンク・みどり）は そろわない
      const choice = j === 0 || j === 2 ? 0 : j === 1 ? 0 : 1
      await page.getByTestId(`ishin-choice-${choice}`).click()
      await page.getByTestId('ishin-decide').click()
    }
    await expect(page.getByTestId('ishin-reveal')).toBeVisible()
    await page.getByTestId('ishin-next').click()
  }
  await expect(page.getByTestId('ishin-winner')).toContainText('ピクルス')
})

test('ピクルくん さがし：ちがう人では進まず、ほんものを押すと場所の名前が出て次へ', async ({ page }) => {
  await open(page, './#/setup/sagasu')
  await page.getByTestId('sagasu-mode-wally').click()
  await page.getByTestId('solo-start').click()
  await expect(page.getByTestId('sagasu-scene')).toBeVisible()
  const ids = await page.evaluate(() => {
    const w = (window as unknown as { __sagasu: { wally: { target: string; scene: { people: { id: string }[] } } } }).__sagasu.wally
    return { target: w.target, other: w.scene.people.find((p) => p.id !== w.target)!.id }
  })
  await page.locator(`[data-testid=sagasu-scene] [data-person=${ids.other}]`).dispatchEvent('pointerdown')
  await expect(page.getByText('ちがうよ')).toBeVisible()
  await expect(page.getByText('1 / 5かいめ')).toBeVisible()
  await page.locator(`[data-testid=sagasu-scene] [data-person=${ids.target}]`).dispatchEvent('pointerdown')
  await expect(page.getByTestId('sagasu-found')).toContainText(/キッチン|サービスコート|コートの そと/)
  await expect(page.getByText('2 / 5かいめ')).toBeVisible({ timeout: 4_000 })
})

test('まちがいさがし：上でも下でも、ちがう所を押すと見つかる。ぜんぶ見つけたら結果', async ({ page }) => {
  await open(page, './#/setup/sagasu')
  await page.getByTestId('sagasu-mode-diff').click()
  await page.getByTestId('solo-start').click()
  await expect(page.getByTestId('sagasu-b')).toBeVisible()
  const ids = await page.evaluate(() => (window as unknown as { __sagasu: { diff: { diffs: { id: string }[] } } }).__sagasu.diff.diffs.map((d) => d.id))
  for (const [i, id] of ids.entries()) {
    await page.locator(`[data-testid=${i % 2 ? 'sagasu-a' : 'sagasu-b'}] [data-diff=${id}]`).dispatchEvent('pointerdown')
    if (i < ids.length - 1) await expect(page.getByTestId('sagasu-left')).toContainText(`のこり ${ids.length - i - 1}こ`)
  }
  await expect(page.getByText('ぜんぶ みつけた！')).toBeVisible({ timeout: 4_000 })
})

test('ピクルくん さがし たいせん：先に見つけた人に1点。ちがう人を押すと おてつき', async ({ page }) => {
  await open(page, './#/play/sagasu2', ['chibi', 'otona'])
  await expect(page.getByTestId('sagasu-duel-0')).toBeVisible({ timeout: 4_000 })
  const t = await page.evaluate(() => {
    const r = (window as unknown as { __sagasuDuel: { rounds: { target: string; scene: { people: { id: string }[] } }[] } }).__sagasuDuel.rounds
    return { t0: r[0].target, t1: r[1].target, o1: r[1].scene.people.find((p) => p.id !== r[1].target)!.id }
  })
  await page.locator(`[data-testid=sagasu-duel-1] [data-person=${t.o1}]`).dispatchEvent('pointerdown')
  await expect(page.getByText('おてつき！')).toBeVisible()
  await page.locator(`[data-testid=sagasu-duel-0] [data-person=${t.t0}]`).dispatchEvent('pointerdown')
  await expect(page.getByText('オレンジが みつけた！').first()).toBeVisible()
  await expect(page.locator('.score-pill[data-side="0"]')).toContainText('1')
})

test.describe('インスタの中のブラウザで開いたとき', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.27.105 (iPhone15,2; iOS 18_5; ja_JP; ja; scale=3.00; 1179x2556; 712345678)',
  })
  test('ホームの上に おうちの方への案内。方法のページで Safari で開くボタンとリンクのコピー', async ({ page }) => {
    await open(page, './?src=pb_ig_bio#/')
    await expect(page.getByTestId('inapp-banner')).toContainText('Instagram')
    await page.getByTestId('inapp-banner').getByRole('link').click()
    await expect(page.getByTestId('install-inapp')).toBeVisible()
    const href = await page.getByTestId('install-open-external').getAttribute('href')
    expect(href).toMatch(/^x-safari-https:\/\/.+\?src=pb_ig_bio&go=install$/)
    await expect(page.getByTestId('install-tab-ios')).toHaveAttribute('aria-selected', 'true')
  })
})

test('ふつうのブラウザ：案内は出ない。?go=install で開くと方法のページ', async ({ page }) => {
  await open(page, './#/')
  await expect(page.locator('.game-card').first()).toBeVisible()
  await expect(page.getByTestId('inapp-banner')).toHaveCount(0)
  await page.goto('./?go=install')
  await expect(page).toHaveURL(/#\/install$/)
  await expect(page.getByTestId('install-tab-android')).toBeVisible()
  await expect(page.getByTestId('install-inapp')).toHaveCount(0)
})
