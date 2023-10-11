<script setup lang="ts">
import { WIDTH, type ReplayTrack } from 'pujo-puyo-core'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  track: ReplayTrack
  time: number
}>()

const track = [...props.track]

const COLOR_CLASSES = ['red', 'green', 'yellow', 'blue', 'purple']
const TIME_SCALE = 3

const duration = Math.max(...track.map((i) => i.time))

const height = duration * TIME_SCALE + 38

const panels: { class: string; style: string }[] = []
const nuisances: { style: string }[] = []
const scores: { style: string; spans: { class: string; content: string }[] }[] = []
const chains: { style: string; content: string }[] = []

const garbageTimeOffset = [0, 0]

function timeToTop(t: number) {
  return (duration - t) * TIME_SCALE + 17
}

for (const item of track) {
  const t = timeToTop(item.time)
  const offset = 1 + 90 * item.player
  if (item.type === 'move') {
    let y1 = 5
    let y2 = 5
    if (item.y1 > item.y2) {
      y1 = 10
      y2 = 0
    } else if (item.y1 < item.y2) {
      y1 = 0
      y2 = 10
    }
    panels.push({
      class: `panel ${COLOR_CLASSES[item.color1]} ${item.triggers1 ? 'trigger' : ''}`,
      style: `left: ${offset + item.x1 * 10}px; top: ${t + y1}px`
    })
    panels.push({
      class: `panel ${COLOR_CLASSES[item.color2]} ${item.triggers2 ? 'trigger' : ''}`,
      style: `left: ${offset + item.x2 * 10}px; top: ${t + y2}px`
    })
  }
  if (item.type === 'bag') {
    let i = 0
    for (const color of item.bag) {
      const x = Math.floor(0.5 * i)
      const y = 1 - (i % 2)
      panels.push({
        class: `panel ${COLOR_CLASSES[color]} bag`,
        style: `left: ${offset + 5 + x * 20}px; top: ${t + y * 10 - 15 - x}px`
      })
      i++
    }
  }
  if (item.type === 'garbage') {
    for (const x of item.columns) {
      nuisances.push({
        style: `left: ${offset + 10 * x}px; top: ${t + garbageTimeOffset[item.player]}px`
      })
    }
    garbageTimeOffset[item.player] -= 10 - TIME_SCALE
  } else {
    garbageTimeOffset[item.player] = 0
  }
  if (item.type === 'score') {
    const spans: { class: string; content: string }[] = []
    const score = item.score.toString()
    let n = 0
    for (const color of item.colors) {
      const nextN = n + score.length / item.colors.length
      spans.push({
        class: `score-tick ${COLOR_CLASSES[color]}`,
        content: score.substring(Math.floor(n), Math.floor(nextN))
      })
      n = nextN
    }
    scores.push({
      style: `left: ${offset}px; top: ${t}px`,
      spans
    })
  }
  if (item.type === 'chain') {
    chains.push({
      style: `left: ${offset}px; top: ${t + 12}px`,
      content: `${item.number}-chain ${item.allClear ? 'AC' : ''}`
    })
  }
  if (item.type === 'lockout') {
    chains.push({
      style: `left: ${offset + 3}px; top: ${t}px`,
      content: 'Lockout'
    })
  }
  if (item.type === 'result') {
    chains.push({
      style: `left: ${offset + 10}px; top: ${t - 15}px`,
      content: item.result
    })
  }
}

const playhead = ref<HTMLDivElement | null>(null)
function scrollToPlayhead() {
  if (playhead.value) {
    playhead.value.scrollIntoView({
      block: 'center'
    })
  }
}
watch(() => props.time, scrollToPlayhead)

onMounted(scrollToPlayhead)
</script>
<template>
  <div class="track-container">
    <div
      v-for="i of WIDTH + 1"
      :key="i"
      class="grid-line"
      :style="`left: ${(i - 1) * 10 + 0.5}px; height: ${height}px;`"
    ></div>
    <div
      v-for="i of WIDTH + 1"
      :key="i"
      class="grid-line"
      :style="`left: ${90 + (i - 1) * 10 + 0.5}px; height: ${height}px;`"
    ></div>
    <div class="divider" :style="`height: ${height}px`"></div>
    <div v-for="(attrs, i) of panels" :key="i" v-bind="attrs"></div>
    <div v-for="(attrs, i) of nuisances" :key="i" class="nuisance" v-bind="attrs"></div>
    <div v-for="(score, i) of scores" :key="i" :style="score.style">
      <span v-for="(span, j) of score.spans" :key="j" :class="span.class">{{ span.content }}</span>
    </div>
    <div v-for="(chain, i) of chains" :key="i" :style="chain.style">
      <span class="chain-label">{{ chain.content }}</span>
    </div>
    <div ref="playhead" class="playhead" :style="`top: ${timeToTop(time) + 10}px`"></div>
  </div>
</template>
<style scoped>
.track-container {
  width: 170px;
  position: relative;
}
.track-container * {
  position: absolute;
}
.playhead {
  width: 155px;
  height: 1px;
  background-color: silver;
}
.track-container div span {
  font-weight: bold;
  position: relative;
}
.score-tick {
  color: black;
}
.chain-label {
  font-size: 0.8em;
  color: white;
}
.divider {
  width: 1px;
  left: 75px;
  background-color: white;
}
.grid-line {
  width: 1px;
  background-color: #333;
}
.panel {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.trigger {
  border: 1px solid white;
}
.bag {
  opacity: 50%;
}
.red {
  background-color: #d22;
}
.green {
  background-color: #2d2;
}
.yellow {
  background-color: #dd2;
}
.blue {
  background-color: #22e;
}
.purple {
  background-color: #d2c;
}
.nuisance {
  width: 9px;
  height: 9px;
  border-radius: 100%;
  background-color: rgba(30, 255, 255, 0.94);
}
</style>
