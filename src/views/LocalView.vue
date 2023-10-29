<script setup lang="ts">
import { type Chain, DeckedGame } from '@/chain-deck'
import PlayingField from '@/components/PlayingField.vue'
import PlayingButton from '@/components/PlayingButton.vue'
import {
  MOVES,
  randomColorSelection,
  randomSeed,
  type GameState,
  type Replay,
  type StrategyResult,
  VISIBLE_HEIGHT,
  GHOST_Y,
  WIDTH,
  PASS,
  DEFAULT_TARGET_POINTS
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useAudioContextStore } from '@/stores/audio-context'
import { processTickSounds } from '@/soundFX'

// This import is broken in production mode
// import AIWorkerUrl from "../ai-worker.ts?url"
// Hack it together.
let AIWorkerUrl = 'ai-worker.js'
if (import.meta.env.DEV) {
  // The browser doesn't like the worker being a module so this doesn't work either
  // AIWorkerUrl = 'src/ai-worker.ts'
  AIWorkerUrl = 'dist/ai-worker.js'
}

// -- Constants --

// Frames per millisecond
const FRAME_RATE = 30 / 1000
const MS_PER_FRAME = 1 / FRAME_RATE
const MAX_WORKER_ANTICIPATION = 10
// Frames
const ONE_SECOND = 30

const DIFFICULTIES = [
  {
    label: 'Easy',
    botName: 'random',
    throttleFrames: ONE_SECOND * 4,
    hardDrop: false,
    anticipate: true
  },
  {
    label: 'Mid',
    botName: 'flex1',
    throttleFrames: ONE_SECOND * 2,
    hardDrop: false,
    anticipate: true
  },
  {
    label: 'Hard',
    botName: 'flex2',
    throttleFrames: 0,
    hardDrop: false,
    anticipate: true
  },
  {
    label: 'Brutal',
    botName: 'flex2',
    throttleFrames: 0,
    hardDrop: true,
    anticipate: true
  },
  {
    label: 'Smart',
    botName: 'flex3',
    throttleFrames: 0,
    hardDrop: true,
    anticipate: false // Needs the full bag so cannot jump ahead.
  } // We could cheat by true cloning, but where's the fun in that?
]

const audioContext = useAudioContextStore()

// -- State --

const worker = new Worker(AIWorkerUrl)
let waitingForWorker = false
let workerStrategy: StrategyResult | null = null

let workerAnticipation = 1

const difficultyIndex = ref(0)
const botActive = ref(true)
const difficulty = computed(() => DIFFICULTIES[difficultyIndex.value])
let workerThrottleRemaining = difficulty.value.throttleFrames

let lastAgeDrawn = -1
let gameSeed = randomSeed()
let colorSelection = randomColorSelection()
let colorSelections = [colorSelection, colorSelection]
let screenSeed = randomSeed()
const targetPoints = [DEFAULT_TARGET_POINTS, DEFAULT_TARGET_POINTS]
const marginFrames = Infinity
const mercyFrames = Infinity
let game = new DeckedGame(
  gameSeed,
  screenSeed,
  colorSelections,
  targetPoints,
  marginFrames,
  mercyFrames
)
const replay: Replay = {
  gameSeed,
  screenSeed,
  colorSelections,
  targetPoints,
  marginFrames,
  mercyFrames,
  moves: [],
  metadata: {
    event: 'Local Play vs. CPU',
    names: [localStorage.getItem('name') || 'Anonymous', `${difficulty.value.label} (CPU)`],
    elos: [],
    priorWins: [0, 0],
    site: 'https://pujo.lumipakkanen.com',
    round: 0,
    msSince1970: new Date().valueOf(),
    type: 'realtime'
  },
  result: {
    reason: 'ongoing'
  }
}
const gameOver = ref(false)
const wins = reactive([0, 0])

let workerGame = game.clone()
for (let i = 0; i < workerAnticipation; ++i) {
  workerGame.tick()
}

let userMove: { x1: number; y1: number; orientation: number; hardDrop: boolean } | null = null

