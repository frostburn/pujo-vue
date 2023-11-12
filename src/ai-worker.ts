import {
  DEFAULT_JIGGLE_FRAMES,
  SimpleGame,
  SimplePuyoScreen,
  flexDropletStrategy1,
  flexDropletStrategy2,
  flexDropletStrategy3,
  randomStrategy
} from 'pujo-puyo-core'

const LOG = false

type StrategyName = 'random' | 'flex1' | 'flex2' | 'flex3'

const STRATEGIES = {
  random: randomStrategy,
  flex1: flexDropletStrategy1,
  flex2: flexDropletStrategy2,
  flex3: flexDropletStrategy3
}

const THINKING = {
  random: { totalFrames: 1e-6, samples: 1 },
  flex1: { totalFrames: 1, samples: 1 },
  flex2: { totalFrames: 3, samples: 1 },
  flex3: { totalFrames: 45, samples: 1 }
}

// Milliseconds per frame
const FRAME_RATE = 30 / 1000

const FALL_FRAMES = 10

onmessage = (e) => {
  const name: StrategyName = e.data.name
  const thinking = THINKING[name]
  const gameData = e.data.game

  // Revive the class instance.
  const screen = new SimplePuyoScreen(gameData.screen.jkiss.state, gameData.screen.rules)
  screen.grid = gameData.screen.grid
  screen.bufferedGarbage = gameData.screen.bufferedGarbage
  const moveTime: number =
    Math.max(0, thinking.totalFrames / thinking.samples - e.data.anticipation) +
    (e.data.hardDrop ? 1 : FALL_FRAMES) +
    DEFAULT_JIGGLE_FRAMES +
    e.data.throttleFrames
  const game = new SimpleGame(
    screen,
    gameData.targetPoints,
    gameData.pointResidue,
    gameData.allClearBonus,
    gameData.pendingGarbage,
    gameData.lateGarbage,
    gameData.lateTimeRemaining,
    gameData.colorSelection,
    gameData.bag,
    gameData.rules,
    moveTime
  )
  const start = performance.now()
  const strategy = STRATEGIES[name](game)
  const took = performance.now() - start
  thinking.totalFrames += took * FRAME_RATE
  thinking.samples++

  const thinkingFrames = thinking.totalFrames / thinking.samples

  if (LOG) {
    console.log(
      'Estimated CPU thinking time of',
      name,
      thinkingFrames / FRAME_RATE,
      'ms → moveTime =',
      moveTime,
      'frames'
    )
    console.log('Heuristic score =', strategy.score)
  }

  postMessage({ strategy, thinkingFrames })
}
