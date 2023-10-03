<script setup lang="ts">
import {
  BLUE,
  GARBAGE,
  GHOST_Y,
  GREEN,
  type GameState,
  HEIGHT,
  MultiplayerGame,
  PURPLE,
  RED,
  VISIBLE_HEIGHT,
  WIDTH,
  YELLOW,
  combinedGarbageDisplay
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref, type SVGAttributes } from 'vue'
import SVGDefs from './SVGDefs.vue'
import { useWebSocketStore } from '@/stores/websocket'
import PlayingCursor from './PlayingCursor.vue'

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

const GAME_TYPE: string = 'pausing'

// Server connection

const websocket = useWebSocketStore()

const LOG = false

let identity: number | null = null

// Silly linter is silly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let moveSent = false

const bagQueues: number[][][] = [[], []]

const moveQueues: Move[][] = [[], []]

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
    bagQueues.forEach((queue) => (queue.length = 0))
    moveQueues.forEach((queue) => (queue.length = 0))
    gameAge = 0
    gameStart = null
    tickId = window.setTimeout(tick, 1)
  }
  if (message.type === 'bag') {
    bagQueues[message.player].push(message.bag)
    // Bags are unloaded before each move so this is just for the visuals
    if (message.player === identity) {
      if (LOG) {
        console.log('Setting own bag')
      }
      moveSent = false
      mirrorGame!.games[0].bag = [...message.bag]
    } else if (!mirrorGame!.games[1].bag.length) {
      // Always show the first bag of the opponent
      mirrorGame!.games[1].bag = [...message.bag]
    }
  }
  if (message.type === 'move') {
    moveQueues[message.player].push(message)
  }
  if (message.type === 'game result') {
    websocket.requestGame()
  }
}

// Frames per millisecond
const GAME_FRAME_RATE = 45 / 1000 // Pausing runs (catches up) 50% faster than realtime
const MS_PER_FRAME = 1 / GAME_FRAME_RATE

// This is merely a mirror driven by the server.
let mirrorGame: MultiplayerGame | null = null
let passing = ref(false)

let tickId: number | null = null

let gameAge = 0
let gameStart: DOMHighResTimeStamp | null = null
let lastTickTime: DOMHighResTimeStamp | null = null

