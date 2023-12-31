<script setup lang="ts">
import { GHOST_Y, type GameState, VISIBLE_HEIGHT, WIDTH, HEIGHT } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SVGDefs from './SVGDefs.vue'
import SnakeCursor from './SnakeCursor.vue'
import LockOrbitCursor from './LockOrbitCursor.vue'
import PlayingScreen from './PlayingScreen.vue'
import {
  getFill,
  getStroke,
  MISSING_FILL,
  MISSING_STROKE,
  MISSING_SYMBOL,
  panelSymbol,
  STROKE_WIDTH,
  LEFT_SCREEN_X,
  RIGHT_SCREEN_X,
  SCREEN_Y,
  getCursorType
} from '@/util'
import type { Chain } from '@/chain-deck'
import PlayingButton from './PlayingButton.vue'

const props = defineProps<{
  gameStates: GameState[] | null
  chainCards: Chain[][]
  wins: number[]
  canPass: boolean | null
  passing: boolean
  fallMu: number
  opponentThinkingOpacity: number
  primaryDropletY: number
  secondaryDropletY: number
  preIgnitions: boolean[]
  timeouts: boolean[]
  names: string[]
  timeDisplays: string[]
  timeDangers: boolean[]
  countdown: number
}>()

const emit = defineEmits(['pass', 'commit'])

const CONTROLS_X = RIGHT_SCREEN_X + WIDTH + 1
const CONTROLS_Y = SCREEN_Y + 5

const CURSOR_TYPE = getCursorType()

const svg = ref<SVGSVGElement | null>(null)
const cursorContainer = ref<SVGGraphicsElement | null>(null)
const cursor = ref<typeof LockOrbitCursor | typeof SnakeCursor | null>(null)

const showHand = ref(false)
const cursorVisible = ref(true)
const cursorLocked = ref(false)
const cursorY = ref(1)

const hardDrop = ref(Boolean(JSON.parse(localStorage.getItem('hardDrop') || 'true')))

if (CURSOR_TYPE === 'snake') {
  showHand.value = true
}

watch(hardDrop, (newValue) => {
  localStorage.setItem('hardDrop', JSON.stringify(newValue))
})

// User interaction.

function pass() {
  if (props.canPass) {
    emit('pass')
  }
}

function passOnP(event: KeyboardEvent) {
  if (event.code === 'KeyP') {
    pass()
  }
}

onMounted(() => {
  document.addEventListener('keydown', passOnP)
})

onUnmounted(() => {
  document.removeEventListener('keydown', passOnP)
})

// Graphics

const primaryFill = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? getFill(props.gameStates[0].hand[0])
    : MISSING_FILL
)
const primaryDropletFill = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? getStroke(props.gameStates[0].hand[0])
    : MISSING_STROKE
)
const primaryStroke = computed(() => {
  if (!cursor.value || !props.gameStates || !props.gameStates[0].hand.length) {
    return MISSING_STROKE
  }
  const index = cursor.value.x1 + (cursor.value.y1 + GHOST_Y + 1) * WIDTH
  if (props.gameStates[0].screen.grid[index] === props.gameStates[0].hand[0]) {
    return 'white'
  }
  return getStroke(props.gameStates[0].hand[0])
})
const primaryDarkStroke = computed(() => {
  if (!props.gameStates) {
    return MISSING_STROKE
  } else if (props.gameStates[0].hand.length) {
    return getStroke(props.gameStates[0].hand[0], true)
  } else if (props.gameStates[0].preview.length) {
    return getStroke(props.gameStates[0].preview[0], true)
  }
  return MISSING_STROKE
})
const primarySymbol = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? panelSymbol(props.gameStates[0].hand[0])
    : MISSING_SYMBOL
)

const secondaryFill = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? getFill(props.gameStates[0].hand[1])
    : MISSING_FILL
)
const secondaryStroke = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? getStroke(props.gameStates[0].hand[1])
    : MISSING_STROKE
)
const secondaryDarkStroke = computed(() => {
  if (!props.gameStates) {
    return MISSING_STROKE
  } else if (props.gameStates[0].hand.length) {
    return getStroke(props.gameStates[0].hand[1], true)
  } else if (props.gameStates[0].preview.length) {
    return getStroke(props.gameStates[0].preview[1], true)
  }
  return MISSING_STROKE
})
const secondarySymbol = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? panelSymbol(props.gameStates[0].hand[1])
    : MISSING_SYMBOL
)

const cursorActive = computed(() => {
  if (!props.gameStates) {
    return false
  }
  return !props.gameStates[0].busy && !props.passing && props.countdown <= 0
})

watch(cursorActive, (newValue) => {
  if (newValue && !cursorVisible.value) {
    showHand.value = true
  }
})

function kickCursor() {
  if (!props.gameStates || !cursor.value) {
    return
  }
  let index = cursor.value.x1 + (cursorY.value + GHOST_Y + 1) * WIDTH
  while (props.gameStates[0].screen.grid[index] >= 0 && cursorY.value >= 0) {
    index -= WIDTH
    cursorY.value -= 1
  }
}

function lockCursor() {
  cursorLocked.value = true
  kickCursor()
}

function commitMove(x1: number, y1: number, orientation: number) {
  cursorLocked.value = false
  emit('commit', x1, y1 + GHOST_Y + 1, orientation, hardDrop.value)
}

const x1 = computed<number>(() => {
  if (!cursor.value) {
    return 2
  }
  return cursor.value.x1
})

const y1 = computed<number>(() => {
  if (!cursor.value) {
    return cursorY.value + GHOST_Y + 1
  }
  return cursor.value.y1 + GHOST_Y + 1
})