let referenceTime: DOMHighResTimeStamp | null = null
let referenceAge = 0
let lastTickTime: DOMHighResTimeStamp
let tickId: number | null = null

// Drawing / graphics
const gameStates = ref<GameState[]>(game.state)
const chainCards = ref<Chain[][]>([[], []])
const fallMu = ref(0)

let frameId: number | null = null

const playingField = ref<typeof PlayingField | null>(null)

function tick() {
  const timeStamp = window.performance.now()
  if (referenceTime === null) {
    referenceTime = timeStamp
  }

  if (userMove && !game.games[0].busy) {
    const { x1, y1, orientation, hardDrop } = userMove
    const playedMove = game.play(0, x1, y1, orientation, hardDrop)
    lastAgeDrawn = -1
    replay.moves.push(playedMove)
    userMove = null

    workerGame = game.clone()
    for (let i = 0; i < workerAnticipation; ++i) {
      workerGame.tick()
    }
  }

  if (gameOver.value) {
    workerStrategy = null
  }

  if (workerStrategy && !game.games[1].busy) {
    if (workerStrategy.move !== PASS) {
      const { x1, y1, orientation } = MOVES[workerStrategy.move]
      const playedMove = game.play(1, x1, y1, orientation, difficulty.value.hardDrop)
      lastAgeDrawn = -1
      replay.moves.push(playedMove)

      workerGame = game.clone()
      for (let i = 0; i < workerAnticipation; ++i) {
        workerGame.tick()
      }
    }
    workerStrategy = null
  }

  const intendedAge = (timeStamp - referenceTime) * FRAME_RATE
  while (referenceAge < intendedAge) {
    const tickResults = game.tick()
    processTickSounds(audioContext, tickResults)

    if (!gameOver.value && tickResults.some((t) => t.lockedOut)) {
      if (tickResults[0].lockedOut) {
        if (tickResults[1].lockedOut) {
          replay.result.winner = undefined
        } else {
          wins[1]++
          replay.result.winner = 1
        }
      } else if (tickResults[1].lockedOut) {
        wins[0]++
        replay.result.winner = 0
      }
      replay.result.reason = 'lockout'
      replay.metadata.endTime = new Date().valueOf()
      localStorage.setItem('replays.latest', JSON.stringify(replay))
      gameOver.value = true
    }

    workerGame.tick()
    const anticipate = difficulty.value.anticipate
    if (anticipate ? !workerGame.games[1].busy : !game.games[1].busy) {
      if (workerThrottleRemaining <= 0) {
        requestStrategy()
      }
      workerThrottleRemaining--
    }
    referenceAge++
  }
  const nextTickTime = referenceAge * MS_PER_FRAME + referenceTime
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

function requestStrategy() {
  if (waitingForWorker || !botActive.value || gameOver.value) {
    return
  }
  const simple = difficulty.value.anticipate ? workerGame.toSimpleGame(1) : game.toSimpleGame(1)
  // Make sure the bot only sees what it's supposed to.
  simple.bag = game.games[1].visibleBag
  const message = {
    name: difficulty.value.botName,
    game: simple,
    anticipation: workerAnticipation,
    throttleFrames: difficulty.value.throttleFrames,
    hardDrop: difficulty.value.hardDrop
  }
  waitingForWorker = true
  worker.postMessage(message)
}

function onWorkerMessage(event: MessageEvent) {
  workerStrategy = event.data.strategy
  workerAnticipation = Math.min(event.data.thinkingFrames, MAX_WORKER_ANTICIPATION)
  if (!difficulty.value.anticipate) {
    workerAnticipation = 0
  }
  waitingForWorker = false
  workerThrottleRemaining = difficulty.value.throttleFrames
  workerGame = game.clone()
  for (let i = 0; i < workerAnticipation; ++i) {
    workerGame.tick()
  }
}

worker.addEventListener('message', onWorkerMessage)

// Animation goes here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function draw(timeStamp: DOMHighResTimeStamp) {
  const drawTime = window.performance.now()
  fallMu.value = Math.max(0, Math.min(1, (drawTime - lastTickTime) * FRAME_RATE))

  if (lastAgeDrawn !== game.age) {
    gameStates.value = game.state
    chainCards.value = game.deck.chains
    lastAgeDrawn = game.age
  }

  frameId = window.requestAnimationFrame(draw)
}

