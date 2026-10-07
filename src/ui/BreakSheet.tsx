/**
 * つづけて遊んだときの「ちょっと きゅうけい しよう」。ゲームの途中では出さず、結果が出たときに出す。
 * ふたりで向かい合うゲームでは、上と下の両方の向きに出す。
 */
import { Both } from '../core/Stage'
import { PHRASES } from '../core/voiceLines'
import { speak } from '../core/speak'
import { HawkCut } from './hawkArt'
import { useEffect } from 'react'

function Body({ onRest, onMore, small = false }: { onRest: () => void; onMore: () => void; small?: boolean }) {
  return (
    <div className="break-card" role="dialog" aria-label="きゅうけい" data-testid="break-sheet">
      <HawkCut art="ok" height={small ? 64 : 96} />
      <p className="break-title">たくさん あそんだね！</p>
      <p className="break-sub">ちょっと きゅうけい しよう。とおくを みて、めを やすめよう。おみずも のもうね。</p>
      <div className="break-actions">
        <a className="btn btn-go" href="#/" onClick={onRest}>
          きゅうけい する
        </a>
        <button className="btn btn-quiet" onClick={onMore}>
          あと 1かい だけ
        </button>
      </div>
    </div>
  )
}

export function BreakSheet({ single, onRest, onMore }: { single: boolean; onRest: () => void; onMore: () => void }) {
  useEffect(() => {
    speak(PHRASES.rest)
  }, [])
  return (
    <div className="break-backdrop">
      {single ? (
        <div className="break-single">
          <Body onRest={onRest} onMore={onMore} />
        </div>
      ) : (
        <Both interactive>{() => <Body onRest={onRest} onMore={onMore} small />}</Both>
      )}
    </div>
  )
}