const x2 = computed<number>(() => {
  if (!cursor.value) {
    return 2
  }
  return cursor.value.x2
})

const y2 = computed<number>(() => {
  if (!cursor.value) {
    return HEIGHT - 2
  }
  return cursor.value.y2 + GHOST_Y + 1
})

const winDisplays = computed(() =>
  props.wins.map((win) => {
    if (win === 0.5) {
      return '½'
    } else if (win === Math.floor(win) + 0.5) {
      return `${Math.floor(win)}½`
    } else {
      return win.toString()
    }
  })
)

function showCursor() {
  cursorVisible.value = true
  showHand.value = false
}

defineExpose({ x1, y1, x2, y2 })
</script>

<template>
  <svg
    ref="svg"
    width="100%"
    height="100%"
    viewBox="0 0 21 16.5"
    xmlns="http://www.w3.org/2000/svg"
  >
    <SVGDefs />
    <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[0] : null"
        :fallMu="fallMu"
        :preIgnitions="cursorVisible ? preIgnitions : null"
        :chainCards="chainCards[0]"
        :wins="winDisplays[0]"
        :showHand="showHand"
        :timeout="timeouts[0]"
        :countdown="countdown"
      />
    </g>
    <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[1] : null"
        :fallMu="fallMu"
        :preIgnitions="null"
        :chainCards="chainCards[1]"
        :wins="winDisplays[1]"
        :showHand="true"
        :timeout="timeouts[1]"
        :countdown="countdown"
      />
    </g>
    <!--Opponent thinking indicator-->
    <use
      href="#thinking"
      :x="RIGHT_SCREEN_X + 0.5"
      :y="SCREEN_Y + 8"
      :opacity="opponentThinkingOpacity"
    ></use>
    <!--Names-->
    <template v-if="names.length">
      <clipPath id="left-name-clip">
        <rect :x="LEFT_SCREEN_X" :y="SCREEN_Y + VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
      </clipPath>
      <text
        class="name"
        :x="LEFT_SCREEN_X"
        :y="SCREEN_Y + VISIBLE_HEIGHT + 2"
        clip-path="url(#left-name-clip)"
      >
        {{ names[0] }}
      </text>

      <clipPath id="right-name-clip">
        <rect :x="RIGHT_SCREEN_X" :y="SCREEN_Y + VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
      </clipPath>
      <text
        class="name"
        :x="RIGHT_SCREEN_X"
        :y="SCREEN_Y + VISIBLE_HEIGHT + 2"
        clip-path="url(#right-name-clip)"
      >
        {{ names[1] }}
      </text>
    </template>
    <!--Timers-->
    <template v-if="timeDisplays.length">
      <text
        :class="{ score: true, danger: timeDangers[0] }"
        :x="LEFT_SCREEN_X + WIDTH + 0.5"
        :y="SCREEN_Y + VISIBLE_HEIGHT + 2"
      >
        {{ timeDisplays[0] }}
      </text>
      <text
        :class="{ score: true, danger: timeDangers[1] }"
        :x="RIGHT_SCREEN_X + WIDTH + 0.5"
        :y="SCREEN_Y + VISIBLE_HEIGHT + 2"
      >
        {{ timeDisplays[1] }}
      </text>
    </template>
    <g
      ref="cursorContainer"
      :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`"
      :stroke-width="STROKE_WIDTH"
    >
      <LockOrbitCursor
        v-if="CURSOR_TYPE === 'lock-orbit'"
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
        :visible="cursorVisible"
        @setY="(y) => (cursorY = y)"
        @lock="lockCursor"
        @unlock="cursorLocked = false"
        @commit="commitMove"
        @show="showCursor"
        @hide="cursorVisible = false"
      />
      <SnakeCursor
        v-else
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
        :active="cursorActive"
        :visible="cursorVisible"
        @commit="commitMove"
        @show="showCursor"
        @hide="cursorVisible = false"
      />
      <template v-if="cursorVisible">
        <circle
          r="0.26"
          :cx="x1 + 0.5"
          :cy="primaryDropletY - GHOST_Y - 0.5"
          :fill="primaryDropletFill"
          stroke="white"
          stroke-width="0.03"
          opacity="0.7"
        ></circle>
        <circle
          r="0.26"
          :cx="x2 + 0.5"
          :cy="secondaryDropletY - GHOST_Y - 0.5"
          :fill="secondaryStroke"
          stroke="white"
          stroke-width="0.03"
          opacity="0.7"
        ></circle>
      </template>
    </g>
    <g
      v-if="canPass !== null"
      :class="{ control: true, active: canPass, disabled: !canPass }"
      @mousedown.stop="pass"
      @touchstart.stop="pass"
    >
      <rect :x="LEFT_SCREEN_X + WIDTH + 2" :y="SCREEN_Y - 0.1" rx="0.1" width="1" height="2"></rect>
      <text class="pass" :y="SCREEN_Y + 0.5">
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5">P</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">a</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">s</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">s</tspan>
      </text>
    </g>
    <PlayingButton
      @mousedown.stop="hardDrop = !hardDrop"
      @touchstart.stop="hardDrop = !hardDrop"
      :class="{ active: hardDrop }"
      :x="LEFT_SCREEN_X + WIDTH + 0.4"
      :y="SCREEN_Y + 4.6"
      :width="3"
    >
      Hard Drop
    </PlayingButton>
    <g @mousedown.stop :transform="`translate(${CONTROLS_X}, ${CONTROLS_Y})`">
      <slot></slot>
    </g>
  </svg>
</template>

<style scoped>
svg {
  user-select: none;
}
.pass tspan {
  font:
    bold 0.45px 'Arial',
    sans-serif;
}
</style>
