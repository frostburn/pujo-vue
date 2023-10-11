<script setup lang="ts">
import { GHOST_Y, type GameState, VISIBLE_HEIGHT, WIDTH } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import SVGDefs from './SVGDefs.vue'
import PlayingCursor from './PlayingCursor.vue'
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
  SCREEN_Y
} from '@/util'
import PlayingButton from './PlayingButton.vue'
import type { Chain } from '@/chain-deck'

const props = defineProps<{
  gameStates: GameState[] | null
  chainCards: Chain[][]
  wins: number[]
  canPass: boolean
  passing: boolean
  canRequeue: boolean
  fallMu: number
  opponentThinkingOpacity: number
  justPassed: boolean
  primaryDropletY: number
  secondaryDropletY: number
  preIgnitions: boolean[]
}>()

const emit = defineEmits(['pass', 'commit', 'requeue'])

const CONTROLS_X = RIGHT_SCREEN_X + WIDTH + 1
const CONTROLS_Y = SCREEN_Y + 5

const svg = ref<SVGSVGElement | null>(null)
const cursorContainer = ref<SVGGraphicsElement | null>(null)
const cursor = ref<typeof PlayingCursor | null>(null)

const cursorLocked = ref(false)
const cursorY = ref(1)

// User interaction.

function pass() {
  if (!props.canPass) {
    return
  }
  emit('pass')
}

function passOnEscape(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    pass()
  }
}

onMounted(() => {
  document.addEventListener('keydown', passOnEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', passOnEscape)
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
  const index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
  if (props.gameStates[0].screen.grid[index] === props.gameStates[0].hand[0]) {
    return 'white'
  }
  return getStroke(props.gameStates[0].hand[0])
})
const primaryDarkStroke = computed(() =>
  props.gameStates && props.gameStates[0].preview.length
    ? getStroke(props.gameStates[0].preview[0], true)
    : MISSING_STROKE
)
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
const secondaryDarkStroke = computed(() =>
  props.gameStates && props.gameStates[0].preview.length
    ? getStroke(props.gameStates[0].preview[1], true)
    : MISSING_STROKE
)
const secondarySymbol = computed(() =>
  props.gameStates && props.gameStates[0].hand.length
    ? panelSymbol(props.gameStates[0].hand[1])
    : MISSING_SYMBOL
)

const cursorActive = computed(() =>
  props.gameStates ? !props.gameStates[0].busy && !props.passing : false
)

function kickCursor() {
  if (!props.gameStates || !cursor.value) {
    return
  }
  let index = cursor.value.x + (cursorY.value + GHOST_Y + 1) * WIDTH
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
  emit('commit', x1, y1, orientation)
}

function requeue() {
  if (props.canRequeue) {
    emit('requeue')
  }
}

const x1 = computed<number>(() => {
  if (!cursor.value) {
    return 2
  }
  return cursor.value.x
})

const x2 = computed<number>(() => {
  if (!cursor.value) {
    return 2
  }
  return cursor.value.snapX
})

const y2 = computed<number>(() => {
  if (!cursor.value) {
    return VISIBLE_HEIGHT - 2
  }
  return cursor.value.snapY
})

defineExpose({ x1, y1: cursorY, x2, y2 })
</script>

<template>
  <svg ref="svg" width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[0] : null"
        :fallMu="fallMu"
        :preIgnitions="preIgnitions"
        :chainCards="chainCards[0]"
        :wins="wins[0]"
      />
    </g>
    <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[1] : null"
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
    <g :class="{ control: true, active: canPass }" @mousedown.stop @click="pass">
      <rect :x="LEFT_SCREEN_X + WIDTH + 2" :y="SCREEN_Y - 0.1" rx="0.1" width="1" height="2"></rect>
      <text class="pass" :y="SCREEN_Y + 0.5">
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5">P</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">a</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">s</tspan>
        <tspan :x="LEFT_SCREEN_X + WIDTH + 2.5" dy="0.35">s</tspan>
      </text>
    </g>
    <g @mousedown.stop>
      <PlayingButton
        :class="{ active: canRequeue }"
        @click.stop="requeue"
        :x="CONTROLS_X"
        :y="CONTROLS_Y"
        text="Requeue"
      />
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
