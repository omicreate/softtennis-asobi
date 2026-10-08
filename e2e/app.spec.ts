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

/** コートのまんなか（m）。シングルスのコート 8.23 × 23.77（競技規則 第5条・シングルス 第2条） */
const MID_X = 8.23 / 2
const MID_Y = 23.77 / 2

const paddles = (page: Page) => page.evaluate(() => (window as unknown as { __rally: { paddles: { x: number; y: number }[] } }).__rally.paddles.map((p) => ({ x: p.x, y: p.y })))

test('ホームから2人そろって「じゅんびOK」でラリーが始まる', async ({ page }) => {
  await open(page, './')
  // ふたりで2つ・ひとりで3つ・おとなも むちゅう3つ・みんなで2つ・じゅんばんモード
  await expect(page.locator('.game-card')).toHaveCount(11)
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

test('上と下の指で、それぞれのラケットが別々に動く', async ({ page }) => {
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
  expect(p0.x).toBeLessThan(MID_X)
  expect(p1.x).toBeGreaterThan(MID_X)
  // 下の人のラケットは下の陣地、上の人は上の陣地
  expect(p0.y).toBeGreaterThan(MID_Y)
  expect(p1.y).toBeLessThan(MID_Y)
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
  expect(p0.y).toBeGreaterThan(MID_Y)
  expect(p1.y).toBeLessThan(MID_Y)
  // 画面の上の方＝論理座標の左（x が小さい）
  expect(p0.x).toBeLessThan(MID_X)
  expect(p1.x).toBeGreaterThan(MID_X)
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

test('ひとりで：ねらって ストロークは、どこを触っても自分のラケットが動き、的が出る', async ({ page }) => {
  await open(page, './')
  await page.locator('[data-game=target]').click()
  await expect(page).toHaveURL(/#\/setup\/target/)
  await page.getByTestId('solo-start').click()
  await expect(page.getByTestId('rally-canvas')).toBeVisible()
  const vp = page.viewportSize()!
  // 画面の上の方を触っても、下（自分）のラケットが動く
  await pointer(page, 'pointerdown', 1, vp.width * 0.8, vp.height * 0.3)
  await pointer(page, 'pointermove', 1, vp.width * 0.82, vp.height * 0.3)
  await page.waitForTimeout(150)
  const [p0] = await paddles(page)
  expect(p0.x).toBeGreaterThan(MID_X)
  await expect(page.locator('.solo-banner')).toContainText(/いれよう|クロス|ストレート|ふかく/, { timeout: 8_000 })
})

test('ひとりで：ホークアイ先生と ラリーでは、ホークアイ先生が自分で動いて打ち返す', async ({ page }) => {
  await open(page, './#/play/sensei')
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
  // ホークアイ先生が打ち返す（上の人が打った＝lastHitter が 1 になる）か、点が入るまで待つ
  await page.waitForFunction(
    () => {
      const e = (window as unknown as { __rally: { state: { lastHitter: number; shot: number }; score: number[] } }).__rally
      return (e.state.lastHitter === 1 && e.state.shot >= 1) || e.score[0] + e.score[1] > 0
    },
    undefined,
    { timeout: 20_000 },
  )
  await expect(page.locator('.solo-score')).toHaveAttribute('aria-label', /ホークアイ先生/)
})

test('ホークアイの め：コートが消えたら答える。答えあわせで もう一度見せ、10もんで結果', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, './#/setup/hawkeye')
  // いちばん短く見せる「せんしゅ」で遊ぶ
  await page.locator('.level-btn[data-level=senshu]').click()
  await page.getByTestId('solo-start').click()
  const area = page.getByTestId('he-area')
  await expect(area).toHaveAttribute('data-phase', 'show')
  await expect(page.locator('.he-look')).toBeVisible()
  for (let i = 0; i < 10; i++) {
    await expect(area).toHaveAttribute('data-phase', 'ask', { timeout: 5_000 })
    await expect(page.locator('.he-hidden')).toBeVisible()
    await page.locator('.he-choice').first().click()
    await expect(area).toHaveAttribute('data-phase', /result|over/)
    await expect(page.locator('.he-explain')).toContainText(/せいかい|おしい/)
    await expect(page.locator('.he-choice.is-right')).toHaveCount(1)
  }
  await expect(page.getByText(/10もん中 \d+もん せいかい/)).toBeVisible({ timeout: 5_000 })
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
  await open(page, './#/setup/hawkeye')
  await page.getByRole('button', { name: /あそびかた・ルールを みる/ }).click()
  await expect(page.getByRole('dialog', { name: /ホークアイの めの あそびかた/ })).toContainText('雁行陣')
})

test('はじめて開くと、プレゼント（ほし3つ）の知らせが出る', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: 'はじめての プレゼント' })).toBeVisible()
  await page.getByRole('button', { name: 'ありがとう！' }).click()
  await expect(page.getByTestId('home-stars')).toContainText('3')
  await expect(page.getByTestId('missions').locator('.mission-list li')).toHaveCount(3)
})

