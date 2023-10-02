<script setup lang="ts">
import { GHOST_Y, VISIBLE_HEIGHT, WIDTH } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Please note that orbit distances less than 0.5 would need updates to the second panel during cursor movement.
const MIN_ORBIT_DISTANCE = 0.5
const MAX_ORBIT_DISTANCE = 6.5

type Coords = {
  x: number
  y: number
}

const props = defineProps<{
  svg: SVGSVGElement | null
  container: SVGGraphicsElement | null
  primaryFill: string
  primaryStroke: string
  primarySymbol: string
  secondaryFill: string
  secondaryStroke: string
  secondarySymbol: string
  y: number
  locked: boolean
  active: boolean
}>()

const emit = defineEmits(['setY', 'lock', 'unlock', 'commit'])

const x = ref(1)
const dx = ref(0)
const dy = ref(-1)

// Silly linter, you know nothing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const snapX = computed(() => (Math.abs(dy.value) === 1 ? x.value : x.value + dx.value))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const snapY = computed(() => (Math.abs(dy.value) === 1 ? props.y + dy.value : props.y))

const orientation = computed(() => {
  if (dy.value === -1) {
    return 0
  }
  if (dy.value === 1) {
    return 2
  }
  if (dx.value === -1) {
    return 1
  }
  if (dx.value === 1) {
    return 3
  }
  return 0
})

let pt: DOMPoint | null = null

function containerCoords(event: MouseEvent) {
  if (props.svg === null || props.container === null) {
    return
  }
  if (pt === null) {
    pt = props.svg.createSVGPoint()
  }
  pt.x = event.x
  pt.y = event.y
  return pt.matrixTransform(props.container.getScreenCTM()?.inverse())
}

function setPrimaryCoords(coords: Coords) {
  x.value = Math.max(0, Math.min(WIDTH - 1, Math.floor(coords.x)))
  emit('setY', Math.max(-1, Math.min(VISIBLE_HEIGHT - 1, Math.floor(coords.y))))
}

function orbitSecondPanel(coords: Coords) {
  const deltaX = coords.x - x.value - 0.5
  const deltaY = coords.y - props.y - 0.5
  const distance = Math.hypot(deltaX, deltaY)
  if (distance > MAX_ORBIT_DISTANCE) {
    unlockPrimary(coords)
  } else if (distance > MIN_ORBIT_DISTANCE) {
    dx.value = deltaX
    dy.value = deltaY
    // The orbit is square so this is not Euclidean
    if (Math.abs(dx.value) > Math.abs(dy.value)) {
      dy.value /= Math.abs(dx.value)
      dx.value = Math.sign(dx.value)
    } else {
      dx.value /= Math.abs(dy.value)
      dy.value = Math.sign(dy.value)
    }

    // Don't orbit beyond the screen horizontally
    if (x.value + dx.value < 0 || x.value + dx.value >= WIDTH) {
      dy.value = Math.sign(dy.value) || 1
    }
    // Exceeding the screen vertically is fine due to gravity
  }
}

function onMouseMove(event: MouseEvent) {
  const coords = containerCoords(event)
  if (coords === undefined) {
    return
  }

  if (props.locked) {
    orbitSecondPanel(coords)
  } else {
    setPrimaryCoords(coords)
  }
}

function lockPrimary(event: MouseEvent) {
  if (props.locked || event.button !== 0 || !props.active) {
    return
  }
  const coords = containerCoords(event)
  if (coords === undefined) {
    return
  }
  setPrimaryCoords(coords)
  emit('lock')
}

function unlockPrimary(coords: Coords) {
  emit('unlock')
  dx.value = 0
  dy.value = -1
  setPrimaryCoords(coords)
}

function commitMove(event: MouseEvent) {
  if (!props.locked || event.button !== 0 || !props.active) {
    return
  }
  const coords = containerCoords(event)
  if (coords === undefined) {
    return
  }
  emit('commit', x.value, props.y + GHOST_Y + 1, orientation.value)
  dx.value = 0
  dy.value = -1
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)

  // TODO: Limit to SVG element
  document.addEventListener('mousedown', lockPrimary)
  document.addEventListener('mouseup', commitMove)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)

  document.removeEventListener('mousedown', lockPrimary)
  document.removeEventListener('mouseup', commitMove)
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pFill = computed(() => (!props.active || !props.locked ? 'none' : props.primaryFill))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pStroke = computed(() => (props.active ? props.primaryStroke : 'gray'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pSymbolFill = computed(() => (props.locked ? props.primaryStroke : 'none'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pStrokeWidth = computed(() => (props.active ? '' : '0.05'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sStroke = computed(() => (props.active ? props.secondaryStroke : 'gray'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sStrokeWidth = computed(() => (props.active ? '0.1' : '0.03'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sSymbolFill = computed(() => (props.active ? props.secondaryStroke : 'none'))

defineExpose({ x, snapX, snapY })
</script>
<template xmlns="http://www.w3.org/2000/svg">
  <use
    :x="x + 0.5"
    :y="y + 0.5"
    href="#panel0"
    :fill="pFill"
    :stroke="pStroke"
    :stroke-width="pStrokeWidth"
  ></use>
  <use :x="x + 0.5" :y="y + 0.5" :href="primarySymbol" :fill="pSymbolFill"></use>

  <use
    :x="x + dx + 0.5"
    :y="y + dy + 0.5"
    href="#panel0"
    fill="none"
    :stroke="sStroke"
    :stroke-width="sStrokeWidth"
  ></use>
  <use :x="snapX + 0.5" :y="snapY + 0.5" :href="secondarySymbol" :fill="sSymbolFill"></use>
</template>
