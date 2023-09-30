<script setup lang="ts">
import {
  GARBAGE,
  GHOST_Y,
  MultiplayerGame,
  VISIBLE_HEIGHT,
  WIDTH,
  combinedGarbageDisplay
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import SVGDefs from './SVGDefs.vue'

// Frames per millisecond
const GAME_FRAME_RATE = 30 / 1000
const MS_PER_FRAME = 1 / GAME_FRAME_RATE

const game = new MultiplayerGame()

let tickId: number | null = null

let gameAge = 0
let gameStart: null | DOMHighResTimeStamp = null
let lastTickTime: number | null = null

// Game logic goes here and runs independent of animation.
function tick() {
  const timeStamp = window.performance.now()
  if (gameStart === null) {
    gameStart = timeStamp
  }
  const intendedAge = (timeStamp - gameStart) * GAME_FRAME_RATE
  while (gameAge < intendedAge) {
    // Make random moves just to demonstrate.
    const player = Math.floor(Math.random() * 2)
    if (Math.random() < 0.1 && !game.games[player].active) {
      game.play(player, Math.floor(Math.random() * WIDTH), 2, 0)
    }
    game.tick()
    gameAge++
  }
  const nextTickTime = gameAge * MS_PER_FRAME + gameStart
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

const gameState = ref(game.state)

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

  if (lastFrameDrawn !== gameAge) {
    lastFrameDrawn = gameAge

    gameState.value = game.state
  }

  frameId = window.requestAnimationFrame(draw)
}

onMounted(() => {
  gameAge = 0
  gameStart = null
  tickId = window.setTimeout(tick, 1)
  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
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

const puyoPropss = computed(() => {
  const result = []
  for (const playerState of gameState.value) {
    const playerPuyos = []
    let index = WIDTH * GHOST_Y
    for (const colorIndex of playerState.screen.grid.slice(WIDTH * GHOST_Y)) {
      let y = Math.floor(index / WIDTH) - GHOST_Y
      let fill = getFill(colorIndex)
      if (y === 0 && fill !== 'none') {
        fill = 'rgba(100, 100, 100, 0.5)'
      }
      let stroke = getStroke(colorIndex)
      if (playerState.screen.falling[index]) {
        y += fallMu.value
      }
      if (playerState.screen.ignited[index]) {
        fill = '#eed'
      }
      playerPuyos.push({
        index,
        x: index % WIDTH,
        y,
        fill,
        stroke
      })
      index++
    }
    result.push(playerPuyos)
  }
  return result
})

const previewFills = computed(() =>
  gameState.value.map((state) => state.visibleBag.slice(-4).map((i) => FILLS[i]))
)

const garbageGlyphss = computed(() => {
  const result = []
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
</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <use href="#screen" :x="LEFT_SCREEN_X" :y="SCREEN_Y"></use>
    <use href="#screen" :x="RIGHT_SCREEN_X" :y="SCREEN_Y"></use>
    <template v-for="(puyoProps, playerIndex) in puyoPropss" :key="playerIndex">
      <!--Playing grid-->
      <circle
        v-for="p in puyoProps"
        r="0.4"
        stroke-width="0.1"
        :key="p.index"
        :cx="p.x + 0.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        :cy="p.y - 0.5 + SCREEN_Y"
        :fill="p.fill"
        :stroke="p.stroke"
      ></circle>
      <!--Piece preview-->
      <circle
        r="0.4"
        :cx="WIDTH + 1.0 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        cy="2.5"
        :fill="previewFills[playerIndex][0]"
      ></circle>
      <circle
        r="0.4"
        :cx="WIDTH + 1.0 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        cy="1.5"
        :fill="previewFills[playerIndex][1]"
      ></circle>
      <circle
        r="0.4"
        :cx="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        cy="4.7"
        :fill="previewFills[playerIndex][2]"
      ></circle>
      <circle
        r="0.4"
        :cx="WIDTH + 1.5 + (playerIndex ? RIGHT_SCREEN_X : LEFT_SCREEN_X)"
        cy="3.7"
        :fill="previewFills[playerIndex][3]"
      ></circle>
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
        <tspan class="score">{{ gameState[playerIndex].score }}</tspan>
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