test('きせかえ：ほしと こうかんして、ラケットの いろを かえられる', async ({ page }) => {
  await open(page, './#/collection')
  await expect(page.getByRole('tab', { name: 'ラケットの いろ' })).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('item-design:lime').click()
  await page.getByTestId('trade').click()
  await expect(page.getByTestId('stars')).toContainText('1')
  await expect(page.getByTestId('item-design:lime')).toHaveAttribute('data-on', 'true')
  // 持っていない物は こうかんの確認が出る（ほしが足りない）
  await page.getByTestId('item-design:rainbow').click()
  await expect(page.getByText(/たりないよ/)).toBeVisible()
})

test('2人の準備画面で、それぞれラケットを えらべる', async ({ page }) => {
  await open(page, './#/setup/rally', ['kids', 'otona'], { ...PROGRESS, owned: [...PROGRESS.owned, 'design:dots'] })
  await page.getByTestId('paddle-btn-1').click()
  const picker = page.getByTestId('paddle-picker')
  await picker.getByRole('radio', { name: /みずたま/ }).click()
  await picker.getByRole('button', { name: 'OK' }).click()
  const paddles = await page.evaluate(() => JSON.parse(localStorage.getItem('softtennis-asobi:settings') ?? '{}').paddles)
  expect(paddles[1].design).toBe('dots')
  expect(paddles[0].design).toBe('orange')
})

