<script setup lang="ts">
import {
  MultiplayerGame,
  replayToTrack,
  type Replay,
  type GameState,
  VISIBLE_HEIGHT,
  parseReplay,
  type TrackItem,
  type MultiplayerTickResult
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import SVGDefs from '@/components/SVGDefs.vue'
import PlayingScreen from '@/components/PlayingScreen.vue'
import ReplayTrack from '@/components/ReplayTrack.vue'
import { LEFT_SCREEN_X, RIGHT_SCREEN_X, SCREEN_Y } from '@/util'
import { ChainDeck, DeckedGame } from '@/chain-deck'
import { processTickSounds } from '@/soundFX'
import { useAudioContextStore } from '@/stores/audio-context'

// In frames per millisecond.
const NOMINAL_FRAME_RATE = 30 / 1000

const SNAPSHOT_INTERVAL = 30

const audioContext = useAudioContextStore()

const serialized = localStorage.getItem('replays.latest')

let replay: Replay | undefined

let game = new DeckedGame()
let replayIndex = 0
let finalTime = Infinity
let track: TrackItem[] = []

const snapshots: DeckedGame[] = []

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function takeSnapshot(g: MultiplayerGame, tickResults: MultiplayerTickResult[]) {
  if (!(g.age % SNAPSHOT_INTERVAL)) {
    snapshots.push(g.clone(true) as DeckedGame)
  }
}

if (serialized) {
  replay = parseReplay(serialized)

  game = new DeckedGame(
    replay.gameSeed,
    replay.screenSeed,
    replay.colorSelections,
    replay.targetPoints,
    replay.marginFrames
  )

  track = [...replayToTrack(replay, takeSnapshot, DeckedGame)]

  finalTime = track[track.length - 1].time
}

let drawId: number | null = null
let referenceTimeStamp: DOMHighResTimeStamp | null = null
let referenceTime = 0

const time = ref(0)
const frameRate = ref(0)
const timeouts = reactive([false, false])

const gameAndDeckStates = computed<[GameState[], MultiplayerTickResult[] | null, ChainDeck]>(() => {
  if (!replay) {
    return [[], null, new ChainDeck()]
  }

  if (time.value < 0) {
    throw new Error('Negative times not supported')
  }
  // Rewind to a suitable snapshot if needed.
  if (game.age >= time.value + 1 || game.age < time.value - SNAPSHOT_INTERVAL) {
    let i
    for (i = 0; i < snapshots.length; ++i) {
      if (snapshots[i].age > time.value) {
        break
      }
    }
    game = snapshots[i - 1].clone(true)
    replayIndex = 0
    while (replayIndex < replay.moves.length && replay.moves[replayIndex].time < game.age) {
      replayIndex++
    }
  }

  let tickResults: MultiplayerTickResult[] | null = null

  // Fast-forward to the current time
  while (game.age < time.value) {
    while (replay.moves[replayIndex]?.time === game.age) {
      const move = replay.moves[replayIndex++]
      game.play(move.player, move.x1, move.y1, move.orientation)
    }
    tickResults = game.tick()
  }
  return [game.state, tickResults, game.deck]
})

const gameStates = computed(() => gameAndDeckStates.value[0])
const tickResults = computed(() => gameAndDeckStates.value[1])
const chainCards = computed(() => gameAndDeckStates.value[2].chains)

const fallMu = computed(() => time.value - Math.floor(time.value))

const timeModel = computed({
  get: () => time.value,
  set(newValue: number) {
    if (typeof newValue !== 'number') {
      newValue = parseFloat(newValue)
    }
    if (!isNaN(newValue)) {
      time.value = newValue
      referenceTimeStamp = null
      referenceTime = newValue
    }
  }
})

const showHand = computed(() => {
  if (!replay) {
    return false
  }
  return time.value >= finalTime || replay.metadata.type === 'realtime'
})

watch(frameRate, () => {
  referenceTimeStamp = null
  referenceTime = time.value
})

function deltaTime(delta: number) {
  time.value = Math.max(0, Math.min(finalTime, Math.round(time.value) + delta))
  frameRate.value = 0
  referenceTimeStamp = null
  referenceTime = time.value
}

function draw(timeStamp: DOMHighResTimeStamp) {
  if (!replay) {
    return
  }
  if (referenceTimeStamp === null) {
    referenceTimeStamp = timeStamp
  }
  const intendedAge = (timeStamp - referenceTimeStamp) * frameRate.value
  time.value = Math.max(0, Math.min(finalTime, referenceTime + intendedAge))

  if (frameRate.value > 0 && tickResults.value) {
    processTickSounds(audioContext, tickResults.value)
  }

  if (time.value === finalTime && replay.result.reason === 'timeout') {
    if (replay.result.winner === 0) {
      timeouts[1] = true
    } else if (replay.result.winner === 1) {
      timeouts[0] = true
    } else {
      timeouts.fill(true)
    }
  } else {
    timeouts.fill(false)
  }

  drawId = requestAnimationFrame(draw)
}

const winDisplays = computed(() => {
  if (time.value < finalTime || !replay) {
    return ['0', '0']
  }
  if (replay.result.winner === 0) {
    return ['1', '0']
  } else if (replay.result.winner === undefined) {
    return ['½', '½']
  } else {
    return ['0', '1']
  }
})

onMounted(() => {
  drawId = requestAnimationFrame(draw)
})

onUnmounted(() => {
  if (drawId !== null) {
    cancelAnimationFrame(drawId)
  }
})
</script>

<template>
  <main>
    <div class="container" v-if="replay">
      <ReplayTrack :track="track" :time="time" :width="22" units="vh" />
      <svg
        ref="svg"
        width="100%"
        height="100%"
        viewBox="0 0 20 16.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <SVGDefs />
        <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
          <PlayingScreen
            :gameState="gameStates ? gameStates[0] : null"
            :fallMu="fallMu"
            :preIgnitions="null"
            :chainCards="chainCards[0]"
            :wins="winDisplays[0]"
            :showHand="showHand"
            :timeout="timeouts[0]"
          />
          <clipPath id="left-name-clip">
            <rect x="0" :y="VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
          </clipPath>
          <text class="name" x="0" :y="VISIBLE_HEIGHT + 2" clip-path="url(#left-name-clip)">
            {{ replay.metadata.names[0] }}
          </text>
        </g>
        <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
          <PlayingScreen
            :gameState="gameStates ? gameStates[1] : null"
            :fallMu="fallMu"
            :preIgnitions="null"
            :chainCards="chainCards[1]"
            :wins="winDisplays[1]"
            :showHand="showHand"
            :timeout="timeouts[1]"
          />
          <clipPath id="left-name-clip">
            <rect x="0" :y="VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
          </clipPath>
          <text class="name" x="0" :y="VISIBLE_HEIGHT + 2" clip-path="url(#left-name-clip)">
            {{ replay.metadata.names[1] }}
          </text>
        </g>
      </svg>
    </div>
    <div class="container" v-else><p>No latest replay found.</p></div>
    <div>
      <input type="range" min="0" :max="finalTime" step="any" v-model="timeModel" />
    </div>
    <div>
      <button @click="deltaTime(-1)">-1 frame</button>
      <button @click="deltaTime(1)">+1 frame</button>
      <button @click="deltaTime(-1000 * NOMINAL_FRAME_RATE)">-1 s</button>
      <button @click="deltaTime(1000 * NOMINAL_FRAME_RATE)">+1 s</button>
      <button @click="frameRate = frameRate ? 0 : NOMINAL_FRAME_RATE">
        {{ frameRate ? '⏸' : '▶' }}
      </button>
      <button @click="frameRate = NOMINAL_FRAME_RATE * 0.5">×0.5</button>
      <button @click="frameRate = NOMINAL_FRAME_RATE * 0.75">×0.75</button>
      <button @click="frameRate = NOMINAL_FRAME_RATE">×1</button>
      <button @click="frameRate = NOMINAL_FRAME_RATE * 1.5">×1.5</button>
      <button @click="frameRate = NOMINAL_FRAME_RATE * 2">×2</button>
    </div>
  </main>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: row;
  height: 88vh;
}

.container div {
  overflow-y: scroll;
  flex: 0 0 auto;
}

.container svg {
  flex: 1 1 auto;
}

input {
  width: 100%;
}

button {
  min-width: 6em;
}

/* width */
::-webkit-scrollbar {
  width: 1vh;
}

/* Track */
::-webkit-scrollbar-track {
  background: #f1f1f1;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #888;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
