<script setup lang="ts">
import { WIDTH, type TrackItem } from 'pujo-puyo-core'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  track: TrackItem[]
  time: number
  width: number
  units: string
}>()

const COLOR_CLASSES = ['red', 'green', 'yellow', 'blue', 'purple']
const TIME_SCALE = 3

const duration = computed(() => Math.max(...props.track.map((i) => i.time)))
const height = computed(
  () => `${((duration.value * TIME_SCALE + 80) / 170) * props.width}${props.units}`
)
const blockWidth = computed(() => props.width / 17)

function timeToTop(t: number) {
  return (((duration.value - t) * TIME_SCALE + 50) / 10) * blockWidth.value
}

const container = ref<HTMLDivElement | null>(null)

watch(
  () => props.time,
  (newValue) => {
    if (container.value) {
      // This goes beyond the scrollable height.
      // There's some "dead" time at the beginning and end where only the playhead moves.
      const top =
        (container.value.scrollHeight - container.value.clientHeight * 0.4) *
          (1 - newValue / duration.value) -
        container.value.clientHeight * 0.2
      container.value.scrollTo({ top })
    }
  }
)

watch(container, (newValue) => {
  if (newValue) {
    newValue.scrollTo({ top: newValue.scrollHeight })
  }
})

type Panel = { class: string; style: string }
type Nuisance = { style: string }
type Score = { style: string; spans: { class: string; content: string }[] }
type Chain = { style: string; content: string }

const content = computed<[Panel[], Nuisance[], Score[], Chain[]]>(() => {
  const panels: Panel[] = []
  const nuisances: Nuisance[] = []
  const scores: Score[] = []
  const chains: Chain[] = []

  const garbageTimeOffset = [0, 0]

  const bw = blockWidth.value
  const units = props.units

  const panelDims = `height: ${0.9 * bw}${units}; width: ${0.9 * bw}${units};`

  for (const item of props.track) {
    const t = timeToTop(item.time)
    const offset = (0.075 + 9 * item.player) * bw
    if (item.type === 'move') {
      let y1 = bw / 2
      let y2 = bw / 2
      if (item.y1 > item.y2) {
        y1 = bw
        y2 = 0
      } else if (item.y1 < item.y2) {
        y1 = 0
        y2 = bw
      }
      panels.push({
        class: `panel ${COLOR_CLASSES[item.color1]} ${item.triggers1 ? 'trigger' : ''}`,
        style: `left: ${offset + item.x1 * bw}${units}; top: ${t + y1}${units}; ${panelDims}`
      })
      panels.push({
        class: `panel ${COLOR_CLASSES[item.color2]} ${item.triggers2 ? 'trigger' : ''}`,
        style: `left: ${offset + item.x2 * bw}${units}; top: ${t + y2}${units}; ${panelDims}`
      })
    }
    if (item.type === 'bag') {
      let i = 0
      for (const color of item.bag) {
        const x = Math.floor(0.5 * i)
        const y = 1 - (i % 2)
        panels.push({
          class: `panel ${COLOR_CLASSES[color]} bag`,
          style: `left: ${offset + (0.5 + 2 * x) * bw}${units}; top: ${
            t + (y - 1.5 - 0.1 * x) * bw
          }${units}; ${panelDims}`
        })
        i++
      }
    }
    if (item.type === 'garbage') {
      for (const x of item.columns) {
        nuisances.push({
          style: `left: ${offset + bw * x}${units}; top: ${
            t + garbageTimeOffset[item.player]
          }${units}; ${panelDims}`
        })
      }
      garbageTimeOffset[item.player] -= bw - (TIME_SCALE / 10) * bw
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
        style: `left: ${offset}${units}; top: ${t}${units}; font-size:${1.3 * bw}${units};`,
        spans
      })
    }
    if (item.type === 'chain') {
      chains.push({
        style: `left: ${offset}${units}; top: ${t + 1.2 * bw}${units}; font-size:${
          1.15 * bw
        }${units};`,
        content: `${item.number}-chain ${item.allClear ? 'AC' : ''}`
      })
    }
    if (item.type === 'lockout') {
      chains.push({
        style: `left: ${offset + 0.3 * bw}${units}; top: ${t}${units}; font-size:${
          1.3 * bw
        }${units};`,
        content: 'Lockout'
      })
    }
    if (item.type === 'result') {
      chains.push({
        style: `left: ${offset + bw}${units}; top: ${t - 1.5 * bw}${units}; font-size:${
          1.3 * bw
        }${units};`,
        content: item.result
      })
    }
  }
  return [panels, nuisances, scores, chains]
})

const panels = computed(() => content.value[0])
const nuisances = computed(() => content.value[1])
const scores = computed(() => content.value[2])
const chains = computed(() => content.value[3])
</script>
<template>
  <div ref="container" class="track-container" :style="`width: ${width}${units}`">
    <div
      v-for="i of WIDTH + 1"
      :key="i"
      class="grid-line"
      :style="`left: ${(i - 1) * blockWidth}${units}; height: ${height};`"
    ></div>
    <div
      v-for="i of WIDTH + 1"
      :key="i"
      class="grid-line"
      :style="`left: ${(9 + i - 1) * blockWidth}${units}; height: ${height};`"
    ></div>
    <div class="divider" :style="`height: ${height}; left: ${7.5 * blockWidth}${units}`"></div>
    <div v-for="(attrs, i) of panels" :key="i" v-bind="attrs"></div>
    <div v-for="(attrs, i) of nuisances" :key="i" class="nuisance" v-bind="attrs"></div>
    <div v-for="(score, i) of scores" :key="i" :style="score.style">
      <span v-for="(span, j) of score.spans" :key="j" :class="span.class">{{ span.content }}</span>
    </div>
    <div v-for="(chain, i) of chains" :key="i" :style="chain.style">
      <span class="chain-label">{{ chain.content }}</span>
    </div>
    <div
      class="playhead"
      :style="`top: ${timeToTop(time) + blockWidth * 1.5}${units}; width: ${0.9 * width}${units}`"
    ></div>
  </div>
</template>
<style scoped>
.track-container {
  position: relative;
  overflow-y: scroll;
}
.track-container * {
  position: absolute;
}
.playhead {
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
  color: white;
}
.divider {
  width: 1px;
  background-color: white;
}
.grid-line {
  width: 1px;
  background-color: #333;
}
.panel {
  border-radius: 20%;
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
  border-radius: 100%;
  background-color: rgba(30, 255, 255, 0.94);
}
</style>