test('ボールつき：ラケットを外すと終わり、結果から きねんカード（おうちの人の確認つき）', async ({ page }) => {
  await open(page, './#/play/lift')
  await expect(page.getByTestId('lift-canvas')).toBeVisible()
  // 1回目のボールが落ちる前に、ラケットを遠くへ
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

test('じゅんばんモード：2人で3ラウンド遊ぶと表彰式。ラケットの「さくら」が もらえる', async ({ page }) => {
  await open(page, './#/party')
  await page.getByTestId('party-count-2').click()
  await page.getByRole('radio', { name: '3ラウンド' }).click()
  await page.getByTestId('party-start').click()
  for (let round = 0; round < 3; round++) {
    await page.getByTestId('party-next').click() // ラウンドの発表 → 1人目
    for (let p = 0; p < 2; p++) {
      // 小さいほど良い記録のゲーム（反応の時間・ずれ）かどうかは、交代の画面のゲーム名で見る
      const low = /リアクション/.test((await page.getByTestId('party-go').textContent()) ?? '')
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
  await expect(final.getByTestId('rewards')).toContainText('さくら')
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

test('おとなも むちゅう：クイズ・ホークアイの め・リアクション ボレーがホームにある', async ({ page }) => {
  await open(page, './')
  const adult = page.locator('#games-adult').locator('..')
  for (const id of ['quiz', 'hawkeye', 'reaction']) await expect(adult.locator(`[data-game=${id}]`)).toBeVisible()
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

test('じゅんばんモード：チーム戦で遊ぶと、チームの勝ち負けが出る', async ({ page }) => {
  await open(page, './#/party')
  await page.getByTestId('party-count-4').click()
  await page.getByTestId('party-team-mode').click()
  await page.getByRole('radio', { name: '3ラウンド' }).click()
  await page.getByTestId('party-start').click()
  for (let round = 0; round < 3; round++) {
    await page.getByTestId('party-next').click()
    for (let p = 0; p < 4; p++) {
      const lowGame = /リアクション/.test((await page.getByTestId('party-go').textContent()) ?? '')
      await page.getByTestId('party-go').click()
      await page.waitForFunction(() => typeof (window as unknown as { __partyFinish?: unknown }).__partyFinish === 'function')
      // チーム0（オレンジ・ピンク）がいつも勝つ記録を入れる
      const good = p % 2 === 0
      await page.evaluate((v) => (window as unknown as { __partyFinish: (v: number) => void }).__partyFinish(v), lowGame ? (good ? 100 : 900) : good ? 90 : 10)
      await page.getByTestId('party-next').click()
    }
    await page.getByTestId('party-next').click()
  }
  await expect(page.getByTestId('party-team-win')).toContainText('ホークアイ')
})

test('ホーム：どのカードにも ゲームの絵。ひとりで記録を出すと メダルと「また あそぶ」に出る', async ({ page }) => {
  await open(page, './')
  await expect(page.locator('.game-card .game-icon')).toHaveCount(10)
  await page.goto('./#/play/lift')
  await expect(page.getByTestId('lift-canvas')).toBeVisible()
  // 6かい つづいた ことにして、ラケットを遠くへ（どうメダルは 5かい）
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

test('にせホークアイ先生：1人ずつ お題を見る（1人だけ ちがう）→ ゆびさし → ぎゃくてん チャンス → 結果', async ({ page }) => {
  await open(page, './#/')
  await expect(page.locator('[data-game=nise]')).toBeVisible()
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
  await expect(page.getByTestId('nise-reveal')).toContainText('にせホークアイ先生 だった', { timeout: 4_000 })
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

test('ひとりのゲームを「みんなで じゅんばん」：そのゲームだけで勝負する', async ({ page }) => {
  await open(page, './#/setup/hawkeye')
  await page.getByTestId('solo-party').click()
  await expect(page.getByTestId('party-only')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('party-rounds-1')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('party-count-2').click()
  await page.getByTestId('party-start').click()
  await expect(page.locator('.party-game')).toContainText('ホークアイの め')
  await page.getByTestId('party-next').click()
  await expect(page.getByTestId('party-go')).toContainText('ホークアイの め')
})

test('にせホークアイ先生「こっそり とうひょう」：1台を回して1人ずつ選ぶ。票の数で決まる', async ({ page }) => {
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
  await expect(page.getByTestId('nise-reveal')).toContainText('にせホークアイ先生 だった', { timeout: 4_000 })
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
      // チーム ホークアイ（オレンジ・あお）は いつも そろう、チーム ラケット（ピンク・みどり）は そろわない
      const choice = j === 0 || j === 2 ? 0 : j === 1 ? 0 : 1
      await page.getByTestId(`ishin-choice-${choice}`).click()
      await page.getByTestId('ishin-decide').click()
    }
    await expect(page.getByTestId('ishin-reveal')).toBeVisible()
    await page.getByTestId('ishin-next').click()
  }
  await expect(page.getByTestId('ishin-winner')).toContainText('ホークアイ')
})

test.describe('インスタの中のブラウザで開いたとき', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.27.105 (iPhone15,2; iOS 18_5; ja_JP; ja; scale=3.00; 1179x2556; 712345678)',
  })
  test('ホームの上に おうちの方への案内。方法のページで Safari で開くボタンとリンクのコピー', async ({ page }) => {
    await open(page, './?src=st_ig_bio#/')
    await expect(page.getByTestId('inapp-banner')).toContainText('Instagram')
    await page.getByTestId('inapp-banner').getByRole('link').click()
    await expect(page.getByTestId('install-inapp')).toBeVisible()
    const href = await page.getByTestId('install-open-external').getAttribute('href')
    expect(href).toMatch(/^x-safari-https:\/\/.+\?src=st_ig_bio&go=install$/)
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
