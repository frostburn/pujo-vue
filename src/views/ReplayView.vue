<script setup lang="ts">
import {
  MultiplayerGame,
  replayToTrack,
  type Replay,
  type GameState,
  VISIBLE_HEIGHT,
  parseReplay,
  type MultiplayerTickResult,
  WIDTH,
  NOMINAL_FRAME_RATE,
  repairReplay
} from 'pujo-puyo-core'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import SVGDefs from '@/components/SVGDefs.vue'
import PlayingScreen from '@/components/PlayingScreen.vue'
import ReplayTrack from '@/components/ReplayTrack.vue'
import { LEFT_SCREEN_X, RIGHT_SCREEN_X, SCREEN_Y } from '@/util'
import { ChainDeck, DeckedGame } from '@/chain-deck'
import { makesSound, processTickSounds } from '@/soundFX'
import { useAudioContextStore } from '@/stores/audio-context'
import ModalDialog from '@/components/ModalDialog.vue'
import PlayingButton from '@/components/PlayingButton.vue'
import type { ReplayFragment, ServerMessage } from '@/server-api'
import { useWebSocketStore } from '@/stores/websocket'

// In frames per millisecond.
const DEFAULT_FRAME_RATE = NOMINAL_FRAME_RATE / 1000

const SNAPSHOT_INTERVAL = 30

const PER_PAGE = 10

const audioContext = useAudioContextStore()

const replay = ref<Replay | null>(null)

let game = new DeckedGame()
let replayIndex = 0

const snapshots: DeckedGame[] = []
const tickResults: (MultiplayerTickResult | null)[] = []

function takeSnapshot(g: MultiplayerGame, tickResults_: MultiplayerTickResult[]) {
  for (const tickResult of tickResults_) {
    if (makesSound(tickResult)) {
      tickResults.push(tickResult)
    } else {
      tickResults.push(null)
    }
  }
  if (!(g.age % SNAPSHOT_INTERVAL)) {
    snapshots.push(g.clone(true) as DeckedGame)
  }
}

let drawId: number | null = null
let referenceTimeStamp: DOMHighResTimeStamp | null = null
let referenceTime = 0

const time = ref(0)
const frameRate = ref(0)
const timeouts = reactive([false, false])

// Replay list
const websocket = useWebSocketStore()

const showArchive = ref(false)
const replayFragments = reactive<ReplayFragment[]>([])
const replayPage = ref(0)
const totalReplayCount = ref(0)
const userIds = reactive<(number | null)[]>([null, null])

function onMessage(message: ServerMessage) {
  if (message.type === 'replays') {
    replayFragments.length = 0
    for (const replay of message.replays) {
      replayFragments.push(replay)
    }
    totalReplayCount.value = message.totalCount
  }
  if (message.type === 'replay' && message.replay) {
    replay.value = repairReplay(message.replay)
    replayIndex = 0
    game = new DeckedGame()
    timeModel.value = 0
    frameRate.value = 0
    timeouts.fill(false)
    tickResults.length = 0
  }
}

const track = computed(() => {
  if (!replay.value) {
    return []
  }

  const r = replay.value
  game = new DeckedGame(
    r.gameSeed,
    r.screenSeed,
    r.colorSelections,
    r.targetPoints,
    r.marginFrames,
    r.mercyFrames
  )

  const result = [...replayToTrack(r, takeSnapshot, DeckedGame)]
  return result
})

const finalTime = computed(() => {
  if (track.value.length <= 0) {
    return Infinity
  }
  return track.value[track.value.length - 1].time
})

const numPages = computed(() => Math.ceil(totalReplayCount.value / PER_PAGE))

type Page = {
  label: string
  click: () => void
}

