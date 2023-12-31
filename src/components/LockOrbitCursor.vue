<script setup lang="ts">
import { VISIBLE_HEIGHT, WIDTH } from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'

// Please note that orbit distances less than 0.5 would need updates to the second panel during cursor movement.
const MIN_ORBIT_DISTANCE = 0.6
const MAX_ORBIT_DISTANCE = 7

type Coords = {
  x: number
  y: number
}

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
  y: number
  locked: boolean
  active: boolean
  visible: boolean
}>()

const emit = defineEmits(['setY', 'lock', 'unlock', 'commit', 'hide', 'show'])

const x = ref(1)
const dx = ref(0)
const dy = ref(-1)
const wantsToRotate = ref(false)

const y1 = computed(() => props.y)
const x2 = computed(() => (Math.abs(dy.value) === 1 ? x.value : x.value + dx.value))
const y2 = computed(() => (Math.abs(dy.value) === 1 ? props.y + dy.value : props.y))

const orientation = computed({
  get() {
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
  },
  set(newValue) {
    newValue &= 3
    if (newValue === 0) {
      dx.value = 0
      dy.value = -1
    }
    if (newValue === 1) {
      dx.value = -1
      dy.value = 0
    }
    if (newValue === 2) {
      dx.value = 0
      dy.value = 1
    }
    if (newValue === 3) {
      dx.value = 1
      dy.value = 0
    }
  }
})

let pt: DOMPoint | null = null

function containerCoords(x: number, y: number) {
  if (props.svg === null || props.container === null) {
    throw new Error('Missing containing element')
  }
  if (pt === null) {
    pt = props.svg.createSVGPoint()
  }
  pt.x = x
  pt.y = y
  const ctm = props.container.getScreenCTM()
  if (!ctm) {
    throw new Error('Unable to calculate coordinates')
  }
  return pt.matrixTransform(ctm.inverse())
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
  emit('show')
  const coords = containerCoords(event.x, event.y)

  if (props.locked) {
    orbitSecondPanel(coords)
  } else {
    setPrimaryCoords(coords)
  }
}

function lockPrimary() {
  if (props.locked || !props.active) {
    return
  }
  emit('lock')
}

function unlockPrimary(coords: Coords) {
  emit('unlock')
  dx.value = 0
  dy.value = -1
  setPrimaryCoords(coords)
}

function commitMove() {
  if (!props.locked || !props.active) {
    return
  }
  emit('commit', x.value, props.y, orientation.value)
  dx.value = 0
  dy.value = -1
  wantsToRotate.value = false
}

function kickCursor() {
  if (x.value < 0 || x2.value < 0) {
    if (props.locked) {
      return true
    }
    x.value++
  }
  if (x.value >= WIDTH || x2.value >= WIDTH) {
    if (props.locked) {
      return true
    }
    x.value--
  }
  if (props.y >= VISIBLE_HEIGHT || y2.value >= VISIBLE_HEIGHT) {
    if (props.locked) {
      return true
    }
    emit('setY', props.y - 1)
  }
  return false
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0 || props.locked || !props.active) {
    return
  }
  emit('show')
  const coords = containerCoords(event.x, event.y)
  setPrimaryCoords(coords)
  lockPrimary()
  nextTick(() => orbitSecondPanel(coords))
}

