<script setup lang="ts">
import { GHOST_Y, type GameState, MultiplayerGame, VISIBLE_HEIGHT, WIDTH, type Replay, replayToAlgebraic } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import SVGDefs from './SVGDefs.vue'
import { useWebSocketStore } from '@/stores/websocket'
import PlayingCursor from './PlayingCursor.vue'
import PlayingScreen from './PlayingScreen.vue'
import { chainFX } from '@/soundFX'
import { useAudioContextStore } from '@/stores/audio-context'
import {
  getFill,
  type Chain,
  getStroke,
  MISSING_FILL,
  MISSING_STROKE,
  MISSING_SYMBOL,
  panelSymbol,
  STROKE_WIDTH
} from '@/util'

// === Type definitions ===

type NormalMove = {
  player: number
  x1: number
  y1: number
  orientation: number
  hardDrop: boolean
  pass: false
}

type PassingMove = {
  player: number
  pass: true
}

type Move = NormalMove | PassingMove

const replay: Replay = {
  gameSeed: -1,
  screenSeed: -1,
  colorSelection: [],
  moves: []
}

// === Constants ===

const MAX_CHAIN_CARD_AGE = 100

const GAME_TYPE: 'pausing' | 'realtime' = 'pausing'

const LOG = true

// Frames per millisecond
const GAME_FRAME_RATE = 45 / 1000 // Pausing runs (catches up) 50% faster than realtime
const MS_PER_FRAME = 1 / GAME_FRAME_RATE

// Graphics
const LEFT_SCREEN_X = 1.2
const RIGHT_SCREEN_X = 11
const SCREEN_Y = 1

// === State ===

// Server connection
const websocket = useWebSocketStore()
let identity: number | null = null
// Silly linter is silly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let moveSent = false
let opponentBagTime: DOMHighResTimeStamp | null = null
const bagQueues: number[][][] = [[], []]
const moveQueues: Move[][] = [[], []]

const audioContext = useAudioContextStore()

// Engine: The game is merely a mirror driven by the server.
let mirrorGame: MultiplayerGame | null = null
const passing = ref(false)
const justPassed = ref(false)
const wins = reactive([0, 0])
let tickId: number | null = null
let gameAge = 0
let gameStart: DOMHighResTimeStamp | null = null
let lastTickTime: DOMHighResTimeStamp | null = null

// Drawing / graphics
const gameStates = ref<GameState[] | null>(null)
const fallMu = ref(0)
const opponentThinkingOpacity = ref(0)
const ignitionCenters = [
  [0, 0],
  [0, 0]
]
const chainCards = reactive<Chain[][]>([[], []])
let frameId: number | null = null
let start: DOMHighResTimeStamp | null = null

const svg = ref<SVGSVGElement | null>(null)
const cursorContainer = ref<SVGGraphicsElement | null>(null)
const cursor = ref<typeof PlayingCursor | null>(null)

const cursorLocked = ref(false)
const cursorY = ref(1)

// Server connection

// The main App is responsible for requesting the game once everything has mounted and the connection has been established.
function onMessage(message: any) {
  if (LOG) {
    console.log(message)
  }
  if (message.type === 'identity') {
    identity = message.player
  }
  if (message.type === 'game params') {
    mirrorGame = new MultiplayerGame(null, message.colorSelection, message.screenSeed)
    replay.gameSeed = -1
    replay.colorSelection = message.colorSelection
    replay.screenSeed = message.screenSeed
    replay.moves.length = 0
    bagQueues.forEach((queue) => (queue.length = 0))
    moveQueues.forEach((queue) => (queue.length = 0))
    gameAge = 0
    gameStart = null
    opponentBagTime = null
    moveSent = false
    chainCards[0].length = 0
    chainCards[1].length = 0
    passing.value = false
    justPassed.value = false
    opponentThinkingOpacity.value = 0
    if (tickId === null) {
      tickId = window.setTimeout(tick, 1)
    }
  }
  if (message.type === 'bag') {
    message.player = identity ? 1 - message.player : message.player
    bagQueues[message.player].push(message.bag)
    if (!mirrorGame!.games[message.player].bag.length) {
      mirrorGame!.games[message.player].bag = [...message.bag]
    }
    if (message.player === 1) {
      opponentBagTime = performance.now()
    }
    if (message.player === 0 && mirrorGame!.games[0].bag.length < 6) {
      if (LOG) {
        console.log('Setting own bag from message')
      }
      mirrorGame!.games[0].bag = [...message.bag]
    }
  }
  if (message.type === 'move') {
    message.player = identity ? 1 - message.player : message.player
    moveQueues[message.player].push(message)
  }
  if (message.type === 'game result') {
    // TODO: Requeue manually #24
    setTimeout(() => websocket.requestGame(), 4000)
    if (message.result === 'win') {
      wins[0]++
    } else if (message.result === 'loss') {
      wins[1]++
    }
    replay.gameSeed = message.gameSeed
    console.log(JSON.stringify(replay))
    // console.log(replayToAlgebraic(replay).join(' '))
  }
}

