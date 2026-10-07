/**
 * 開発用：説明動画「ホーム画面に入れる方法」の1コマ（1080×1920）。#/dev/guide（本番には入らない）
 * scripts/build-guide-video.mjs が window.__guide(場面, 秒, 長さ) で時刻を決めて1コマずつ撮る。
 * 動きは CSS のアニメーションを止めて、時刻から計算する（撮るたびに同じ絵になるように）。
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AddHomeArt, ChromeMenuArt, ChromeScreen, HomeScreenArt, InAppMenu, InAppScreen, InstallDialogArt, Phone, SafariScreen, ShareSheetArt } from '../ui/installArt'
import { HawkCut } from '../ui/hawkArt'
import { GUIDE_SCENES } from './guideScenes'
import type { GuideScene } from './guideScenes'
import './devguide.css'

interface At {
  i: number
  t: number
  d: number
}

/** 場面の中の画面の移りかわり（p＝0〜1） */
function art(id: GuideScene['id'], p: number, d: number): { el: ReactNode; since: number } | null {
  const stage = (cuts: number[]) => {
    let k = 0
    while (k + 1 < cuts.length && p >= cuts[k + 1]) k++
    return { k, since: (p - cuts[k]) * d }
  }
  switch (id) {
    case 'inapp':
      return { el: <InAppScreen hi={p > 0.6 ? 'more' : null} />, since: 9 }
    case 'open': {
      const s = stage([0, 0.45])
      return s.k === 0 ? { el: <InAppScreen hi="more" tap={p > 0.18} />, since: 9 } : { el: <InAppMenu hi="menu" tap={p > 0.68} />, since: s.since }
    }
    case 'ios': {
      const s = stage([0, 0.34, 0.67])
      if (s.k === 0) return { el: <SafariScreen hi="share" tap={p > 0.12} />, since: 9 }
      if (s.k === 1) return { el: <ShareSheetArt hi="addHome" tap={p > 0.47} />, since: s.since }
      return { el: <AddHomeArt hi="add" tap={p > 0.8} />, since: 9 }
    }
    case 'android': {
      const s = stage([0, 0.34, 0.67])
      if (s.k === 0) return { el: <ChromeScreen hi="cmore" tap={p > 0.12} />, since: 9 }
      if (s.k === 1) return { el: <ChromeMenuArt hi="cmenu" tap={p > 0.47} />, since: s.since }
      return { el: <InstallDialogArt hi="install" tap={p > 0.8} />, since: s.since }
    }
    case 'home':
      return { el: <HomeScreenArt hi={p > 0.25 ? 'icon' : null} tap={p > 0.45} />, since: 9 }
    case 'copy':
      return { el: <InAppMenu hi="menu" item="copy" tap={p > 0.4} />, since: 9 }
    default:
      return null
  }
}

export default function DevGuide() {
  const [at, setAt] = useState<At>(() => {
    // 手で確かめるとき：#/dev/guide?…ではなく、window.__guide を呼ぶ。最初は1つ目の場面のまんなか
    return { i: 0, t: 2, d: 4 }
  })

  useEffect(() => {
    const w = window as unknown as { __guide?: (i: number, t: number, d: number) => Promise<boolean> }
    w.__guide = (i, t, d) =>
      new Promise((res) => {
        setAt({ i, t, d })
        requestAnimationFrame(() => requestAnimationFrame(() => res(true)))
      })
    document.body.style.margin = '0'
  }, [])

  const sc = GUIDE_SCENES[at.i]
  const p = Math.max(0, Math.min(1, at.t / at.d))
  const a = art(sc.id, p, at.d)
  const tapPhase = (at.t % 0.9) / 0.9
  const up = a ? Math.min(1, a.since / 0.3) : 1
  const style = {
    '--tap-s': 0.4 + tapPhase,
    '--tap-o': 1 - tapPhase,
    '--hi-o': 0.55 + 0.45 * Math.abs(Math.sin(at.t * 3.2)),
    '--up': up,
    opacity: Math.min(1, at.t / 0.3),
  } as CSSProperties

  const end = sc.id === 'intro' || sc.id === 'outro'
  return (
    <div className="guide" data-scene={sc.id}>
      <div className="guide-in" style={style}>
        {end ? (
          <div className="guide-end">
            <h1 className="guide-title guide-title-big">{sc.title}</h1>
            <HawkCut art={sc.id === 'intro' ? 'full' : 'ok'} height={sc.id === 'intro' ? 760 : 620} />
            {sc.sub && <p className="guide-sub guide-sub-big">{sc.sub}</p>}
          </div>
        ) : (
          <>
            <div className="guide-top">
              {sc.chip && <span className="guide-chip">{sc.chip}</span>}
              <h1 className="guide-title">{sc.title}</h1>
              {sc.sub && <p className="guide-sub">{sc.sub}</p>}
            </div>
            {a && (
              <div className="guide-phone">
                <Phone width={560}>{a.el}</Phone>
              </div>
            )}
            <div className="guide-pikuru">
              <HawkCut art={sc.id === 'inapp' ? 'eh' : sc.id === 'home' ? 'ok' : 'think'} height={300} />
            </div>
            {sc.id !== 'home' && <p className="guide-note">※ 表示は アプリ・OS の版で 少しちがいます</p>}
          </>
        )}
        <p className="guide-brand">ピクルくんとあそぼ</p>
      </div>
    </div>
  )
}
