<script setup lang="ts">
import { useWebSocketStore } from '@/stores/websocket'
import PlayingField from '@/components/PlayingField.vue'
import PlayingButton from '@/components/PlayingButton.vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  WIDTH,
  type GameState,
  type Replay,
  VISIBLE_HEIGHT,
  GHOST_Y,
  DEFAULT_TARGET_POINTS,
  DEFAULT_MARGIN_FRAMES,
  NOMINAL_FRAME_RATE,
  TimeWarpingMirror,
  type PlayedMove
} from 'pujo-puyo-core'
import { type Chain, DeckedGame } from '@/chain-deck'
import type { ServerMessage } from '@/server-api'
import { processTickSounds } from '@/soundFX'
import { useAudioContextStore } from '@/stores/audio-context'

// === Constants ===

const LOG = import.meta.env.DEV

// === State ===

// Server connection
const websocket = useWebSocketStore()
let identity: number | null = null

const audioContext = useAudioContextStore()

// Frames per millisecond
const FRAME_RATE = NOMINAL_FRAME_RATE / 1000
const MS_PER_FRAME = 1 / FRAME_RATE
// Engine: A mirror driven by the server.
let mirror: TimeWarpingMirror<DeckedGame> | null = null
let game: DeckedGame | null = null
let lastMove: PlayedMove | null = null
const replay: Replay = {
  gameSeed: -1,
  screenSeed: -1,
  colorSelection: [],
  targetPoints: [DEFAULT_TARGET_POINTS, DEFAULT_TARGET_POINTS],
  marginFrames: DEFAULT_MARGIN_FRAMES,
  moves: [],
  metadata: {
    event: '',
    names: [],
    elos: [],
    priorWins: [],
    site: '',
    round: 0,
    msSince1970: new Date().valueOf(),
    type: 'realtime'
  },
  result: {
    reason: 'ongoing'
  }
}
const passing = ref(false)
const justPassed = ref(false)
const canRequeue = ref(true)
const wins = reactive([0, 0])
const timeouts = reactive([false, false])
const names = reactive(['', ''])
let tickId: number | null = null
let referenceAge = 0
let referenceTime: DOMHighResTimeStamp | null = null
let lastTickTime: DOMHighResTimeStamp | null = null
let serverDelta = 0
let currentAge = 0

// Drawing / graphics
const gameStates = ref<GameState[] | null>(null)
const chainCards = ref<Chain[][]>([[], []])
const fallMu = ref(0)

let frameId: number | null = null
let lastAgeDrawn = -1

const playingField = ref<typeof PlayingField | null>(null)

// Server connection

function onMessage(message: ServerMessage) {
  if (LOG) {
    console.log(message)
  }
  if (message.type === 'game params') {
    const origin = new DeckedGame(
      null,
      message.colorSelection,
      message.screenSeed,
      message.targetPoints,
      message.marginFrames
    )
    for (let i = 0; i < message.initialBags.length; ++i) {
      origin.games[i].bag = [...message.initialBags[i]]
    }
    mirror = new TimeWarpingMirror(origin, message.initialBags)
    game = origin.clone(true)
    lastMove = null
    identity = message.identity as number
    replay.gameSeed = -1
    replay.colorSelection = message.colorSelection
    replay.screenSeed = message.screenSeed
    replay.targetPoints = message.targetPoints
    replay.marginFrames = message.marginFrames
    replay.moves.length = 0
    replay.metadata = message.metadata
    names[0] = message.metadata.names[identity]
    names[1] = message.metadata.names[1 - identity]
    replay.metadata.names = [...names]
    passing.value = false
    justPassed.value = false
    canRequeue.value = false
    timeouts.fill(false)
    websocket.ready()
  }
  if (message.type === 'go') {
    referenceAge = 0
    referenceTime = null
    lastTickTime = null
    lastAgeDrawn = -1
    if (tickId === null) {
      tickId = window.setTimeout(tick, 1)
    } else {
      window.clearTimeout(tickId)
      tickId = window.setTimeout(tick, 100)
    }
  }
  if (message.type === 'piece') {
    message.player = identity ? 1 - message.player : message.player
    mirror!.addPiece(message)
    lastAgeDrawn = -1
  }
  if (message.type === 'realtime move') {
    message.player = identity ? 1 - message.player : message.player
    if (message.player === 1) {
      mirror!.addMove(message)
    }
  }
  if (message.type === 'retcon') {
    for (const move of message.rejectedMoves) {
      move.player = identity ? 1 - move.player : move.player
      // Retry once
      if (lastMove && move.player === 0 && move.time === lastMove.time) {
        lastMove = { ...lastMove }
        lastMove.time = currentAge
        if (LOG) {
          console.log('Retrying last move at current time')
        }
        websocket.makeRealtimeMove(
          lastMove.x1,
          lastMove.y1,
          lastMove.orientation,
          false,
          lastMove.time
        )
        mirror!.addMove(lastMove)
        lastMove = null
      }
    }
    mirror!.deleteMoves(message.rejectedMoves)
  }
  if (message.type === 'piece' || message.type === 'retcon') {
    const serverTime = message.time
    if (referenceAge + serverDelta > serverTime + 1) {
      serverDelta = serverTime - referenceAge
      if (LOG) {
        console.log('Preventing advancing, delta =', serverDelta)
      }
    }
    if (referenceAge + serverDelta < serverTime - 5) {
      serverDelta = serverTime - referenceAge
      if (LOG) {
        console.log('Preventing lagging, delta =', serverDelta)
      }
    }
  }
  if (message.type === 'game result') {
    replay.moves.length = 0
    for (const moves of mirror!.moves) {
      for (const move of moves) {
        replay.moves.push(move)
      }
    }
    replay.moves.sort((a, b) => a.time - b.time)
    replay.gameSeed = message.gameSeed
    replay.result.reason = message.reason
    replay.metadata.endTime = message.msSince1970
    if (message.winner === identity) {
      replay.result.winner = 0
      wins[0] = 1
      wins[1] = 0
    } else if (message.winner === undefined) {
      replay.result.winner = undefined
      // Negative powers of two have exact representation so this is safe
      wins[0] = 0.5
      wins[1] = 0.5
    } else {
      replay.result.winner = 1
      wins[0] = 0
      wins[1] = 1
    }
    localStorage.setItem('replays.latest', JSON.stringify(replay))
    if (message.reason === 'timeout') {
      if (replay.result.winner === 0) {
        timeouts[1] = true
      } else if (replay.result.winner === 1) {
        timeouts[0] = true
      } else {
        timeouts.fill(true)
      }
    }
    canRequeue.value = true
  }
}