// Game logic goes here and runs independent of animation.
function tick() {
  const timeStamp = window.performance.now()
  if (gameStart === null) {
    gameStart = timeStamp
  }

  for (let i = 0; i < moveQueues.length; ++i) {
    if (!mirrorGame!.games[i].busy && moveQueues[i].length) {
      const move = moveQueues[i].shift()!
      const bag = bagQueues[i].shift()
      if (bag === undefined) {
        throw new Error('Bag queue desync')
      }
      if (move.pass) {
        passing.value = true
      } else {
        passing.value = false
        mirrorGame!.games[i].bag = bag
        const playedMove = mirrorGame!.play(i, move.x1, move.y1, move.orientation, move.hardDrop)
        replay.moves.push(playedMove)

        if (i === 0 && mirrorGame!.games[i].bag.length < 6 && bagQueues[i].length) {
          if (LOG) {
            console.log('Setting own bag from queue')
          }
          mirrorGame!.games[i].bag = [...bagQueues[i][0]]
        }
      }
    }
  }

  const intendedAge = (timeStamp - gameStart) * GAME_FRAME_RATE
  while (gameAge < intendedAge) {
    if (
      mirrorGame!.games.every((game) => game.busy) ||
      (passing.value && mirrorGame!.games.some((game) => game.busy))
    ) {
      const tickResults = mirrorGame!.tick()
      if (tickResults.every((r) => !r.busy)) {
        passing.value = false
      }
      let impactOffset = 0
      let plopOffset = 0
      for (let i = 0; i < tickResults.length; ++i) {
        if (tickResults[i].didClear) {
          chainFX(audioContext, i, tickResults[i].chainNumber)
          chainCards[i].push({
            number: tickResults[i].chainNumber,
            age: 0,
            x: ignitionCenters[i][0],
            y: ignitionCenters[i][1]
          })
        }
        // For technical reasons hard-dropped pieces only jiggle and never "land" as they have zero airtime.
        if (
          tickResults[i].coloredLanded ||
          (tickResults[i].didJiggle && !tickResults[i].garbageLanded)
        ) {
          impactOffset += 1 + 2000 * i
        }
        if (tickResults[i].garbageLanded) {
          plopOffset += 1 + 20 * i
        }
      }
      if (impactOffset) {
        audioContext.impact(impactOffset)
      }
      if (plopOffset) {
        audioContext.plop(plopOffset)
      }
      for (let j = 0; j < chainCards.length; ++j) {
        for (let i = 0; i < chainCards[j].length; ++i) {
          chainCards[j][i].age++
        }
        if (chainCards[j].length && chainCards[j][0].age > MAX_CHAIN_CARD_AGE) {
          chainCards[j].shift()
        }
      }
    }
    gameAge++
  }
  const nextTickTime = gameAge * MS_PER_FRAME + gameStart
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

// Animation goes here.
function draw(timeStamp: DOMHighResTimeStamp) {
  if (start === null) {
    start = timeStamp
  }
  const drawTime = window.performance.now()
  if (lastTickTime === null) {
    fallMu.value = 0
  } else {
    fallMu.value = Math.max(0, Math.min(1, (drawTime - lastTickTime) * GAME_FRAME_RATE))
  }

  if (mirrorGame !== null) {
    gameStates.value = mirrorGame.state
    calculateIgnitionCenters()
  }

  const moveReceived = moveQueues[1].length
  const waitingOnSelf = gameStates.value && !gameStates.value[0].busy
  const opponentResolving = gameStates.value && gameStates.value[1].busy
  const gameOver = gameStates.value && gameStates.value.some((s) => s.lockedOut)

  // XXX: Fading depends on framerate
  if (opponentBagTime === null || moveReceived || waitingOnSelf || opponentResolving || gameOver) {
    opponentThinkingOpacity.value *= 0.7
  } else if (drawTime - opponentBagTime > 1000) {
    opponentThinkingOpacity.value = 1 - (1 - opponentThinkingOpacity.value) * 0.995
  }

  frameId = window.requestAnimationFrame(draw)
}

function calculateIgnitionCenters() {
  if (!gameStates.value) {
    return
  }
  for (let i = 0; i < gameStates.value.length; ++i) {
    let numIgnitions = 0
    let x = 0
    let y = 0
    gameStates.value[i].screen.ignited.slice(WIDTH * (GHOST_Y + 1)).forEach((flag, index) => {
      if (flag) {
        x += index % WIDTH
        y += Math.floor(index / WIDTH)
        numIgnitions++
      }
    })
    if (numIgnitions) {
      ignitionCenters[i][0] = x / numIgnitions
      ignitionCenters[i][1] = y / numIgnitions
    }
  }
}

// User interaction goes here.
function passOnEscape(event: KeyboardEvent) {
  if (!gameStates.value || justPassed.value) {
    return
  }
  if (event.code === 'Escape' && !gameStates.value[0].busy && gameStates.value[1].busy) {
    justPassed.value = true
    websocket.passMove()
  }
}

// Mount server connection, game loop and animation loop.

onMounted(() => {
  websocket.addMessageListener(onMessage)
  frameId = window.requestAnimationFrame(draw)
  document.addEventListener('keydown', passOnEscape)
})

onUnmounted(() => {
  websocket.removeMessageListener(onMessage)
  if (tickId !== null) {
    window.clearTimeout(tickId)
  }
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
  }
  document.removeEventListener('keydown', passOnEscape)
})

