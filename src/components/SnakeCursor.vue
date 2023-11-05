<script setup lang="ts">
import { GHOST_Y, VISIBLE_HEIGHT, WIDTH } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type Coords = {
  x: number
  y: number
}

const EPSILON = 1e-4

const FINE_TUNE_FACTOR = 0.5

const props = defineProps<{
  svg: SVGSVGElement | null
  container: SVGGraphicsElement | null
  primaryFill: string
  primaryStroke: string
  primaryDarkStroke: string
  primarySymbol: string
  secondaryFill: string
  secondaryStroke: string
  secondaryDarkStroke: string
  secondarySymbol: string
  active: boolean
  visible: boolean
}>()

const emit = defineEmits(['commit', 'show', 'hide'])

let actuallyActive = true

const x = ref(1)
const y = ref(2)
const prevXs = [1, 1, 1, 1]
const prevYs = [1.9, 1.8, 1.7, 1.6]
const secondaryX = ref(1)
const secondaryY = ref(1)

let fineTuning = false
let fineTuneX = 1
let fineTuneY = 1

const orientation = computed(() => {
  const dx = secondaryX.value - x.value
  const dy = secondaryY.value - y.value
  if (Math.abs(dx) < Math.abs(dy)) {
    if (dy < 0) {
      return 0
    }
    return 2
  }
  if (dx < 0) {
    return 1
  }
  return 3
})

const x1 = computed(() => {
  const value = Math.max(0, Math.min(WIDTH - 1, Math.floor(x.value)))
  if (value === 0 && orientation.value === 1) {
    return value + 1
  }
  if (value === WIDTH - 1 && orientation.value === 3) {
    return value - 1
  }
  return value
})
const y1 = computed(() => Math.max(-1, Math.min(VISIBLE_HEIGHT - 1, Math.floor(y.value))))
const x2 = computed(() => {
  if (orientation.value === 1) {
    return x1.value - 1
  } else if (orientation.value === 3) {
    return x1.value + 1
  }
  return x1.value
})
const y2 = computed(() => {
  if (orientation.value === 0) {
    return y1.value - 1
  } else if (orientation.value === 2) {
    return y1.value + 1
  }
  return y1.value
})

watch(
  () => props.active,
  (newValue) => {
    if (newValue) {
      actuallyActive = true
    }
  }
)

function yankSecondary() {
  const dx = x.value - secondaryX.value
  const dy = y.value - secondaryY.value
  const d = Math.hypot(dx, dy)
  if (d > EPSILON) {
    secondaryX.value = x.value - dx / d
    secondaryY.value = y.value - dy / d
  }
}

// Set primary coordinates and make the secondary ball follow with heavy damping.
function setCoords(coords: Coords) {
  for (let i = prevXs.length - 1; i > 0; --i) {
    prevXs[i] = prevXs[i - 1]
    prevYs[i] = prevYs[i - 1]
  }
  prevXs[0] = x.value
  prevYs[0] = y.value

  if (fineTuning) {
    const dfx = coords.x - fineTuneX
    const dfy = coords.y - fineTuneY
    x.value = fineTuneX + dfx * FINE_TUNE_FACTOR
    y.value = fineTuneY + dfy * FINE_TUNE_FACTOR
  } else {
    x.value = coords.x
    y.value = coords.y
  }

  x.value = Math.max(0, Math.min(WIDTH, x.value))
  y.value = Math.max(0, Math.min(VISIBLE_HEIGHT, y.value))

  // Estimate travelling direction
  const dx = 18 * x.value - 6 * prevXs[0] - 5 * prevXs[1] - 4 * prevXs[2] - 3 * prevXs[3]
  const dy = 18 * y.value - 6 * prevYs[0] - 5 * prevYs[1] - 4 * prevYs[2] - 3 * prevYs[3]
  const d = Math.hypot(dx, dy)

  if (d > EPSILON) {
    // Follow behind with damping
    secondaryX.value = secondaryX.value * 0.7 + (x.value - dx / d) * 0.3
    secondaryY.value = secondaryY.value * 0.7 + (y.value - dy / d) * 0.3

    // Yank to range
    yankSecondary()
  }
}

let pt: DOMPoint | null = null

function containerCoords(x: number, y: number) {
  if (props.svg === null || props.container === null) {
    return
  }
  if (pt === null) {
    pt = props.svg.createSVGPoint()
  }
  pt.x = x
  pt.y = y
  return pt.matrixTransform(props.container.getScreenCTM()?.inverse())
}

function commitMove(hide = true) {
  if (props.active && actuallyActive) {
    emit('commit', x1.value, y1.value + GHOST_Y + 1, orientation.value)
    if (hide) {
      emit('hide')
    }
    // Because emits take a tick to make the round trip we need this silly failsafe
    actuallyActive = false
  }
  fineTuning = false
}

function onMouseDown(event: MouseEvent) {
  const coords = containerCoords(event.x, event.y)
  if (coords === undefined) {
    return
  }
  setCoords(coords)
  if (props.active && actuallyActive) {
    emit('show')
    fineTuning = true
    fineTuneX = coords.x
    fineTuneY = coords.y
  }
}

function onMouseMove(event: MouseEvent) {
  const coords = containerCoords(event.x, event.y)
  if (coords === undefined) {
    return
  }
  setCoords(coords)
  if (props.active && actuallyActive) {
    emit('show')
  }
}

function onMouseUp(event: MouseEvent) {
  const coords = containerCoords(event.x, event.y)
  if (coords === undefined) {
    return
  }
  setCoords(coords)
  commitMove()
}