const visiblePages = computed(() => {
  const total = numPages.value
  const result: Page[] = []
  let min = Math.max(0, replayPage.value - 5)
  const max = Math.min(total, min + 15)
  min = Math.max(0, max - 15)
  if (min > 0) {
    result.push({
      label: '1, ',
      click: () => goToPage(0)
    })
    result.push({
      label: '... ',
      click: () => {}
    })
  }
  for (let i = min; i < max; ++i) {
    const n = i
    const page = {
      label: `${n + 1}`,
      click: () => goToPage(n)
    }
    if (i < total - 1) {
      page.label += ', '
    }
    result.push(page)
  }
  if (max < total) {
    result.push({
      label: '... ',
      click: () => {}
    })
    result.push({
      label: `${total}`,
      click: () => goToPage(total - 1)
    })
  }

  return result
})

const gameAndDeckStates = computed<[GameState[], ChainDeck]>(() => {
  if (!replay.value) {
    return [[], new ChainDeck()]
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
    while (
      replayIndex < replay.value.moves.length &&
      replay.value.moves[replayIndex].time < game.age
    ) {
      replayIndex++
    }
  }

  // Fast-forward to the current time
  while (game.age < time.value) {
    while (replay.value.moves[replayIndex]?.time === game.age) {
      const move = replay.value.moves[replayIndex++]
      game.play(move.player, move.x1, move.y1, move.orientation)
    }
    game.tick()
  }
  return [game.state, game.deck]
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

const showHand = computed(() => {
  if (!replay.value) {
    return false
  }
  return time.value >= finalTime.value || replay.value.metadata.type === 'realtime'
})

watch(frameRate, () => {
  referenceTimeStamp = null
  referenceTime = time.value
})

function deltaTime(delta: number) {
  time.value = Math.max(0, Math.min(finalTime.value, Math.round(time.value) + delta))
  frameRate.value = 0
  referenceTimeStamp = null
  referenceTime = time.value
}

function draw(timeStamp: DOMHighResTimeStamp) {
  if (!replay.value) {
    drawId = requestAnimationFrame(draw)
    return
  }
  if (referenceTimeStamp === null) {
    referenceTimeStamp = timeStamp
  }

  const soundStart = Math.floor(time.value)

  const intendedAge = (timeStamp - referenceTimeStamp) * frameRate.value
  time.value = Math.max(0, Math.min(finalTime.value, referenceTime + intendedAge))

  if (frameRate.value > 0) {
    const soundEnd = Math.floor(time.value)
    processTickSounds(
      audioContext,
      tickResults
        .slice(soundStart * 2, soundEnd * 2)
        .filter((t) => t !== null) as MultiplayerTickResult[]
    )
  }

  if (time.value === finalTime.value && replay.value.result.reason === 'timeout') {
    if (replay.value.result.winner === 0) {
      timeouts[1] = true
    } else if (replay.value.result.winner === 1) {
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
  if (time.value < finalTime.value || !replay.value) {
    return ['0', '0']
  }
  if (replay.value.result.winner === 0) {
    return ['1', '0']
  } else if (replay.value.result.winner === undefined) {
    return ['½', '½']
  } else {
    return ['0', '1']
  }
})

function openArchive(userId?: number | null) {
  if (userId === null) {
    return
  }
  websocket.listReplays(0, PER_PAGE, userId)
  replayPage.value = 0
  showArchive.value = true
}

function goToPage(n: number) {
  replayPage.value = n
  websocket.listReplays(n, PER_PAGE)
}

function fetchReplay(replay: ReplayFragment) {
  for (let i = 0; i < replay.userIds.length; ++i) {
    userIds[i] = replay.userIds[i]
  }
  websocket.getReplay(replay.id)
  showArchive.value = false
}

onMounted(() => {
  drawId = requestAnimationFrame(draw)

  if (websocket.clientSocket) {
    websocket.clientSocket.addMessageListener(onMessage)
  } else {
    throw new Error('Websocket unavailable')
  }

  const serialized = localStorage.getItem('replays.latest')

  if (serialized) {
    replay.value = parseReplay(serialized)
  }
})

onUnmounted(() => {
  if (drawId !== null) {
    cancelAnimationFrame(drawId)
  }

  if (websocket.clientSocket) {
    websocket.clientSocket.removeMessageListener(onMessage)
  }
})
</script>

<template>
  <main>
    <div class="container">
      <ReplayTrack :track="track" :time="time" :width="22" units="vh" />
      <svg
        ref="svg"
        width="100%"
        height="100%"
        viewBox="0 0 21.5 16.5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <SVGDefs />
        <template v-if="replay">
          <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
            <PlayingScreen
              :gameState="gameStates ? gameStates[0] : null"
              :fallMu="fallMu"
              :preIgnitions="null"
              :chainCards="chainCards[0]"
              :wins="winDisplays[0]"
              :showHand="showHand"
              :timeout="timeouts[0]"
              :countdown="0"
            />
            <clipPath id="left-name-clip">
              <rect x="0" :y="VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
            </clipPath>
            <text
              class="name"
              x="0"
              :y="VISIBLE_HEIGHT + 2"
              clip-path="url(#left-name-clip)"
              @click="openArchive(userIds[0])"
            >
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
              :countdown="0"
            />
            <clipPath id="left-name-clip">
              <rect x="0" :y="VISIBLE_HEIGHT + 1" width="6.5" height="3"></rect>
            </clipPath>
            <text
              class="name"
              x="0"
              :y="VISIBLE_HEIGHT + 2"
              clip-path="url(#left-name-clip)"
              @click="openArchive(userIds[1])"
            >
              {{ replay.metadata.names[1] }}
            </text>
          </g>
        </template>
        <text class="notice" x="1" :y="SCREEN_Y + 5.5" v-else>No latest replay found...</text>
        <PlayingButton
          class="active"
          @click.stop="openArchive()"
          :width="3.5"
          :x="RIGHT_SCREEN_X + WIDTH + 0.5"
          :y="SCREEN_Y + 5"
        >
          Open Archive
        </PlayingButton>
      </svg>
    </div>
    <div>
      <input type="range" min="0" :max="finalTime" step="any" v-model="timeModel" />
    </div>
    <div>
      <button @click="deltaTime(-1)">-1 frame</button>
      <button @click="deltaTime(1)">+1 frame</button>
      <button @click="deltaTime(-1000 * DEFAULT_FRAME_RATE)">-1 s</button>
      <button @click="deltaTime(1000 * DEFAULT_FRAME_RATE)">+1 s</button>
      <button @click="frameRate = frameRate ? 0 : DEFAULT_FRAME_RATE">
        {{ frameRate ? '⏸' : '▶' }}
      </button>
      <button @click="frameRate = DEFAULT_FRAME_RATE * 0.5">×0.5</button>
      <button @click="frameRate = DEFAULT_FRAME_RATE * 0.75">×0.75</button>
      <button @click="frameRate = DEFAULT_FRAME_RATE">×1</button>
      <button @click="frameRate = DEFAULT_FRAME_RATE * 1.5">×1.5</button>
      <button @click="frameRate = DEFAULT_FRAME_RATE * 2">×2</button>
    </div>
  </main>
  <Teleport to="body">
    <ModalDialog
      class="replay-list"
      :show="showArchive"
      @confirm="showArchive = false"
      @cancel="showArchive = false"
    >
      <template #header>
        <h2>Load Archived Replay (page {{ replayPage + 1 }})</h2>
      </template>
      <template #body>
        <ul>
          <li v-for="replay of replayFragments" :key="replay.id" @click="fetchReplay(replay)">
            {{ replay.names.join(' vs. ') }} - {{ new Date(replay.msSince1970).toLocaleString() }}
          </li>
        </ul>
        <span v-for="(page, i) of visiblePages" :key="i" @click="page.click">{{ page.label }}</span>
      </template>
      <template #footer>
        <button class="modal-default-button" @click="showArchive = false">Cancel</button>
      </template>
    </ModalDialog>
  </Teleport>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: row;
  height: 88vh;
}

.container div {
  flex: 0 0 auto;
}

.container svg {
  flex: 1 1 auto;
  user-select: none;
}

text.notice {
  font-size: 1px;
  fill: var(--color-text);
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

.replay-list {
  user-select: none;
}

.replay-list span,
li {
  cursor: pointer;
}
</style>