// Graphics

const primaryFill = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? getFill(gameStates.value[0].hand[0])
    : MISSING_FILL
)
const primaryDropletFill = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? getStroke(gameStates.value[0].hand[0])
    : MISSING_STROKE
)
const primaryStroke = computed(() => {
  if (!cursor.value || !gameStates.value || !gameStates.value[0].hand.length) {
    return MISSING_STROKE
  }
  const index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
  if (gameStates.value[0].screen.grid[index] === gameStates.value[0].hand[0]) {
    return 'white'
  }
  return getStroke(gameStates.value[0].hand[0])
})
const primaryDarkStroke = computed(() =>
  gameStates.value && gameStates.value[0].preview.length
    ? getStroke(gameStates.value[0].preview[0], true)
    : MISSING_STROKE
)
const primarySymbol = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? panelSymbol(gameStates.value[0].hand[0])
    : MISSING_SYMBOL
)

const secondaryFill = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? getFill(gameStates.value[0].hand[1])
    : MISSING_FILL
)
const secondaryStroke = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? getStroke(gameStates.value[0].hand[1])
    : MISSING_STROKE
)
const secondaryDarkStroke = computed(() =>
  gameStates.value && gameStates.value[0].preview.length
    ? getStroke(gameStates.value[0].preview[1], true)
    : MISSING_STROKE
)
const secondarySymbol = computed(() =>
  gameStates.value && gameStates.value[0].hand.length
    ? panelSymbol(gameStates.value[0].hand[1])
    : MISSING_SYMBOL
)

const cursorActive = computed(() =>
  gameStates.value ? !gameStates.value[0].busy && !passing.value : false
)

