/** ゲームの画面の外枠：舞台・画面を消さない・一時停止・さいしょから・記録（ミッション）・きねんカード */
import { useEffect, useMemo, useRef, useState } from 'react'
import { countFinish, countGame } from '../core/counter'
import { __setPlayed, breakDue, oneMore, tookBreak } from '../core/playtime'
import { MEDAL_RULES, pikuruValue } from '../core/records'
import type { Level } from '../core/players'
import { getProgress, recordPlay, recordStart } from '../core/progress'
import type { Reward } from '../core/progress'
import { useSettings } from '../core/settings'
import { stopSpeaking } from '../core/speak'
import { Stage } from '../core/Stage'
import { usePlayClock } from '../core/usePlayClock'
import { useWakeLock } from '../core/wakelock'
import { AirGame } from '../games/air/AirGame'
import { BreakoutGame } from '../games/breakout/BreakoutGame'
import { CatchGame } from '../games/catch/CatchGame'
import { HayaTouch } from '../games/hayatouch/HayaTouch'
import { JumpGame } from '../games/jump/JumpGame'
import { LiftGame } from '../games/lift/LiftGame'
import { Quiz } from '../games/quiz/Quiz'
import { RallyGame } from '../games/rally/RallyGame'
import { SagasuDuel } from '../games/sagasu/SagasuDuel'
import { SagasuGame } from '../games/sagasu/SagasuGame'
import { TugGame } from '../games/tug/TugGame'
import { CurlingGame } from '../games/curling/CurlingGame'
import { LineStopGame } from '../games/linestop/LineStopGame'
import { ReactionGame } from '../games/reaction/ReactionGame'
import { ServeReadGame } from '../games/serveread/ServeReadGame'
import { Stop10Game } from '../games/stop10/Stop10Game'
import { BreakSheet } from '../ui/BreakSheet'
import { GameMenu } from '../ui/GameUI'
import { HowToSheet } from '../ui/HowToSheet'
import { ShareSheet } from '../ui/ShareSheet'
import type { CardData } from '../ui/shareCard'
import { gameById } from './games'
import type { GameId } from './games'
import { PlayContext } from './playContext'
import type { GameResult, PlayContextValue, ShareRequest } from './playContext'

export interface GameProps {
  levels: [Level, Level]
  paused: boolean
  onRestart: () => void
}

// 開発中だけ：遊んだ時間を入れかえる（「きゅうけい しよう」の確かめに使う）
if (import.meta.env.DEV) (window as unknown as { __setPlayed?: (s: number) => void }).__setPlayed = __setPlayed

/** 手に持って遊ぶゲーム（画面を回さない） */
export const HANDHELD: GameId[] = ['jump', 'breakout', 'lift', 'catch', 'reaction', 'stop10', 'sagasu']

/** ゲームの中身だけ（じゅんばんモードからも使う） */
export function GameView({ game, round, props }: { game: GameId; round: number; props: GameProps }) {
  const settings = useSettings()
  return (
    <>
      {game === 'rally' && <RallyGame key={round} kind="versus" mode={settings.rallyRules} target={settings.rallyTarget} scoring={settings.rallyScoring} {...props} />}
      {game === 'dink' && <RallyGame key={round} kind="dink" mode="easy" target={0} {...props} />}
      {game === 'hayatouch' && <HayaTouch key={round} {...props} />}
      {game === 'quiz' && <Quiz key={round} {...props} />}
      {game === 'breakout2' && <BreakoutGame key={round} two {...props} />}
      {game === 'tug' && <TugGame key={round} {...props} />}
      {game === 'air' && <AirGame key={round} {...props} />}
      {game === 'breakout' && <BreakoutGame key={round} two={false} {...props} />}
      {game === 'jump' && <JumpGame key={round} {...props} />}
      {game === 'lift' && <LiftGame key={round} {...props} />}
      {game === 'catch' && <CatchGame key={round} {...props} />}
      {game === 'target' && <RallyGame key={round} kind="target" mode="easy" target={0} {...props} />}
      {game === 'linestop' && <LineStopGame key={round} {...props} />}
      {game === 'curling' && <CurlingGame key={round} {...props} />}
      {game === 'serveread' && <ServeReadGame key={round} {...props} />}
      {game === 'reaction' && <ReactionGame key={round} {...props} />}
      {game === 'stop10' && <Stop10Game key={round} {...props} />}
      {game === 'sagasu' && <SagasuGame key={round} {...props} />}
      {game === 'sagasu2' && <SagasuDuel key={round} {...props} />}
      {game === 'pikuru' && (
        <RallyGame key={round} kind="versus" cpu mode={settings.rallyRules} target={settings.rallyTarget} scoring={settings.rallyScoring} {...props} />
      )}
    </>
  )
}

