/**
 * きねんカードの共有。子どもだけで SNS に のせないように、最初に おうちの人の確認（ParentGate）を出す。
 * 共有は端末の「共有」画面（Web Share）を使う。どこにも自動では送らない（のせるかどうか・どこに のせるかは おうちの人が決める）。
 *
 * 画像の保存は端末で やり方を変える：
 * - iPhone・iPad：「写真に保存」→ 共有の画面の「画像を保存」（ダウンロードだと「写真」ではなく「ファイル」に入り、
 *   ホーム画面から開いたときは画像だけの画面になって戻れないことがある）
 * - Android・パソコン：ダウンロード（「ダウンロード」フォルダに入る）
 * - インスタなどアプリの中のブラウザ：ダウンロードできないので、画像の長押しか、Safari・Chrome で開きなおす案内
 */
import { useEffect, useState } from 'react'
import { inAppName, osOf } from '../core/browser'
import { countShare } from '../core/counter'
import { makeCard, shareText } from './shareCard'
import type { CardData } from './shareCard'
import { ParentGate } from './ParentGate'
import './share.css'

type Step = 'gate' | 'making' | 'ready' | 'error'

export function ShareSheet({ card, onClose, flipped = false, fixed = false }: { card: CardData; onClose: () => void; flipped?: boolean; fixed?: boolean }) {
  const [step, setStep] = useState<Step>('gate')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [os] = useState(() => osOf())
  const [inApp] = useState(() => inAppName())

  useEffect(() => {
    if (step !== 'making') return
    let alive = true
    makeCard(card)
      .then((b) => {
        if (!alive) return
        setBlob(b)
        setUrl(URL.createObjectURL(b))
        setStep('ready')
      })
      .catch(() => alive && setStep('error'))
    return () => {
      alive = false
    }
  }, [step, card])

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const file = blob ? new File([blob], 'softtennis-asobi.png', { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  /** iPhone・iPad は 共有の画面から「画像を保存」（写真に入る） */
  const saveByShare = os === 'ios' && canShare
  /** ダウンロードで保存できる（Android・パソコンの ふつうのブラウザ） */
  const saveByDownload = !saveByShare && !inApp && os !== 'ios'

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: shareText(card) })
      countShare(card.game ?? '')
    } catch {
      // とじただけのときも ここに来る
    }
  }

  const saveToPhotos = async () => {
    if (!file) return
    try {
      // 文をつけると「画像を保存」が出ないことがあるので、画像だけを渡す
      await navigator.share({ files: [file] })
      countShare(card.game ?? '')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setNote('うまく いかないときは、画像を長押しして「"写真"に保存」を選んでください。')
    }
  }

  const hint = saveByShare
    ? '「写真に保存」を押して、出てきたメニューの「画像を保存」を選んでください。'
    : saveByDownload
      ? '保存した画像は「ダウンロード」に入ります。保存できないときは、画像を長押ししてください。'
      : inApp
        ? `${inApp} の中では保存できないことがあります。画像を長押しして保存するか、Safari・Chrome で開きなおしてください。`
        : '画像を長押しして「"写真"に保存」を選んでください。'

  return (
    <div className={`share-backdrop ${fixed ? 'share-backdrop-fixed' : ''}`} onClick={onClose}>
      <div className="share-sheet" data-flipped={flipped || undefined} onClick={(e) => e.stopPropagation()} data-testid="share-sheet">
        {step === 'gate' && <ParentGate onPass={() => setStep('making')} onCancel={onClose} />}
        {step === 'making' && <p className="share-wait">カードを つくっています…</p>}
        {step === 'error' && <p className="share-wait">カードを つくれませんでした。</p>}
        {step === 'ready' && url && (
          <>
            <h2 className="share-title">きねんカード</h2>
            <img className="share-img" src={url} alt={`${card.gameTitle} ${card.title}`} />
            <p className="share-note">名前や顔写真は入っていません。共有先は保護者の方が選んでください。</p>
            <div className="share-actions">
              {canShare && (
                <button className="btn btn-go" onClick={share}>
                  シェアする
                </button>
              )}
              {saveByShare && (
                <button className="btn" onClick={saveToPhotos} data-testid="share-save">
                  写真に保存
                </button>
              )}
              {saveByDownload && (
                <a className="btn" href={url} download="softtennis-asobi.png" onClick={() => countShare(card.game ?? '')} data-testid="share-save">
                  画像を保存
                </a>
              )}
              {inApp && (
                <a className="btn" href="#/install" onClick={onClose}>
                  Safari・Chrome で ひらく
                </a>
              )}
            </div>
            <p className="share-note share-hint" data-testid="share-hint">
              {note || hint}
            </p>
          </>
        )}
        {step !== 'gate' && (
          <button className="btn btn-quiet" onClick={onClose}>
            とじる
          </button>
        )}
      </div>
    </div>
  )
}