// Game logic goes here and runs independent of animation.
function tick() {
  const timeStamp = window.performance.now()
  if (gameStart === null) {
    gameStart = timeStamp
  }

  for (let i = 0; i < moveQueues.length; ++i) {
    const j = identity ? 1 - i : i
    if (!mirrorGame!.games[j].busy && moveQueues[i].length) {
      const move = moveQueues[i].shift()!
      const bag = bagQueues[i].shift()
      if (bag === undefined) {
        throw new Error('Bag queue desync')
      }
      if (move.pass) {
        passing.value = true
      } else {
        passing.value = false
        const player = identity ? 1 - move.player : move.player
        if (player === 1) {
          mirrorGame!.games[player].bag = bag
          mirrorGame!.play(player, move.x1, move.y1, move.orientation, move.hardDrop)
        } else {
          const displayBag = mirrorGame!.games[player].bag
          mirrorGame!.games[player].bag = bag
          mirrorGame!.play(player, move.x1, move.y1, move.orientation, move.hardDrop)
          mirrorGame!.games[player].bag = displayBag
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
    }
    gameAge++
  }
  const nextTickTime = gameAge * MS_PER_FRAME + gameStart
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

const gameState = ref<GameState[] | null>(null)

const fallMu = ref(0)

let frameId: number | null = null

let start: DOMHighResTimeStamp | null = null

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
    gameState.value = mirrorGame.state
  }

  frameId = window.requestAnimationFrame(draw)
}

// User interaction goes here.
function passOnEscape(event: KeyboardEvent) {
  if (gameState.value === null) {
    return
  }
  if (event.code === 'Escape' && !gameState.value[0].busy && gameState.value[1].busy) {
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

const LEFT_SCREEN_X = 1
const RIGHT_SCREEN_X = 11
const SCREEN_Y = 1
const STROKES = ['#d22', '#2d2', '#dd2', '#22e', '#d2c', 'rgba(20, 160, 160, 0.88)']
const FILLS = ['#922', '#292', '#882', '#229', '#828', 'rgba(30, 255, 255, 0.94)']
const STROKE_WIDTH = 0.15
const MISSING_FILL = 'black'
const MISSING_STROKE = '#0a0a0a'
const MISSING_SYMBOL = '#cross'

function getStroke(colorIndex: number) {
  if (colorIndex < 0) {
    return 'none'
  } else if (colorIndex < STROKES.length) {
    return STROKES[colorIndex]
  }
  return 'white'
}

function getFill(colorIndex: number) {
  if (colorIndex < 0) {
    return 'none'
  } else if (colorIndex < FILLS.length) {
    return FILLS[colorIndex]
  }
  return 'magenta'
}

const ghostAttrss = computed(() => {
  if (gameState.value === null) {
    return [[], []]
  }
  const result = []
  let xOffset = LEFT_SCREEN_X
  for (const state of gameState.value) {
    const screen = state.screen
    const panels: SVGAttributes[] = []
    for (let index = WIDTH * GHOST_Y; index < WIDTH * (GHOST_Y + 1); ++index) {
      const x = (index % WIDTH) + 0.5 + xOffset
      let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5 + SCREEN_Y
      let stroke = getStroke(screen.grid[index])
      if (screen.falling[index] && GAME_TYPE === 'realtime') {
        y += fallMu.value
      }
      let href = ''
      if (screen.grid[index] === GARBAGE) {
        href = '#garbage'
      } else if (screen.grid[index] >= 0) {
        href = '#panel0'
      }
      panels.push({
        href,
        x,
        y,
        fill: 'none',
        stroke,
        'stroke-width': STROKE_WIDTH * 0.5,
        'stroke-dasharray': '0.1 0.108',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        mask: 'url(#fade-mask)'
      })
    }
    result.push(panels)
    xOffset = RIGHT_SCREEN_X
  }
  return result
})

const panelAttrss = computed(() => {
  if (gameState.value === null) {
    return [[], []]
  }
  const result = []
  let xOffset = LEFT_SCREEN_X
  for (const state of gameState.value) {
    const screen = state.screen
    const panels: SVGAttributes[] = []
    for (let index = WIDTH * (GHOST_Y + 1); index < WIDTH * HEIGHT; ++index) {
      const x = (index % WIDTH) + 0.5 + xOffset
      let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5 + SCREEN_Y
      let fill = getFill(screen.grid[index])
      let stroke = getStroke(screen.grid[index])
      if (screen.falling[index] && GAME_TYPE === 'realtime') {
        y += fallMu.value
      }
      if (screen.ignited[index]) {
        fill = '#eed'
      }
      let href = ''
      if (screen.grid[index] === GARBAGE) {
        if (screen.sparking[index]) {
          href = ''
        } else if (screen.jiggling[index]) {
          href = '#jiggling-garbage'
        } else {
          href = '#garbage'
        }
      } else if (screen.grid[index] >= 0) {
        if (screen.sparking[index]) {
          href = '#sparks'
          fill = stroke
          stroke = 'none'
        } else {
          href = `#panel${screen.connectivity[index]}`
        }
      }
      panels.push({
        href,
        x,
        y,
        fill,
        stroke,
        'stroke-width': STROKE_WIDTH
      })
    }
    result.push(panels)
    xOffset = RIGHT_SCREEN_X
  }
  return result
})

function panelSymbol(color: number, jiggle = false) {
  if (color === RED) {
    return jiggle ? '#jiggling-heart' : '#heart'
  } else if (color === GREEN) {
    return jiggle ? '#jiggling-circle' : '#small-circle'
  } else if (color === YELLOW) {
    return jiggle ? '#jiggling-star' : '#small-star'
  } else if (color === BLUE) {
    return jiggle ? '#jiggling-moon' : '#small-moon'
  } else if (color === PURPLE) {
    return jiggle ? '#jiggling-diamond' : '#small-diamond'
  }
  return ''
}

const panelGlyphAttrss = computed(() => {
  if (gameState.value === null) {
    return [[], []]
  }
  const result = []
  let xOffset = LEFT_SCREEN_X
  for (const state of gameState.value) {
    const screen = state.screen
    const glyphs: SVGAttributes[] = []
    for (let index = WIDTH * (GHOST_Y + 1); index < WIDTH * HEIGHT; ++index) {
      const x = (index % WIDTH) + 0.5 + xOffset
      let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5 + SCREEN_Y
      let fill = getStroke(screen.grid[index])
      if (screen.falling[index] && GAME_TYPE === 'realtime') {
        y += fallMu.value
      }
      let href = panelSymbol(screen.grid[index], screen.jiggling[index])
      if (screen.sparking[index]) {
        href = ''
      }
      glyphs.push({
        href,
        x,
        y,
        fill,
        stroke: 'none'
      })
    }
    result.push(glyphs)
    xOffset = RIGHT_SCREEN_X
  }
  return result
})

function previewAttrs(mapping: (i: number) => string, fillValue: string) {
  let result: string[][] = [[], []]
  if (gameState.value !== null) {
    result = gameState.value.map((state) => state.preview.map(mapping))
  }
  for (let i = 0; i < result.length; ++i) {
    while (result[i].length < 4) {
      result[i].push(fillValue)
    }
  }
  return result
}

const previewFills = computed(() => previewAttrs((i) => FILLS[i], MISSING_FILL))

const previewStrokes = computed(() => previewAttrs((i) => STROKES[i], MISSING_STROKE))

const previewSymbols = computed(() => previewAttrs((i) => panelSymbol(i), MISSING_SYMBOL))

function garbageGlyph(symbol: string, late = false) {
  if (symbol === 'rock') {
    symbol = 'spade'
  } else if (symbol === 'crown') {
    symbol = 'diamond'
  }
  return {
    href: `#${symbol}`,
    fill: FILLS[GARBAGE],
    stroke: STROKES[GARBAGE],
    'stroke-width': STROKE_WIDTH,
    opacity: late ? '0.5' : '1.0'
  }
}

const garbageGlyphss = computed(() => {
  if (gameState.value === null) {
    return [[], []]
  }
  const result: SVGAttributes[][] = []
  for (const state of gameState.value) {
    const { pending, late } = combinedGarbageDisplay(state.pendingGarbage, state.lateGarbage)
    result.push(pending.map((s) => garbageGlyph(s)).concat(late.map((s) => garbageGlyph(s, true))))
  }
  return result
})

const scores = computed(() => {
  if (gameState.value === null) {
    return ['-', '-']
  }
  return gameState.value.map((state) => state.score)
})

const svg = ref<SVGSVGElement | null>(null)
const cursorContainer = ref<SVGGraphicsElement | null>(null)
const cursor = ref<typeof PlayingCursor | null>(null)

const cursorTransform = `translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`

const cursorLocked = ref(false)
const cursorY = ref(1)

const primaryFill = computed(() =>
  gameState.value === null || !gameState.value[0].hand.length
    ? MISSING_FILL
    : FILLS[gameState.value[0].hand[0]]
)
const primaryStroke = computed(() => {
  if (cursor.value === null || gameState.value === null || !gameState.value[0].hand.length) {
    return MISSING_STROKE
  }
  const index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
  if (gameState.value[0].screen.grid[index] === gameState.value[0].hand[0]) {
    return 'white'
  }
  return gameState.value === null ? MISSING_STROKE : STROKES[gameState.value[0].hand[0]]
})
const primarySymbol = computed(() =>
  gameState.value === null || !gameState.value[0].hand.length
    ? MISSING_SYMBOL
    : panelSymbol(gameState.value[0].hand[0])
)

const secondaryFill = computed(() =>
  gameState.value === null || !gameState.value[0].hand.length
    ? MISSING_FILL
    : FILLS[gameState.value[0].hand[1]]
)
const secondaryStroke = computed(() =>
  gameState.value === null || !gameState.value[0].hand.length
    ? MISSING_STROKE
    : STROKES[gameState.value[0].hand[1]]
)
const secondarySymbol = computed(() =>
  gameState.value === null || !gameState.value[0].hand.length
    ? MISSING_SYMBOL
    : panelSymbol(gameState.value[0].hand[1])
)

const cursorActive = computed(() => {
  if (gameState.value === null) {
    return false
  }
  return !gameState.value[0].busy && !passing.value
})

function kickCursor() {
  if (gameState.value === null || cursor.value === null) {
    return
  }
  let index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
  while (gameState.value[0].screen.grid[index] >= 0 && cursorY.value >= 0) {
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
  moveSent = true
  cursorLocked.value = false
}

const primaryDropletY = computed(() => {
  if (gameState.value === null || cursor.value === null) {
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
  if (gameState.value === null || cursor.value === null) {
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
  if (gameState.value === null || cursor.value == null) {
    return Array(WIDTH * VISIBLE_HEIGHT).fill(false)
  }
  return mirrorGame!.games[0].screen
    .preIgnite(
      cursor.value.x,
      primaryDropletY.value + GHOST_Y + 1,
      gameState.value[0].hand[0],
      cursor.value.snapX,
      secondaryDropletY.value + GHOST_Y + 1,
      gameState.value[0].hand[1]
    )
    .slice(WIDTH * (GHOST_Y + 1))
})
</script>

<template>
  <svg ref="svg" width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <!--Ghost panels go behind the screens-->
    <template v-for="(ghostAttrs, playerIndex) in ghostAttrss" :key="playerIndex">
      <use v-for="(attrs, i) in ghostAttrs" v-bind="attrs" :key="i"></use>
    </template>
    <use href="#screen" :x="LEFT_SCREEN_X" :y="SCREEN_Y"></use>
    <use href="#screen" :x="RIGHT_SCREEN_X" :y="SCREEN_Y"></use>
    <template v-for="(panelAttrs, playerIndex) in panelAttrss" :key="playerIndex">
      <!--Playing grid-->
      <use v-for="(attrs, i) in panelAttrs" v-bind="attrs" :key="i">
        <animate
          v-if="playerIndex === 0 && preIgnitions[i]"
          attributeName="fill"
          values="#ffe;#bbb;#ffe"
          dur="1s"
          repeatCount="indefinite"
        ></animate>
      </use>
      <use v-for="(attrs, i) in panelGlyphAttrss[playerIndex]" v-bind="attrs" :key="i"></use>
      <!--Piece preview-->
      <g :stroke-width="STROKE_WIDTH">
        <use
          href="#panel0"
          y="2.5"
          :x="WIDTH + 1 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :fill="previewFills[playerIndex][0]"
          :stroke="previewStrokes[playerIndex][0]"
        ></use>
        <use
          y="2.5"
          :x="WIDTH + 1 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :href="previewSymbols[playerIndex][0]"
          :fill="previewStrokes[playerIndex][0]"
          stroke="none"
        ></use>

        <use
          href="#panel0"
          y="1.5"
          :x="WIDTH + 1 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :fill="previewFills[playerIndex][1]"
          :stroke="previewStrokes[playerIndex][1]"
        ></use>
        <use
          y="1.5"
          :x="WIDTH + 1 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :href="previewSymbols[playerIndex][1]"
          :fill="previewStrokes[playerIndex][1]"
          stroke="none"
        ></use>

        <use
          href="#panel0"
          y="4.7"
          :x="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :fill="previewFills[playerIndex][2]"
          :stroke="previewStrokes[playerIndex][2]"
        ></use>
        <use
          y="4.7"
          :x="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :href="previewSymbols[playerIndex][2]"
          :fill="previewStrokes[playerIndex][2]"
          stroke="none"
        ></use>

        <use
          href="#panel0"
          y="3.7"
          :x="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :fill="previewFills[playerIndex][3]"
          :stroke="previewStrokes[playerIndex][3]"
        ></use>
        <use
          y="3.7"
          :x="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
          :href="previewSymbols[playerIndex][3]"
          :fill="previewStrokes[playerIndex][3]"
          stroke="none"
        ></use>
      </g>
      <!--Garbage queue-->
      <use
        v-for="(attrs, i) in garbageGlyphss[playerIndex]"
        :key="i"
        v-bind="attrs"
        :x="i + 0.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        y="0"
      ></use>
      <!--Score-->
      <text :x="playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X" :y="2 + VISIBLE_HEIGHT">
        <tspan class="score-label">Score:</tspan>
        <tspan class="score">{{ scores[playerIndex] }}</tspan>
      </text>
    </template>
    <g ref="cursorContainer" :transform="cursorTransform" :stroke-width="STROKE_WIDTH">
      <PlayingCursor
        ref="cursor"
        :svg="svg"
        :container="cursorContainer"
        :primaryFill="primaryFill"
        :primaryStroke="primaryStroke"
        :primarySymbol="primarySymbol"
        :secondaryFill="secondaryFill"
        :secondaryStroke="secondaryStroke"
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
        :fill="primaryStroke"
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
.score-label {
  font:
    bold 0.7px 'Arial',
    sans-serif;
  fill: azure;
}
.score {
  font:
    bold 0.7px 'Lucida Console',
    monospace;
  fill: azure;
}
</style>