// Game logic goes here and runs independent of animation.
function tick() {
  if (!mirror) {
    return
  }
  const timeStamp = window.performance.now()
  if (referenceTime === null) {
    referenceTime = timeStamp
  }

  referenceAge = (timeStamp - referenceTime) * FRAME_RATE
  currentAge = Math.max(0, Math.round(referenceAge + serverDelta))
  const [g, tickResults] = mirror.warp(currentAge)
  processTickSounds(audioContext, tickResults)
  game = g
  if (game === null && LOG) {
    console.log('Inconsistent mirror state')
  }
  const nextTickTime = referenceAge * MS_PER_FRAME + referenceTime
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

// Animation goes here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function draw(timeStamp: DOMHighResTimeStamp) {
  const drawTime = window.performance.now()
  if (lastTickTime === null) {
    fallMu.value = 0
  } else {
    fallMu.value = Math.max(0, Math.min(1, (drawTime - lastTickTime) * FRAME_RATE))
  }

  if (game !== null && (!gameStates.value || lastAgeDrawn !== currentAge)) {
    gameStates.value = game.state
    chainCards.value = game.deck.chains
    lastAgeDrawn = currentAge
  }

  frameId = window.requestAnimationFrame(draw)
}

// User interaction goes here.

function requeue() {
  if (canRequeue.value) {
    websocket.requestGame('realtime')
  }
}

function commitMove(x1: number, y1: number, orientation: number, hardDrop: boolean) {
  if (game) {
    const move = game.play(0, x1, y1, orientation, hardDrop)
    if (replay.gameSeed === -1) {
      websocket.makeRealtimeMove(move.x1, move.y1, move.orientation, false, move.time)
    } else {
      replay.moves.push(move)
      localStorage.setItem('replays.latest', JSON.stringify(replay))
    }
    mirror!.addMove(move)
    lastMove = move
  }
}

// Child props that require access to the game engine

const primaryDropletY = computed(() => {
  if (!game || !gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 1
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game.games[0].screen.dropPuyo(x1, y1 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 > y1) {
    return bottom - 1
  }
  return bottom
})

const secondaryDropletY = computed(() => {
  if (!game || !gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 2
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game.games[0].screen.dropPuyo(x2, y2 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 < y1) {
    return bottom - 1
  }
  return bottom
})

const preIgnitions = computed(() => {
  if (!game || !gameStates.value || !playingField.value) {
    return Array(WIDTH * VISIBLE_HEIGHT).fill(false)
  }
  return game.games[0].screen
    .preIgnite(
      playingField.value.x1,
      primaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[0],
      playingField.value.x2,
      secondaryDropletY.value + GHOST_Y + 1,
      gameStates.value[0].hand[1]
    )
    .slice(WIDTH * (GHOST_Y + 1))
})

// Mount server connection, game loop and animation loop.

onMounted(() => {
  websocket.addMessageListener(onMessage)
  websocket.sendUserData()
  websocket.requestGame('realtime')
  canRequeue.value = false
  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
  websocket.removeMessageListener(onMessage)
  websocket.resign()
  if (tickId !== null) {
    window.clearTimeout(tickId)
  }
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
  }
})
</script>

<template>
  <main>
    <PlayingField
      ref="playingField"
      @commit="commitMove"
      :wins="wins"
      :gameStates="gameStates"
      :chainCards="chainCards"
      :canPass="null"
      :passing="passing"
      :opponentThinkingOpacity="0"
      :fallMu="fallMu"
      :justPassed="justPassed"
      :primaryDropletY="primaryDropletY"
      :secondaryDropletY="secondaryDropletY"
      :preIgnitions="preIgnitions"
      :timeouts="timeouts"
      :names="names"
      :timeDisplays="['-', '-']"
      :timeDangers="[false, false]"
    >
      <PlayingButton
        :class="{ active: canRequeue, disabled: !canRequeue }"
        @click.stop="requeue"
        @touchstart.stop="requeue"
        :x="0"
        :y="0"
        >Requeue</PlayingButton
      >
    </PlayingField>
  </main>
</template>

<style scoped>
main {
  height: 900px;
}
</style>