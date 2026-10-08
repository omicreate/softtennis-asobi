/**
 * 「ホーム画面に入れる方法」の図（スマホの画面を簡単にかいたもの）。案内のページと、説明の動画（開発用の画面）で使う。
 * 本物のアプリのロゴや画面は使わず、ボタンの場所と名前だけを かく。表示は アプリ・OS の版で少しちがう。
 * hi＝光らせる所、tap＝タップの波紋を出す
 */
import type { ReactNode } from 'react'
import { HawkCut } from './hawkArt'
import './install.css'

export type Hi = 'more' | 'menu' | 'share' | 'addHome' | 'add' | 'cmore' | 'cmenu' | 'install' | 'icon' | null

const BASE = import.meta.env.BASE_URL

function Spot({ on, tap, children, className = '' }: { on: boolean; tap?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`ia-spot ${on ? 'ia-hi' : ''} ${className}`}>
      {children}
      {on && tap && <i className="ia-tap" aria-hidden />}
    </span>
  )
}

/** スマホの枠 */
export function Phone({ children, width = 220, label }: { children: ReactNode; width?: number; label?: string }) {
  return (
    <figure className="ia-phone-wrap" style={{ width }}>
      <div className="ia-phone" style={{ fontSize: width / 22 }}>
        <div className="ia-notch" />
        <div className="ia-screen">{children}</div>
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}

/** アプリの画面（中身を簡単に） */
function AppPage() {
  return (
    <div className="ia-page">
      <HawkCut art="full" height={64} />
      <b>ホークアイ先生と あそぼ</b>
      <div className="ia-tiles">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    </div>
  )
}

/** インスタなどの中のブラウザ：上に ×・アドレス・「…」 */
export function InAppScreen({ hi, tap, os = 'ios' }: { hi?: Hi; tap?: boolean; os?: 'ios' | 'android' }) {
  return (
    <div className="ia-col">
      <div className="ia-bar ia-bar-inapp">
        <span className="ia-x">×</span>
        <span className="ia-url">
          <small>omicreate.github.io</small>
        </span>
        <Spot on={hi === 'more'} tap={tap}>
          <span className="ia-more">{os === 'ios' ? '…' : '⋮'}</span>
        </Spot>
      </div>
      <AppPage />
    </div>
  )
}

/** 「…」を押すと出るメニュー */
export function InAppMenu({ hi, tap, item = 'open' }: { hi?: Hi; tap?: boolean; item?: 'open' | 'copy' }) {
  return (
    <div className="ia-col">
      <div className="ia-bar ia-bar-inapp">
        <span className="ia-x">×</span>
        <span className="ia-url">
          <small>omicreate.github.io</small>
        </span>
        <span className="ia-more">…</span>
      </div>
      <div className="ia-dim">
        <AppPage />
      </div>
      <div className="ia-sheet">
        <Spot on={hi === 'menu' && item === 'open'} tap={tap} className="ia-row">
          外部ブラウザで開く
        </Spot>
        <Spot on={hi === 'menu' && item === 'copy'} tap={tap} className="ia-row">
          リンクをコピー
        </Spot>
        <span className="ia-row">共有</span>
      </div>
    </div>
  )
}

/** iPhone の Safari：下に 共有ボタン（□↑） */
export function SafariScreen({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col">
      <AppPage />
      <div className="ia-bar ia-bar-safari">
        <span>‹</span>
        <span>›</span>
        <Spot on={hi === 'share'} tap={tap}>
          <ShareIcon />
        </Spot>
        <span>▢</span>
        <span>⧉</span>
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg className="ia-share" viewBox="0 0 20 24" aria-label="共有">
      <path d="M6 9 H3 V22 H17 V9 H14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M10 15 V2 M5.5 6.5 L10 2 L14.5 6.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 共有のメニュー */
export function ShareSheetArt({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col">
      <div className="ia-dim">
        <AppPage />
      </div>
      <div className="ia-sheet">
        <span className="ia-row">コピー</span>
        <span className="ia-row">ブックマークを追加</span>
        <Spot on={hi === 'addHome'} tap={tap} className="ia-row">
          ホーム画面に追加 <b className="ia-plus">⊞</b>
        </Spot>
      </div>
    </div>
  )
}

/** ホーム画面に追加（右上の「追加」） */
export function AddHomeArt({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col ia-add">
      <div className="ia-bar ia-bar-add">
        <span className="ia-cancel">キャンセル</span>
        <b>ホーム画面に追加</b>
        <Spot on={hi === 'add'} tap={tap}>
          <span className="ia-add-btn">追加</span>
        </Spot>
      </div>
      <div className="ia-add-body">
        <img src={`${BASE}icon-192.png`} alt="" />
        <span className="ia-add-name">ホークアイあそぼ</span>
      </div>
    </div>
  )
}

/** Android の Chrome：右上の「⋮」 */
export function ChromeScreen({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col">
      <div className="ia-bar ia-bar-chrome">
        <span className="ia-url">
          <small>omicreate.github.io</small>
        </span>
        <Spot on={hi === 'cmore'} tap={tap}>
          <span className="ia-more">⋮</span>
        </Spot>
      </div>
      <AppPage />
    </div>
  )
}

/** Chrome のメニュー */
export function ChromeMenuArt({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col">
      <div className="ia-bar ia-bar-chrome">
        <span className="ia-url">
          <small>omicreate.github.io</small>
        </span>
        <span className="ia-more">⋮</span>
      </div>
      <div className="ia-dim">
        <AppPage />
      </div>
      <div className="ia-menu">
        <span className="ia-row">新しいタブ</span>
        <span className="ia-row">ブックマーク</span>
        <Spot on={hi === 'cmenu'} tap={tap} className="ia-row">
          ホーム画面に追加
          <small>（アプリをインストール）</small>
        </Spot>
      </div>
    </div>
  )
}

/** インストールの確認 */
export function InstallDialogArt({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-col">
      <div className="ia-dim">
        <AppPage />
      </div>
      <div className="ia-dialog">
        <b>アプリを インストール</b>
        <span className="ia-dialog-app">
          <img src={`${BASE}icon-192.png`} alt="" />
          ホークアイ先生とあそぼ
        </span>
        <span className="ia-dialog-btns">
          <span>キャンセル</span>
          <Spot on={hi === 'install'} tap={tap}>
            <span className="ia-install-btn">インストール</span>
          </Spot>
        </span>
      </div>
    </div>
  )
}

/** ホーム画面（ホークアイ先生の アイコン） */
export function HomeScreenArt({ hi, tap }: { hi?: Hi; tap?: boolean }) {
  return (
    <div className="ia-home">
      {Array.from({ length: 11 }, (_, i) => (
        <span key={i} className="ia-app">
          <i />
          <small />
        </span>
      ))}
      <Spot on={hi === 'icon'} tap={tap} className="ia-app ia-app-pk">
        <img src={`${BASE}icon-192.png`} alt="" />
        <small>ホークアイあそぼ</small>
      </Spot>
    </div>
  )
}
