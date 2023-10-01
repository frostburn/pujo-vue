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

type Move = {
  player: number
  x1: number
  y1: number
  orientation: number
  kickDown: boolean
}

const GAME_TYPE: string = 'pausing'

// Server connection

const websocket = useWebSocketStore()

const LOG = false

let identity: number | null = null

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
      moveSent = false
      mirrorGame!.games[message.player].bag = message.bag
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
    if (!mirrorGame!.games[i].busy && moveQueues[i].length) {
      const move = moveQueues[i].shift()!
      const bag = bagQueues[i].shift()
      if (bag === undefined) {
        throw new Error('Bag queue desync')
      }
      mirrorGame!.games[i].bag = bag
      mirrorGame!.play(move.player, move.x1, move.y1, move.orientation, move.kickDown)
    }
  }

  if (!mirrorGame!.games[identity!].busy && !moveSent) {
    // Make random moves just to demonstrate.
    websocket.makeMove(Math.floor(Math.random() * WIDTH), 2, 0)
    moveSent = true
  }

  const intendedAge = (timeStamp - gameStart) * GAME_FRAME_RATE
  while (gameAge < intendedAge) {
    if (mirrorGame!.games.every((game) => game.busy)) {
      mirrorGame!.tick()
    }
    gameAge++
  }
  const nextTickTime = gameAge * MS_PER_FRAME + gameStart
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

const gameState = ref<GameState[] | null>(null)

const fallMu = ref(0)

let lastFrameDrawn: number | null = null

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

  if (lastFrameDrawn !== gameAge && mirrorGame !== null) {
    lastFrameDrawn = gameAge

    gameState.value = mirrorGame.state
  }

  frameId = window.requestAnimationFrame(draw)
}

// Mount server connection, game loop and animation loop.

onMounted(() => {
  websocket.addMessageListener(onMessage)
  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
  websocket.removeMessageListener(onMessage)
  if (tickId !== null) {
    window.clearTimeout(tickId)
  }
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
  }
})

// Graphics

const LEFT_SCREEN_X = 1
const RIGHT_SCREEN_X = 11
const SCREEN_Y = 1
const STROKES = ['#d22', '#2d2', '#dd2', '#22e', '#d2c', 'rgba(20, 160, 160, 0.88)']
const FILLS = ['#922', '#292', '#882', '#229', '#828', 'rgba(30, 255, 255, 0.94)']
const STROKE_WIDTH = 0.15

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
        if (screen.jiggling[index]) {
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
    result = gameState.value.map((state) => state.visibleBag.slice(-4).map(mapping))
  }
  for (let i = 0; i < result.length; ++i) {
    while (result[i].length < 4) {
      result[i].push(fillValue)
    }
  }
  return result
}

const previewFills = computed(() => previewAttrs((i) => FILLS[i], 'black'))

const previewStrokes = computed(() => previewAttrs((i) => STROKES[i], '#0a0a0a'))

const previewSymbols = computed(() => previewAttrs((i) => panelSymbol(i), '#cross'))

const garbageGlyphss = computed(() => {
  if (gameState.value === null) {
    return [[], []]
  }
  const result: SVGAttributes[][] = []
  for (const state of gameState.value) {
    result.push(
      combinedGarbageDisplay(state.pendingGarbage, state.lateGarbage).map((symbol) => {
        if (symbol === 'rock') {
          symbol = 'spade'
        } else if (symbol === 'crown') {
          symbol = 'diamond'
        }
        return {
          href: `#${symbol}`,
          fill: FILLS[GARBAGE],
          stroke: STROKES[GARBAGE],
          'stroke-width': STROKE_WIDTH
        }
      })
    )
  }
  return result
})

const scores = computed(() => {
  if (gameState.value === null) {
    return ['-', '-']
  }
  return gameState.value.map((state) => state.score)
})
</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <!--Ghost panels go behind the screens-->
    <template v-for="(ghostAttrs, playerIndex) in ghostAttrss" :key="playerIndex">
      <use v-for="(attrs, i) in ghostAttrs" v-bind="attrs" :key="i"></use>
    </template>
    <use href="#screen" :x="LEFT_SCREEN_X" :y="SCREEN_Y"></use>
    <use href="#screen" :x="RIGHT_SCREEN_X" :y="SCREEN_Y"></use>
    <template v-for="(panelAttrs, playerIndex) in panelAttrss" :key="playerIndex">
      <!--Playing grid-->
      <use v-for="(attrs, i) in panelAttrs" v-bind="attrs" :key="i"></use>
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
  </svg>
</template>

<style scoped>
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