// Child props that require access to the game engine

const primaryDropletY = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 1
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game!.games[0].screen.dropPuyo(x1, y1 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 > y1) {
    return bottom - 1
  }
  return bottom
})

const secondaryDropletY = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 2
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game!.games[0].screen.dropPuyo(x2, y2 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 < y1) {
    return bottom - 1
  }
  return bottom
})

const preIgnitions = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return Array(WIDTH * VISIBLE_HEIGHT).fill(false)
  }
  return game!.games[0].screen
    .preIgnite(
      playingField.value.x1,
      primaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[0],
      playingField.value.x2,
      secondaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[1]
    )
    .slice(WIDTH * (GHOST_Y + 1))
})

function commitMove(x1: number, y1: number, orientation: number, hardDrop: boolean) {
  userMove = { x1, y1, orientation, hardDrop }
}

function selectDifficulty(index: number) {
  if (botActive.value && index === difficultyIndex.value) {
    botActive.value = false
    replay.metadata.names[1] = 'nothing'
  } else {
    botActive.value = true
    difficultyIndex.value = index
    replay.metadata.names[1] = `${difficulty.value.label} (CPU)`
  }
  replay.metadata.round = 0
  replay.metadata.priorWins = [0, 0]
  wins.fill(0)
}

function restart() {
  localStorage.setItem('replays.latest', JSON.stringify(replay))

  workerStrategy = null
  workerThrottleRemaining = difficulty.value.throttleFrames
  lastAgeDrawn = -1
  gameSeed = randomSeed()
  colorSelection = randomColorSelection()
  colorSelections = [colorSelection, colorSelection]
  screenSeed = randomSeed()
  game = new DeckedGame(
    gameSeed,
    screenSeed,
    colorSelections,
    targetPoints,
    marginFrames,
    mercyFrames
  )
  replay.gameSeed = gameSeed
  replay.screenSeed = screenSeed
  replay.colorSelections = colorSelections
  replay.moves.length = 0
  replay.metadata.priorWins = [...wins]
  replay.metadata.round++
  replay.metadata.msSince1970 = new Date().valueOf()
  replay.result = {
    reason: 'ongoing'
  }
  gameOver.value = false

  workerGame = game.clone()
  for (let i = 0; i < workerAnticipation; ++i) {
    workerGame.tick()
  }

  userMove = null
  referenceTime = null
  referenceAge = 0
  chainCards.value = [[], []]
}

onMounted(() => {
  window.setTimeout(tick, 1)
  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
  if (tickId !== null) {
    window.clearTimeout(tickId)
  }
  if (frameId !== null) [window.cancelAnimationFrame(frameId)]
})
</script>

<template>
  <main>
    <PlayingField
      ref="playingField"
      @commit="commitMove"
      :wins="wins"
      :gameStates="gameStates"
      :chainCards="chainCards"
      :canPass="null"
      :canRequeue="false"
      :passing="false"
      :opponentThinkingOpacity="0"
      :fallMu="fallMu"
      :primaryDropletY="primaryDropletY"
      :secondaryDropletY="secondaryDropletY"
      :preIgnitions="preIgnitions"
      :timeouts="[false, false]"
      :names="[]"
      :timeDisplays="[]"
      :timeDangers="[]"
    >
      <PlayingButton
        v-for="(diff, i) of DIFFICULTIES"
        :key="i"
        :class="{ active: botActive && difficultyIndex === i }"
        @click.stop="selectDifficulty(i)"
        @touchstart.stop="selectDifficulty(i)"
        :x="0"
        :y="i"
        >{{ diff.label }}</PlayingButton
      >
      <PlayingButton
        :class="{ active: gameOver, disabled: !gameOver }"
        @click.stop="restart"
        @touchstart.stop="restart"
        :x="0"
        :y="6"
        >Restart</PlayingButton
      >
    </PlayingField>
  </main>
</template>
