<script setup lang="ts">
import {
  STROKE_WIDTH,
  getFill,
  getStroke,
  panelSymbol,
  type Chain,
  MISSING_FILL,
  MISSING_STROKE,
  MISSING_SYMBOL
} from '@/util'
import {
  WIDTH,
  type GameState,
  GHOST_Y,
  GARBAGE,
  HEIGHT,
  VISIBLE_HEIGHT,
  combinedGarbageDisplay
} from 'pujo-puyo-core'
import { computed, type SVGAttributes } from 'vue'
import ChainCard from './ChainCard.vue'

const props = defineProps<{
  gameState: GameState | null
  fallMu: number
  preIgnitions: boolean[] | null
  chainCards: Chain[]
  wins: number
}>()

const ghostAttrs = computed(() => {
  if (!props.gameState) {
    return []
  }
  const screen = props.gameState.screen
  const panels: SVGAttributes[] = []
  for (let index = WIDTH * GHOST_Y; index < WIDTH * (GHOST_Y + 1); ++index) {
    const x = (index % WIDTH) + 0.5
    let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5
    let stroke = getStroke(screen.grid[index])
    if (screen.falling[index]) {
      y += props.fallMu
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
  return panels
})

const panelAttrs = computed(() => {
  if (!props.gameState) {
    return []
  }
  const screen = props.gameState.screen
  const panels: SVGAttributes[] = []
  for (let index = WIDTH * (GHOST_Y + 1); index < WIDTH * HEIGHT; ++index) {
    const x = (index % WIDTH) + 0.5
    let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5
    let fill = getFill(screen.grid[index])
    let stroke = getStroke(screen.grid[index])
    if (screen.falling[index]) {
      y += props.fallMu
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
  return panels
})

const panelGlyphAttrs = computed(() => {
  if (!props.gameState) {
    return []
  }
  const screen = props.gameState.screen
  const glyphs: SVGAttributes[] = []
  for (let index = WIDTH * (GHOST_Y + 1); index < WIDTH * HEIGHT; ++index) {
    const x = (index % WIDTH) + 0.5
    let y = Math.floor(index / WIDTH) - GHOST_Y - 0.5
    let fill = getStroke(screen.grid[index])
    if (screen.falling[index]) {
      y += props.fallMu
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
  return glyphs
})

function garbageGlyph(symbol: string, late = false) {
  if (symbol === 'rock') {
    symbol = 'spade'
  } else if (symbol === 'crown') {
    symbol = 'diamond'
  }
  return {
    href: `#${symbol}`,
    fill: getFill(GARBAGE),
    stroke: getStroke(GARBAGE),
    'stroke-width': STROKE_WIDTH,
    opacity: late ? '0.5' : '1.0'
  }
}

const garbageGlyphs = computed(() => {
  if (!props.gameState) {
    return []
  }
  const { pending, late } = combinedGarbageDisplay(
    props.gameState.pendingGarbage,
    props.gameState.lateGarbage
  )
  return pending.map((s) => garbageGlyph(s)).concat(late.map((s) => garbageGlyph(s, true)))
})

function previewAttrs(mapping: (i: number) => string, fillValue: string) {
  let result: string[] = []
  if (props.gameState !== null) {
    result = props.gameState.preview.map(mapping)
  }
  while (result.length < 4) {
    result.push(fillValue)
  }
  return result
}

const previewFills = computed(() => previewAttrs((i) => getFill(i), MISSING_FILL))

const previewStrokes = computed(() => previewAttrs((i) => getStroke(i), MISSING_STROKE))

const previewSymbols = computed(() => previewAttrs((i) => panelSymbol(i), MISSING_SYMBOL))

const score = computed(() => (props.gameState ? props.gameState.score.toString() : '-'))
</script>

<template>
  <!--Assumes that defs are loaded somewhere-->

  <!--Ghost panels go behind the screens-->
  <use v-for="(attrs, i) in ghostAttrs" v-bind="attrs" :key="i"></use>
  <use href="#screen"></use>
  <use v-if="gameState && gameState.allClearBonus" href="#all-clear"></use>
  <!--Playing grid-->
  <use v-for="(attrs, i) in panelAttrs" v-bind="attrs" :key="i">
    <animate
      v-if="preIgnitions && preIgnitions[i]"
      attributeName="fill"
      values="#ffe;#bbb;#ffe"
      dur="1s"
      repeatCount="indefinite"
    ></animate>
  </use>
  <use v-for="(attrs, i) in panelGlyphAttrs" v-bind="attrs" :key="i"></use>
  <!--Chain indicators-->
  <ChainCard
    v-for="(card, i) in chainCards"
    :key="i"
    :x="card.x"
    :y="card.y"
    :number="card.number"
    :age="card.age"
  />
  <!--Game Over indicator-->
  <use v-if="gameState && gameState.lockedOut" href="#game-over"></use>
  <!--Garbage queue-->
  <use v-for="(attrs, i) in garbageGlyphs" :key="i" v-bind="attrs" :x="i + 0.5" y="-1"></use>

  <!--Piece preview-->
  <g :stroke-width="STROKE_WIDTH">
    <use
      href="#panel0"
      y="1.5"
      :x="WIDTH + 1"
      :fill="previewFills[0]"
      :stroke="previewStrokes[0]"
    ></use>
    <use
      y="1.5"
      :x="WIDTH + 1"
      :href="previewSymbols[0]"
      :fill="previewStrokes[0]"
      stroke="none"
    ></use>

    <use
      href="#panel0"
      y="0.5"
      :x="WIDTH + 1"
      :fill="previewFills[1]"
      :stroke="previewStrokes[1]"
    ></use>
    <use
      y="0.5"
      :x="WIDTH + 1"
      :href="previewSymbols[1]"
      :fill="previewStrokes[1]"
      stroke="none"
    ></use>

    <use
      href="#panel0"
      y="3.7"
      :x="WIDTH + 1.5"
      :fill="previewFills[2]"
      :stroke="previewStrokes[2]"
    ></use>
    <use
      y="3.7"
      :x="WIDTH + 1.5"
      :href="previewSymbols[2]"
      :fill="previewStrokes[2]"
      stroke="none"
    ></use>

    <use
      href="#panel0"
      y="2.7"
      :x="WIDTH + 1.5"
      :fill="previewFills[3]"
      :stroke="previewStrokes[3]"
    ></use>
    <use
      y="2.7"
      :x="WIDTH + 1.5"
      :href="previewSymbols[3]"
      :fill="previewStrokes[3]"
      stroke="none"
    ></use>
  </g>
  <!--Score-->
  <text :y="VISIBLE_HEIGHT + 1">
    <tspan class="score-label">Score:</tspan>
    <tspan class="score">{{ score }}</tspan>
  </text>
  <!--Win counter-->
  <use href="#trophy" x="-0.7" y="10.8"></use>
  <text class="score" text-anchor="center" :x="-0.9" :y="12">
    {{ wins }}
  </text>
</template>