function kickCursor() {
  if (!gameStates.value || !cursor.value) {
    return
  }
  let index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
  while (gameStates.value[0].screen.grid[index] >= 0 && cursorY.value >= 0) {
    index -= WIDTH
    cursorY.value -= 1
  }
}

function lockCursor() {
  cursorLocked.value = true
  kickCursor()
}

function commitMove(x1: number, y1: number, orientation: number) {
  websocket.makeMove(x1, y1, orientation)
  justPassed.value = false
  moveSent = true
  cursorLocked.value = false
}

const primaryDropletY = computed(() => {
  if (!gameStates.value || !cursor.value) {
    return VISIBLE_HEIGHT - 1
  }
  const bottom =
    mirrorGame!.games[0].screen.dropPuyo(cursor.value.x, cursorY.value + GHOST_Y + 1) - GHOST_Y - 1
  if (cursor.value.x === cursor.value.snapX && cursor.value.snapY > cursorY.value) {
    return bottom - 1
  }
  return bottom
})
const secondaryDropletY = computed(() => {
  if (!gameStates.value || !cursor.value) {
    return VISIBLE_HEIGHT - 1
  }
  const bottom =
    mirrorGame!.games[0].screen.dropPuyo(cursor.value.snapX, cursor.value.snapY + GHOST_Y + 1) -
    GHOST_Y -
    1
  if (cursor.value.x === cursor.value.snapX && cursor.value.snapY < cursorY.value) {
    return bottom - 1
  }
  return bottom
})

const preIgnitions = computed(() => {
  if (!gameStates.value || !cursor.value) {
    return Array(WIDTH * VISIBLE_HEIGHT).fill(false)
  }
  return mirrorGame!.games[0].screen
    .preIgnite(
      cursor.value.x,
      primaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[0],
      cursor.value.snapX,
      secondaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[1]
    )
    .slice(WIDTH * (GHOST_Y + 1))
})
</script>

<template>
  <svg ref="svg" width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[0] : null"
        :gameType="GAME_TYPE"
        :fallMu="fallMu"
        :preIgnitions="preIgnitions"
        :chainCards="chainCards[0]"
        :wins="wins[0]"
      />
    </g>
    <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[1] : null"
        :gameType="GAME_TYPE"
        :fallMu="fallMu"
        :preIgnitions="null"
        :chainCards="chainCards[1]"
        :wins="wins[1]"
      />
    </g>
    <!--Opponent thinking indicator-->
    <use
      href="#thinking"
      :x="RIGHT_SCREEN_X + 0.5"
      :y="SCREEN_Y + 8"
      :opacity="opponentThinkingOpacity"
    ></use>
    <g
      ref="cursorContainer"
      :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`"
      :stroke-width="STROKE_WIDTH"
    >
      <PlayingCursor
        ref="cursor"
        :svg="svg"
        :container="cursorContainer"
        :primaryFill="primaryFill"
        :primaryStroke="primaryStroke"
        :primaryDarkStroke="primaryDarkStroke"
        :primarySymbol="primarySymbol"
        :secondaryFill="secondaryFill"
        :secondaryStroke="secondaryStroke"
        :secondaryDarkStroke="secondaryDarkStroke"
        :secondarySymbol="secondarySymbol"
        :locked="cursorLocked"
        :y="cursorY"
        :active="cursorActive"
        @setY="(y) => (cursorY = y)"
        @lock="lockCursor"
        @unlock="cursorLocked = false"
        @commit="commitMove"
      />
      <circle
        r="0.1"
        :cx="(cursor ? cursor.x : 2) + 0.5"
        :cy="primaryDropletY + 0.5"
        :fill="primaryDropletFill"
        stroke="white"
        stroke-width="0.03"
        opacity="0.7"
      ></circle>
      <circle
        r="0.1"
        :cx="(cursor ? cursor.snapX : 2) + 0.5"
        :cy="secondaryDropletY + 0.5"
        :fill="secondaryStroke"
        stroke="white"
        stroke-width="0.03"
        opacity="0.7"
      ></circle>
    </g>
  </svg>
</template>

<style scoped>
svg {
  user-select: none;
}
</style>
