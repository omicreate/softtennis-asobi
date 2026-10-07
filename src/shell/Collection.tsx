/**
 * きせかえ（コレクション）。ほし（⭐）と こうかんして、ピクルくんの小物・パドルの色と もよう・かたちを集める。
 * ここで えらんだパドルは「じぶんの パドル」（ひとりで遊ぶとき・2人のときの下の人）になる。
 */
import { useState } from 'react'
import { ITEMS, SPECIAL_TEXT } from '../core/items'
import type { Item, ItemKind } from '../core/items'
import { buy, owns, specialMet, toggleWear, useProgress } from '../core/progress'
import { setSettings, useSettings } from '../core/settings'
import { sfx, unlockAudio } from '../core/sound'
import { speak } from '../core/speak'
import { ACCESSORIES, ART_SIZE } from '../ui/accessories'
import type { AccessoryId } from '../ui/accessories'
import { PaddleIcon } from '../ui/PaddleIcon'
import type { DesignId, PaddleShape } from '../ui/paddleArt'
import { HawkCut } from '../ui/hawkArt'
import './setup.css'
import './collection.css'

const TABS: { kind: ItemKind; label: string }[] = [
  { kind: 'wear', label: 'ピクルくん' },
  { kind: 'design', label: 'パドルの いろ' },
  { kind: 'shape', label: 'パドルの かたち' },
]

export function Collection() {
  const progress = useProgress()
  const settings = useSettings()
  const [tab, setTab] = useState<ItemKind>('wear')
  const [ask, setAsk] = useState<Item | null>(null)
  const mine = settings.paddles[0]

  const isOn = (item: Item) => {
    if (item.kind === 'wear') return progress.wear[ACCESSORIES[item.key as AccessoryId].slot] === item.key
    if (item.kind === 'design') return mine.design === item.key
    return mine.shape === item.key
  }

  const use = (item: Item) => {
    sfx.tick()
    if (item.kind === 'wear') toggleWear(item.key as AccessoryId)
    else if (item.kind === 'design') setSettings({ paddles: [{ ...mine, design: item.key as DesignId }, settings.paddles[1]] })
    else setSettings({ paddles: [{ ...mine, shape: item.key as PaddleShape }, settings.paddles[1]] })
  }

  const tapItem = (item: Item) => {
    unlockAudio()
    speak(item.label)
    if (owns(item.id, progress)) use(item)
    else if (!item.special) setAsk(item)
    else sfx.bounce()
  }

  const trade = (item: Item) => {
    const r = buy(item.id)
    setAsk(null)
    if (r === 'ok') {
      sfx.fanfare()
      use(item)
    } else sfx.ng()
  }

  const items = ITEMS.filter((i) => i.kind === tab)

  return (
    <main className="collection">
      <header className="col-head">
        <a className="btn btn-small" href="#/" aria-label="もどる">
          ←
        </a>
        <h1 className="col-title">きせかえ</h1>
        <span className="star-pill" aria-label={`ほし ${progress.stars}こ`} data-testid="stars">
          ⭐ {progress.stars}
        </span>
      </header>

      <section className="col-preview" aria-label="いまの すがた">
        <HawkCut art="full" height={170} />
        <div className="col-preview-paddle">
          <PaddleIcon look={mine} size={96} />
          <span>じぶんの パドル</span>
        </div>
      </section>

      <div className="seg col-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.kind} role="tab" aria-selected={tab === t.kind} aria-checked={tab === t.kind} onClick={() => setTab(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>

      <ul className="col-grid">
        {items.map((item) => {
          const have = owns(item.id, progress)
          const on = have && isOn(item)
          const ready = !have && !item.special && progress.stars >= item.price
          return (
            <li key={item.id}>
              <button
                className="col-item"
                data-have={have || undefined}
                data-on={on || undefined}
                data-ready={ready || undefined}
                data-testid={`item-${item.id}`}
                onClick={() => tapItem(item)}
              >
                <ItemArt item={item} mine={mine} />
                <span className="col-label">{item.label}</span>
                <span className="col-status">
                  {have ? (on ? (item.kind === 'wear' ? 'つけてる ✓' : 'つかってる ✓') : item.kind === 'wear' ? 'つける' : 'つかう') : item.special ? `🔒 ${SPECIAL_TEXT[item.special]}` : `⭐ ${item.price}`}
                </span>
                {!have && item.special && specialMet(item.special, progress) && <span className="col-status">もうすぐ！</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {tab === 'shape' && (
        <p className="col-note">
          パドルの かたちは、ほんものの ルールの おおきさ（ながさ＋はばが 61cm まで・ながさは 43cm まで）に あわせているよ。どの かたちでも、ゲームの つよさは おなじ。
        </p>
      )}
      {tab !== 'shape' && <p className="col-note">ほしは、きょうの ミッションを クリアすると もらえるよ。ゲームの つよさは かわらないよ。</p>}

      {ask && (
        <div className="col-ask-backdrop" onClick={() => setAsk(null)}>
          <div className="col-ask" role="dialog" aria-label="こうかん" onClick={(e) => e.stopPropagation()}>
            <ItemArt item={ask} mine={mine} big />
            <p className="col-ask-text">
              ⭐{ask.price} と「{ask.label}」を こうかんする？
            </p>
            {progress.stars < ask.price ? (
              <p className="col-ask-short">ほしが あと {ask.price - progress.stars}こ たりないよ</p>
            ) : (
              <button className="btn btn-go" onClick={() => trade(ask)} data-testid="trade">
                こうかんする！
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => setAsk(null)}>
              やめる
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function ItemArt({ item, mine, big = false }: { item: Item; mine: { design: DesignId; shape: PaddleShape }; big?: boolean }) {
  if (item.kind === 'wear') {
    const id = item.key as AccessoryId
    const art = 'ok'
    const h = big ? 120 : 76
    return (
      <span className="col-art" style={{ width: (h * ART_SIZE[art][0]) / ART_SIZE[art][1] }}>
        <HawkCut art={art} height={h} wear={{ [ACCESSORIES[id].slot]: id }} />
      </span>
    )
  }
  const look = item.kind === 'design' ? { design: item.key as DesignId, shape: mine.shape } : { design: mine.design, shape: item.key as PaddleShape }
  return <PaddleIcon look={look} size={big ? 120 : 72} />
}
