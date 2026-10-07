/** ゲーム画面で共通に使う部品（知らせ・点数・結果・メニュー） */
import type { ReactNode } from 'react'
import type { Reward } from '../core/progress'
import { MEDAL_MARK, MEDAL_NAME } from '../core/records'
import { gameById } from '../shell/games'
import { Both, Half } from '../core/Stage'
import type { Side } from '../core/players'
import { usePlay } from '../shell/playContext'
import type { Face } from './Hawk'
import { HawkCut } from './hawkArt'

export interface NoticeData {
  title: string
  sub?: string
  face?: Face
  /** 下の人・上の人で表情を変えるとき（得点した側は喜ぶ、とられた側はドンマイ） */
  faces?: [Face | undefined, Face | undefined]
  /** 片方にだけ出すとき */
  only?: Side
  /** 数字（カウントダウン）を大きく出す */
  big?: boolean
}

/** 知らせを上下両方の向きに出す（only を指定すると片方だけ。single＝手に持つ画面で1つだけ） */
export function Notice({ data, single = false }: { data: NoticeData | null; single?: boolean }) {
  if (!data) return null
  const body = (side: Side) => {
    const face = data.faces?.[side] ?? data.face
    return (
      <div className="notice">
        {data.big ? (
          <div className="notice-big">{data.title}</div>
        ) : (
          <div className="notice-card">
            {face && <HawkCut art={face} height={72} />}
            <div>
              <div className="notice-title">{data.title}</div>
              {data.sub && <div className="notice-sub">{data.sub}</div>}
            </div>
          </div>
        )}
      </div>
    )
  }
  if (single) return body(0)
  if (data.only !== undefined) {
    return (
      <Half side={data.only} interactive={false}>
        {body(data.only)}
      </Half>
    )
  }
  return <Both>{body}</Both>
}

export function Scores({ score }: { score: [number, number] }) {
  return (
    <Both>
      {(side) => (
        <div className="score-pill" data-side={side} aria-label={`${side === 0 ? 'オレンジ' : 'あお'} ${score[side]}てん`}>
          {score[side]}
        </div>
      )}
    </Both>
  )
}

/** ごほうびの知らせの文 */
export function rewardText(r: Reward): string {
  switch (r.type) {
    case 'mission':
      return `⭐+${r.stars} ミッション クリア！`
    case 'bonus':
      return `⭐+${r.stars} きょうの ミッション ぜんぶ クリア！`
    case 'item':
      return `🎁 「${r.item.label}」を もらった！`
    case 'welcome':
      return `🎁 はじめての プレゼント ⭐${r.stars}`
    case 'medal':
      return `${MEDAL_MARK[r.medal]} ${gameById(r.game)?.title ?? ''}で ${MEDAL_NAME[r.medal]}メダル！ ⭐+${r.stars}`
  }
}

export function RewardList({ rewards }: { rewards: Reward[] }) {
  if (!rewards.length) return null
  return (
    <ul className="rewards" data-testid="rewards">
      {rewards.map((r, i) => (
        <li key={i}>{rewardText(r)}</li>
      ))}
    </ul>
  )
}

/** 終わりの画面。勝った人・負けた人それぞれの向きに出す。もらった ごほうびと、きねんカードのボタンもここに出す */
export function Result({
  title,
  sub,
  face,
  onAgain,
  extra,
  single = false,
}: {
  title: (side: Side) => string
  sub?: (side: Side) => string
  face: (side: Side) => Face
  onAgain: () => void
  extra?: ReactNode
  /** ひとりで遊ぶとき：画面いっぱいに1つだけ（向きを回さない） */
  single?: boolean
}) {
  const play = usePlay()
  const card = (side: Side) =>
    play.share && (
      <button
        className="btn result-share"
        aria-label="きねんカード（おうちの人と いっしょに）"
        data-testid="share-btn"
        onClick={() => play.share?.({ side, title: title(side), sub: sub?.(side), face: face(side) })}
      >
        📸
      </button>
    )
  if (single) {
    return (
      <div className="result result-single">
        <HawkCut art={face(0)} height={150} />
        <div className="result-title">{title(0)}</div>
        {sub && <div className="result-sub">{sub(0)}</div>}
        {extra}
        <RewardList rewards={play.rewards} />
        <div className="result-actions">
          <button className="btn btn-go" onClick={onAgain}>
            もういちど
          </button>
          <a className="btn" href="#/">
            おわる
          </a>
          {card(0)}
        </div>
      </div>
    )
  }
  return (
    <Both interactive>
      {(side) => (
        <div className="result">
          <HawkCut art={face(side)} height={play.rewards.length || extra ? 72 : 120} />
          <div className="result-title">{title(side)}</div>
          {sub && <div className="result-sub">{sub(side)}</div>}
          {extra}
          <RewardList rewards={play.rewards} />
          <div className="result-actions">
            <button className="btn btn-go" onClick={onAgain}>
              もういちど
            </button>
            <a className="btn" href="#/">
              おわる
            </a>
            {card(side)}
          </div>
        </div>
      )}
    </Both>
  )
}

/** まんなかの小さなボタンから開くメニュー（一時停止） */
export function GameMenu({
  open,
  onOpen,
  onClose,
  onRestart,
  onHelp,
  corner = false,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** 無いときは「さいしょから」を出さない（じゅんばんモード） */
  onRestart?: () => void
  /** 「あそびかた・ルール」を開く（ゲームは止まる） */
  onHelp: () => void
  /** 手に持って遊ぶゲーム：まんなかではなく右上に置く（流れてくる物と重ならないように） */
  corner?: boolean
}) {
  return (
    <>
      <div className={`game-buttons ${corner ? 'game-buttons-corner' : ''}`}>
        <button className="mid-btn mid-btn-help" onClick={onHelp} aria-label="あそびかた・ルール（いちじていし）" data-testid="help-btn">
          ？
        </button>
        <button className="mid-btn" onClick={onOpen} aria-label="メニュー（いちじていし）">
          ⏸
        </button>
      </div>
      {open && (
        <div className="menu-backdrop" onClick={onClose}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-go" onClick={onClose}>
              つづける
            </button>
            <button className="btn" onClick={onHelp}>
              ？ あそびかた・ルール
            </button>
            {onRestart && (
              <button className="btn" onClick={onRestart}>
                さいしょから
              </button>
            )}
            <a className="btn" href="#/">
              ホームへ
            </a>
          </div>
        </div>
      )}
    </>
  )
}