let firstTouchIdentifier: number | null = null

function onTouchStart(event: TouchEvent) {
  for (const touch of event.changedTouches) {
    const coords = containerCoords(touch.clientX, touch.clientY)
    if (coords === undefined) {
      return
    }

    if (coords.x > -2 && coords.x < WIDTH + 2) {
      firstTouchIdentifier = touch.identifier
      event.preventDefault()

      setCoords(coords)
      if (props.active && actuallyActive) {
        emit('show')
      }
      return
    }
  }
}

function onTouchMove(event: TouchEvent) {
  let touch: Touch | undefined
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === firstTouchIdentifier) {
      touch = event.changedTouches[i]
      break
    }
  }
  if (!touch) {
    return
  }

  const coords = containerCoords(touch.clientX, touch.clientY)
  if (coords === undefined) {
    return
  }

  setCoords(coords)
  if (props.active && actuallyActive) {
    emit('show')
  }
}

function onTouchEnd(event: TouchEvent) {
  let touch: Touch | undefined
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === firstTouchIdentifier) {
      touch = event.changedTouches[i]
      break
    }
  }
  if (!touch) {
    return
  }

  firstTouchIdentifier = null

  const coords = containerCoords(touch.clientX, touch.clientY)
  if (coords === undefined) {
    return
  }

  setCoords(coords)
  commitMove()
}

function onTouchCancel(event: TouchEvent) {
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === firstTouchIdentifier) {
      firstTouchIdentifier = null
      emit('hide')
      return
    }
  }
}

let slowMode = false
let velocityX = 0
let velocityY = 0
let velocityTheta = 0

let frameId: number | null = null
let lastTime: DOMHighResTimeStamp | null = null
function draw(time: DOMHighResTimeStamp) {
  let dt = 0
  if (lastTime !== null) {
    dt = time - lastTime
  }
  lastTime = time

  if (velocityX || velocityY) {
    const v = slowMode ? 2e-3 : 12e-3
    setCoords({
      x: x.value + dt * velocityX * v,
      y: y.value + dt * velocityY * v
    })
  }

  if (velocityTheta) {
    const v = slowMode ? 2e-2 : 12e-2
    const dx = secondaryX.value - x.value
    const dy = secondaryY.value - y.value
    secondaryX.value += dy * velocityTheta * v
    secondaryY.value -= dx * velocityTheta * v
    yankSecondary()
  }

  frameId = window.requestAnimationFrame(draw)
}

const ARROW_KEYS = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']
const WASD_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD']

function onKeyDown(event: KeyboardEvent) {
  const code = event.code
  if (
    code === 'Space' ||
    code === 'KeyJ' ||
    code === 'KeyK' ||
    ARROW_KEYS.includes(code) ||
    WASD_KEYS.includes(code)
  ) {
    event.preventDefault()
    emit('show')
    if (code === 'Space') {
      slowMode = true
    }
    if (code === 'ArrowUp' || code === 'KeyW') {
      velocityY = -1
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      velocityY = 1
    }
    if (code === 'ArrowLeft' || code === 'KeyA') {
      velocityX = -1
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      velocityX = 1
    }

    if (code === 'KeyJ') {
      velocityTheta = 1
    }
    if (code === 'KeyK') {
      velocityTheta = -1
    }
  }
}

function onKeyUp(event: KeyboardEvent) {
  const code = event.code
  if (event.code === 'Space') {
    commitMove(false)
    slowMode = false
  }
  if (code === 'ArrowUp' || code === 'KeyW') {
    velocityY = 0
  }
  if (code === 'ArrowDown' || code === 'KeyS') {
    velocityY = 0
  }
  if (code === 'ArrowLeft' || code === 'KeyA') {
    velocityX = 0
  }
  if (code === 'ArrowRight' || code === 'KeyD') {
    velocityX = 0
  }
  if (code === 'KeyJ') {
    velocityTheta = 0
  }
  if (code === 'KeyK') {
    velocityTheta = 0
  }
}

watch(
  () => props.svg,
  (newValue) => {
    if (newValue !== null) {
      newValue.addEventListener('mousedown', onMouseDown)

      newValue.addEventListener('touchstart', onTouchStart)
      newValue.addEventListener('touchmove', onTouchMove)
      newValue.addEventListener('touchend', onTouchEnd)
      newValue.addEventListener('touchcancel', onTouchCancel)
    }
  },
  { immediate: true }
)

onMounted(() => {
  emit('hide')
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)

  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)

  if (props.svg) {
    props.svg.removeEventListener('mousedown', onMouseDown)

    props.svg.removeEventListener('touchstart', onTouchStart)
    props.svg.removeEventListener('touchmove', onTouchMove)
    props.svg.removeEventListener('touchend', onTouchEnd)
    props.svg.removeEventListener('touchcancel', onTouchCancel)
  }

  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
  }
})

defineExpose({ x1, y1, x2, y2 })
</script>
<template xmlns="http://www.w3.org/2000/svg">
  <template v-if="visible">
    <circle
      :cx="secondaryX"
      :cy="secondaryY"
      r="0.43"
      :fill="secondaryFill"
      :stroke="secondaryStroke"
    ></circle>
    <use :x="secondaryX" :y="secondaryY" :href="secondarySymbol" :fill="secondaryStroke"></use>
    <circle :cx="x" :cy="y" r="0.43" :fill="primaryFill" :stroke="primaryStroke"></circle>
    <use :x="x" :y="y" :href="primarySymbol" :fill="primaryStroke"></use>
  </template>
</template>

<style scoped>
circle {
  stroke-width: 0.1;
}
</style>
