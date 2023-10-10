<script setup lang="ts">
import {
  MultiplayerGame,
  replayToTrack,
  type Replay,
  type GameState,
  type TickResult
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SVGDefs from '@/components/SVGDefs.vue'
import PlayingScreen from '@/components/PlayingScreen.vue'
import ReplayTrack from '@/components/ReplayTrack.vue'
import { LEFT_SCREEN_X, RIGHT_SCREEN_X, SCREEN_Y } from '@/util'
import { ChainDeck } from '@/chain-deck'

// TODO: SoundFX

// In frames per millisecond.
const NOMINAL_FRAME_RATE = 30 / 1000

const SNAPSHOT_INTERVAL = 30

const replay: Replay = JSON.parse(localStorage.getItem('replays.latest')!)

const snapshots: MultiplayerGame[] = []
const snapDecks: ChainDeck[] = []

let game = new MultiplayerGame(replay.gameSeed, replay.colorSelection, replay.screenSeed)
let deck = new ChainDeck()
let replayIndex = 0

function takeSnapshot(g: MultiplayerGame, tickResults: TickResult[]) {
  if (!(g.age % SNAPSHOT_INTERVAL)) {
    snapshots.push(g.clone(true))
    snapDecks.push(deck.clone())
  }
  if (tickResults.length) {
    deck.processTick(g, tickResults)
  }
}

const track = [...replayToTrack(replay, takeSnapshot)]

const finalTime = track[track.length - 1].time

let drawId: number | null = null
let referenceTimeStamp: DOMHighResTimeStamp | null = null
let referenceTime = 0

const time = ref(0)
const frameRate = ref(0)

const gameAndDeckStates = computed<[GameState[], ChainDeck]>(() => {
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
    deck = snapDecks[i - 1].clone()
    replayIndex = 0
    while (replayIndex < replay.moves.length && replay.moves[replayIndex].time < game.age) {
      replayIndex++
    }
  }
  // Fast-forward to the current time
  while (game.age < time.value) {
    while (replay.moves[replayIndex]?.time === game.age) {
      const move = replay.moves[replayIndex++]
      game.play(move.player, move.x1, move.y1, move.orientation)
    }
    const tickResults = game.tick()
    deck.processTick(game, tickResults)
  }
  return [game.state, deck]
})

const gameStates = computed(() => gameAndDeckStates.value[0])
const chainCards = computed(() => gameAndDeckStates.value[1].chains)

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
  if (referenceTimeStamp === null) {
    referenceTimeStamp = timeStamp
  }
  const intendedAge = (timeStamp - referenceTimeStamp) * frameRate.value
  time.value = Math.max(0, Math.min(finalTime, referenceTime + intendedAge))

  drawId = requestAnimationFrame(draw)
}

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
    <div class="container">
      <ReplayTrack :track="track" :time="time" />
      <svg
        ref="svg"
        width="100%"
        height="100%"
        viewBox="0 0 20 15"
        xmlns="http://www.w3.org/2000/svg"
      >
        <SVGDefs />
        <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
          <PlayingScreen
            :gameState="gameStates ? gameStates[0] : null"
            :fallMu="fallMu"
            :preIgnitions="null"
            :chainCards="chainCards[0]"
            :wins="gameStates && gameStates[1].lockedOut ? 1 : 0"
          />
        </g>
        <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
          <PlayingScreen
            :gameState="gameStates ? gameStates[1] : null"
            :fallMu="fallMu"
            :preIgnitions="null"
            :chainCards="chainCards[1]"
            :wins="gameStates && gameStates[0].lockedOut ? 1 : 0"
          />
        </g>
      </svg>
    </div>
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
  width: 7px;
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