function onMouseUp(event: MouseEvent) {
  if (event.button !== 0 || !props.locked || !props.active) {
    return
  }
  const coords = containerCoords(event.x, event.y)
  orbitSecondPanel(coords)
  commitMove()
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
  }
  if (code === 'Space' && !event.repeat && !props.locked && props.active) {
    lockPrimary()
  }
  // Moving and even rotating an inactive cursor is not so bad when done using the keyboard.
  if (props.locked) {
    if (ARROW_KEYS.includes(code) || WASD_KEYS.includes(code)) {
      emit('unlock')
    }
  } else {
    if ((code === 'ArrowUp' || code === 'KeyW') && props.y >= 0 && y2.value >= 0) {
      emit('setY', props.y - 1)
    }
    if (
      (code === 'ArrowDown' || code === 'KeyS') &&
      props.y < VISIBLE_HEIGHT - 1 &&
      y2.value < VISIBLE_HEIGHT - 1
    ) {
      emit('setY', props.y + 1)
    }
    if ((code === 'ArrowLeft' || code === 'KeyA') && x.value > 0 && x2.value > 0) {
      x.value--
    }
    if ((code === 'ArrowRight' || code === 'KeyD') && x.value < WIDTH - 1 && x2.value < WIDTH - 1) {
      x.value++
    }
  }
  if (code === 'KeyJ') {
    orientation.value++
    if (kickCursor()) {
      if (wantsToRotate.value) {
        wantsToRotate.value = false
        orientation.value++
        if (kickCursor()) {
          orientation.value++
        }
      } else {
        wantsToRotate.value = true
        orientation.value--
      }
    }
  }
  if (code === 'KeyK') {
    orientation.value--
    if (kickCursor()) {
      if (wantsToRotate.value) {
        wantsToRotate.value = false
        orientation.value--
        if (kickCursor()) {
          orientation.value--
        }
      } else {
        wantsToRotate.value = true
        orientation.value++
      }
    }
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    commitMove()
  }
}

let lockingTouchIdentifier: number | null = null

function onTouchStart(event: TouchEvent) {
  if (props.locked || !props.active) {
    return
  }

  for (const touch of event.changedTouches) {
    const coords = containerCoords(touch.clientX, touch.clientY)
    if (coords.x > -2 && coords.x < WIDTH + 2) {
      lockingTouchIdentifier = touch.identifier
      event.preventDefault()
      setPrimaryCoords(coords)
      lockPrimary()
      nextTick(() => orbitSecondPanel(coords))
      emit('show')
      return
    }
  }
}

function onTouchMove(event: TouchEvent) {
  let touch: Touch | undefined
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === lockingTouchIdentifier) {
      touch = event.changedTouches[i]
      break
    }
  }
  if (!touch) {
    return
  }

  emit('show')

  const coords = containerCoords(touch.clientX, touch.clientY)

  if (props.locked) {
    orbitSecondPanel(coords)
  } else {
    setPrimaryCoords(coords)
  }
}

function onTouchEnd(event: TouchEvent) {
  // No mouse emulation please
  if (event.cancelable) {
    event.preventDefault()
  }

  let touch: Touch | undefined
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === lockingTouchIdentifier) {
      touch = event.changedTouches[i]
      break
    }
  }
  if (!touch) {
    return
  }

  if (!props.locked || !props.active) {
    return
  }
  const coords = containerCoords(touch.clientX, touch.clientY)
  orbitSecondPanel(coords)
  commitMove()
  lockingTouchIdentifier = null
  emit('hide')
}

function onTouchCancel(event: TouchEvent) {
  for (let i = 0; i < event.changedTouches.length; ++i) {
    if (event.changedTouches[i].identifier === lockingTouchIdentifier) {
      lockingTouchIdentifier = null
      emit('hide')
      return
    }
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
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
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
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pFill = computed(() => (!props.active || !props.locked ? 'none' : props.primaryFill))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pStroke = computed(() => (props.active ? props.primaryStroke : props.primaryDarkStroke))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pSymbolFill = computed(() => (props.locked ? props.primaryStroke : 'none'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pStrokeWidth = computed(() => (props.active ? '' : '0.05'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sStroke = computed(() => (props.active ? props.secondaryStroke : props.secondaryDarkStroke))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sStrokeWidth = computed(() => (props.active ? '0.1' : '0.03'))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sSymbolFill = computed(() => (props.active ? props.secondaryStroke : 'none'))

defineExpose({ x1: x, y1, x2, y2 })
</script>
<template xmlns="http://www.w3.org/2000/svg">
  <template v-if="visible">
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
    <use :x="x2 + 0.5" :y="y2 + 0.5" :href="secondarySymbol" :fill="sSymbolFill"></use>
  </template>
</template>
