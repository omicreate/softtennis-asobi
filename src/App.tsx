import { lazy, Suspense, useEffect } from 'react'
import { stopSpeaking } from './core/speak'
import { IshinGame } from './games/ishin/IshinGame'
import { NiseGame } from './games/nise/NiseGame'
import { Collection } from './shell/Collection'
import { gameById } from './shell/games'
import { Home } from './shell/Home'
import { Install } from './shell/Install'
import { Parents } from './shell/Parents'
import { Party } from './shell/party/Party'
import { Play } from './shell/Play'
import { Records } from './shell/Records'
import { useRoute } from './shell/route'
import { Setup } from './shell/Setup'
import { SoloSetup } from './shell/SoloSetup'

// 開発用の確認ページ（本番のビルドには入らない）
const DevWear = import.meta.env.DEV ? lazy(() => import('./shell/DevWear')) : null
const DevGuide = import.meta.env.DEV ? lazy(() => import('./shell/DevGuide')) : null

export default function App() {
  const [page, id] = useRoute()
  const game = gameById(id)

  // 画面が変わったら読み上げを止める
  useEffect(() => stopSpeaking, [page, id])

  // みんなで遊ぶゲームは、準備から結果まで1つの画面
  if ((page === 'setup' || page === 'play') && game?.id === 'nise') return <NiseGame />
  if ((page === 'setup' || page === 'play') && game?.id === 'ishin') return <IshinGame />
  if (page === 'setup' && game) return game.players === 1 ? <SoloSetup key={game.id} game={game} /> : <Setup key={game.id} game={game} />
  if (page === 'play' && game) return <Play key={game.id} game={game.id} />
  if (page === 'collection') return <Collection />
  if (page === 'records') return <Records />
  if (page === 'parents') return <Parents />
  if (page === 'install') return <Install />
  if (page === 'party') return <Party key={id ?? ''} fixed={game?.party ? game.id : undefined} />
  if (DevGuide && page === 'dev' && id === 'guide')
    return (
      <Suspense>
        <DevGuide />
      </Suspense>
    )
  if (DevWear && page === 'dev')
    return (
      <Suspense>
        <DevWear />
      </Suspense>
    )
  return <Home />
}