export function Play({ game }: { game: GameId }) {
  useWakeLock()
  const settings = useSettings()
  const info = gameById(game)
  const [menu, setMenu] = useState(false)
  const [help, setHelp] = useState(false)
  const [round, setRound] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [share, setShare] = useState<ShareRequest | null>(null)
  /** つづけて遊んだので「きゅうけい しよう」を出している */
  const [rest, setRest] = useState(false)
  /** さいごの記録（きねんカードで「この きろくに ちょうせん」を そえるか） */
  const [lastValue, setLastValue] = useState<number | undefined>(undefined)
  const solo = info?.players === 1
  // レベルはゲームの途中で変わらないように、始めたときの値で固定する（ひとりのときは自分とピクルくんが同じレベル）
  const [levels] = useState<[Level, Level]>(() => (solo ? [settings.soloLevel, settings.soloLevel] : [settings.levels[0], settings.levels[1]]))
  // よみあい サーブの「てわたし」は手に持つ1画面（回さない）。始めたときの設定で固定
  const [handheld] = useState(() => HANDHELD.includes(game) || (game === 'serveread' && settings.srStyle === 'pass'))

  // はじめた回数とスタンプ（StrictMode で2回呼ばれても1回だけ数える）
  const started = useRef(-1)
  useEffect(() => {
    if (started.current === round) return
    started.current = round
    recordStart(game)
    countGame(game)
  }, [game, round])

  const restart = () => {
    stopSpeaking()
    setMenu(false)
    setRewards([])
    setShare(null)
    setLastValue(undefined)
    setRound((r) => r + 1)
  }
  const paused = menu || help || !!share || rest
  const props: GameProps = { levels, paused, onRestart: restart }

  // 遊んだ時間をはかる（一時停止中・画面を見ていないときは数えない）
  usePlayClock(paused)
  const openHelp = () => {
    stopSpeaking()
    setMenu(false)
    setHelp(true)
  }

  const ctx = useMemo<PlayContextValue>(
    () => ({
      game,
      paddles: settings.paddles,
      rewards,
      finish: (r: GameResult) => {
        // ピクルくんと ラリー：かったときの レベルを記録にする（メダルの目安）
        const value = game === 'pikuru' ? (r.winner === 0 ? pikuruValue(levels[0]) : undefined) : r.value
        // じこベスト・メダルに数えるのは、ひとりで遊んだときと、ふたりで協力する ディンク
        const record = (solo || game === 'dink') && !!MEDAL_RULES[game]
        setRewards(recordPlay({ type: 'finish', game, value, two: !solo, record }))
        setLastValue(value)
        countFinish(game)
        if (breakDue()) setRest(true)
      },
      share: setShare,
    }),
    [game, settings.paddles, rewards, solo, levels],
  )

  const card: CardData | null = share
    ? {
        game,
        challenge: solo && lastValue !== undefined && game !== 'pikuru',
        gameTitle: info?.title ?? '',
        title: share.title,
        sub: share.sub,
        face: share.face,
        wear: getProgress().wear,
        look: settings.paddles[share.side],
      }
    : null

  return (
    <PlayContext.Provider value={ctx}>
      <Stage rotate={!handheld}>
        <GameView game={game} round={round} props={props} />
        <GameMenu open={menu} onOpen={() => setMenu(true)} onClose={() => setMenu(false)} onRestart={restart} onHelp={openHelp} corner={handheld} />
        {help && <HowToSheet game={game} onClose={() => setHelp(false)} canFlip={!solo} />}
        {card && share && <ShareSheet card={card} flipped={share.side === 1} onClose={() => setShare(null)} />}
        {rest && (
          <BreakSheet
            single={handheld}
            onRest={tookBreak}
            onMore={() => {
              oneMore()
              setRest(false)
            }}
          />
        )}
      </Stage>
    </PlayContext.Provider>
  )
}
