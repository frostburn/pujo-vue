<script setup lang="ts">
import { useWebSocketStore } from '@/stores/websocket'
import PlayingField from '@/components/PlayingField.vue'
import PlayingButton from '@/components/PlayingButton.vue'
import { useAudioContextStore } from '@/stores/audio-context'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  WIDTH,
  type GameState,
  type Replay,
  VISIBLE_HEIGHT,
  GHOST_Y,
  FischerTimer,
  OnePlayerGame,
  DEFAULT_TARGET_POINTS,
  DEFAULT_MARGIN_FRAMES,
  DEFAULT_MERCY_FRAMES
} from 'pujo-puyo-core'
import { type Chain, DeckedGame } from '@/chain-deck'
import { processTickSounds } from '@/soundFX'
import type { ServerMessage, ServerPausingMove } from '@/server-api'
import { useRoute } from 'vue-router'

// === Constants ===

const LOG = import.meta.env.DEV

// === State ===

// Router
const route = useRoute()

// Server connection
const websocket = useWebSocketStore()
let identity: number | null = null
let opponentPieceTime: DOMHighResTimeStamp | null = null
const moveQueues: ServerPausingMove[][] = [[], []]

const audioContext = useAudioContextStore()

// Frames per millisecond
const gameFrameRate = ref(45 / 1000) // This is 50% faster than realtime
const msPerFrame = computed(() => 1 / gameFrameRate.value)
const gameType = ref<'pausing' | 'realtime'>('pausing')
// Engine: In pausing mode the game is merely a mirror driven by the server.
let game: DeckedGame | null = null
const replay: Replay = {
  gameSeed: -1,
  screenSeed: -1,
  colorSelections: [[], []],
  targetPoints: [DEFAULT_TARGET_POINTS, DEFAULT_TARGET_POINTS],
  marginFrames: DEFAULT_MARGIN_FRAMES,
  mercyFrames: DEFAULT_MERCY_FRAMES,
  moves: [],
  metadata: {
    event: '',
    names: [],
    elos: [],
    priorWins: [],
    site: '',
    round: 0,
    msSince1970: new Date().valueOf(),
    type: 'pausing'
  },
  result: {
    reason: 'ongoing'
  }
}
let timers = [new FischerTimer(), new FischerTimer()]
const passing = reactive([false, false])
const justPassed = ref(false)
const canRequeue = ref(true)
const wins = reactive([0, 0])
const timeouts = reactive([false, false])
const names = reactive(['', ''])
const timeDisplays = reactive(['0:00', '0:00'])
const timeDangers = reactive([false, false])
let tickId: number | null = null
let referenceAge = 0
let referenceTime: DOMHighResTimeStamp | null = null
let lastTickTime: DOMHighResTimeStamp | null = null

// Drawing / graphics
const gameStates = ref<GameState[] | null>(null)
const chainCards = ref<Chain[][]>([[], []])
const fallMu = ref(0)
const opponentThinkingOpacity = ref(0)

let frameId: number | null = null
let lastAgeDrawn = -1

const playingField = ref<typeof PlayingField | null>(null)

// Server connection

function onMessage(message: ServerMessage) {
  if (LOG) {
    console.log(message, identity)
  }
  if (message.type === 'game params') {
    game = new DeckedGame(
      null,
      message.screenSeed,
      message.colorSelections,
      message.targetPoints,
      message.marginFrames,
      message.mercyFrames
    )
    for (let i = 0; i < message.initialBags.length; ++i) {
      game.games[i].bag = [...message.initialBags[i]]
    }
    identity = message.identity as number
    replay.gameSeed = -1
    replay.colorSelections = message.colorSelections
    replay.screenSeed = message.screenSeed
    replay.targetPoints = message.targetPoints
    replay.marginFrames = message.marginFrames
    replay.mercyFrames = message.mercyFrames
    replay.moves.length = 0
    replay.metadata = message.metadata
    names[0] = message.metadata.names[identity]
    names[1] = message.metadata.names[1 - identity]
    replay.metadata.names = [...names]
    if (message.metadata.timeControl) {
      timers[0] = FischerTimer.fromString(message.metadata.timeControl)
      timers[1] = FischerTimer.fromString(message.metadata.timeControl)
    } else {
      timers[0] = new FischerTimer()
      timers[1] = new FischerTimer()
    }
    moveQueues.forEach((queue) => (queue.length = 0))
    gameFrameRate.value = 45 / 1000
    gameType.value = 'pausing'
    referenceAge = 0
    referenceTime = null
    lastTickTime = null
    lastAgeDrawn = -1
    opponentPieceTime = null
    opponentThinkingOpacity.value = 0
    passing.fill(false)
    justPassed.value = false
    canRequeue.value = false
    timeouts.fill(false)
    if (tickId === null) {
      tickId = window.setTimeout(tick, 1)
    } else {
      window.clearTimeout(tickId)
      tickId = window.setTimeout(tick, 100)
    }
    websocket.ready()
  }
  if (message.type === 'piece') {
    message.player = identity ? 1 - message.player : message.player
    timers[message.player].begin()
    message.piece.forEach((color) => game!.games[message.player].bag.push(color))
    lastAgeDrawn = -1
    if (message.player === 1) {
      opponentPieceTime = performance.now()
    }
  }
  if (message.type === 'timer' && message.player !== identity) {
    timers[1].end()
    timers[1].remaining = message.msRemaining
  }
  if (message.type === 'pausing move') {
    message.player = identity ? 1 - message.player : message.player
    if (message.player === 1 && timers[1].reference !== null) {
      timers[1].end()
      timers[1].remaining = message.msRemaining
    }
    moveQueues[message.player].push(message)
  }
  if (message.type === 'game result') {
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
    if (LOG) {
      console.log('Switching to realtime')
    }
    canRequeue.value = true
    gameFrameRate.value = 30 / 1000
    gameType.value = 'realtime'
    referenceTime = null
    referenceAge = 0
    if (game) {
      // This is basically brain surgery just to keep playing
      const surrogate = new OnePlayerGame(
        replay.gameSeed,
        replay.screenSeed,
        replay.colorSelections[0]
      )
      for (const move of replay.moves) {
        if (move.player === 0) {
          surrogate.advanceColors()
        }
      }
      if (LOG) {
        console.log('Setting surrogate bag', surrogate.bag)
      }
      game.games[0].bag = surrogate.bag
      game.games[0].jkiss = surrogate.jkiss
    }
    for (const timer of timers) {
      if (timer.reference !== null) {
        timer.end()
      }
    }
  }
}

// Game logic goes here and runs independent of animation.
function tick() {
  if (!game) {
    return
  }
  const timeStamp = window.performance.now()
  if (referenceTime === null) {
    referenceTime = timeStamp
  }

  for (let i = 0; i < moveQueues.length; ++i) {
    if (!passing[i] && !game.games[i].busy && moveQueues[i].length) {
      const move = moveQueues[i].shift()!
      if (move.pass) {
        passing[i] = true
      } else {
        const playedMove = game.play(i, move.x1, move.y1, move.orientation)
        lastAgeDrawn = -1
        replay.moves.push(playedMove)
      }
    }
  }

  const intendedAge = (timeStamp - referenceTime) * gameFrameRate.value
  while (referenceAge < intendedAge) {
    if (
      game.games.every((game) => game.busy) ||
      (passing.some(Boolean) && game.games.some((game) => game.busy)) ||
      gameType.value === 'realtime'
    ) {
      const tickResults = game.tick()
      if (tickResults.every((r) => !r.busy)) {
        passing.fill(false)
      }
      processTickSounds(audioContext, tickResults)
    }
    referenceAge++
  }
  const nextTickTime = referenceAge * msPerFrame.value + referenceTime
  lastTickTime = window.performance.now()
  tickId = window.setTimeout(tick, nextTickTime - lastTickTime)
}

// Animation goes here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function draw(timeStamp: DOMHighResTimeStamp) {
  const drawTime = window.performance.now()
  if (lastTickTime === null || gameType.value === 'pausing') {
    fallMu.value = 0
  } else if (gameType.value === 'realtime') {
    fallMu.value = Math.max(0, Math.min(1, (drawTime - lastTickTime) * gameFrameRate.value))
  }

  if (game !== null && (!gameStates.value || lastAgeDrawn !== game.age)) {
    gameStates.value = game.state
    chainCards.value = game.deck.chains
    lastAgeDrawn = game.age
  }

  const moveReceived = moveQueues[1].length
  const waitingOnSelf = gameStates.value && !gameStates.value[0].busy
  const opponentResolving = gameStates.value && gameStates.value[1].busy
  const gameOver = gameStates.value && gameStates.value.some((s) => s.lockedOut)
  const realtime = gameType.value === 'realtime'

  // XXX: Fading depends on framerate
  if (
    opponentPieceTime === null ||
    moveReceived ||
    waitingOnSelf ||
    opponentResolving ||
    gameOver ||
    realtime
  ) {
    opponentThinkingOpacity.value *= 0.7
  } else if (drawTime - opponentPieceTime > 1000) {
    opponentThinkingOpacity.value = 1 - (1 - opponentThinkingOpacity.value) * 0.995
  }

  for (let i = 0; i < timers.length; ++i) {
    timeDangers[i] = timers[i].timeRemaining() < 20000
    if (timeDangers[i]) {
      timeDisplays[i] = timers[i].display(1)
    } else {
      timeDisplays[i] = timers[i].display()
    }
  }

  if (gameType.value === 'pausing' && timers[0].flagged()) {
    websocket.timeout()
  }

  frameId = window.requestAnimationFrame(draw)
}

// User interaction goes here.

const canPass = computed(() =>
  Boolean(
    gameStates.value &&
      !justPassed.value &&
      !gameStates.value[0].busy &&
      gameStates.value[1].busy &&
      gameType.value === 'pausing'
  )
)

function pass() {
  if (!canPass.value) {
    return
  }
  justPassed.value = true
  if (timers[0].end()) {
    websocket.timeout()
  } else {
    websocket.passMove(timers[0].remaining)
  }
}

function requeue() {
  if (canRequeue.value) {
    websocket.requestGame('pausing')
  }
}

function commitMove(x1: number, y1: number, orientation: number, hardDrop: boolean) {
  if (gameType.value === 'pausing') {
    if (timers[0].end()) {
      websocket.timeout()
    } else {
      websocket.makePausingMove(x1, y1, orientation, hardDrop, timers[0].remaining)
    }
  } else if (game) {
    const playedMove = game.play(0, x1, y1, orientation)
    if (LOG) {
      console.log('Pushing realtime move', playedMove)
    }
    replay.moves.push(playedMove)
    localStorage.setItem('replays.latest', JSON.stringify(replay))
  }
  justPassed.value = false
}

// Child props that require access to the game engine

const primaryDropletY = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 1
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game!.games[0].screen.dropPuyo(x1, y1 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 > y1) {
    return bottom - 1
  }
  return bottom
})

const secondaryDropletY = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return VISIBLE_HEIGHT - 2
  }
  const x1 = playingField.value.x1
  const y1 = playingField.value.y1
  const x2 = playingField.value.x2
  const y2 = playingField.value.y2
  const bottom = game!.games[0].screen.dropPuyo(x2, y2 + GHOST_Y + 1) - GHOST_Y - 1
  if (x1 === x2 && y2 < y1) {
    return bottom - 1
  }
  return bottom
})

const preIgnitions = computed(() => {
  if (!gameStates.value || !playingField.value) {
    return Array(WIDTH * VISIBLE_HEIGHT).fill(false)
  }
  return game!.games[0].screen
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
  if (websocket.clientSocket) {
    websocket.clientSocket.addMessageListener(onMessage)
  } else {
    throw new Error('Websocket unavailable')
  }
  websocket.sendUserData()
  if (route.params.uuid) {
    websocket.acceptChallenge(route.params.uuid as string)
  } else {
    websocket.requestGame('pausing')
  }
  canRequeue.value = false
  frameId = window.requestAnimationFrame(draw)
})

onUnmounted(() => {
  if (websocket.clientSocket) {
    websocket.clientSocket.removeMessageListener(onMessage)
  }
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
      @pass="pass"
      @commit="commitMove"
      :wins="wins"
      :gameStates="gameStates"
      :chainCards="chainCards"
      :canPass="canPass"
      :passing="passing[0]"
      :opponentThinkingOpacity="opponentThinkingOpacity"
      :fallMu="fallMu"
      :primaryDropletY="primaryDropletY"
      :secondaryDropletY="secondaryDropletY"
      :preIgnitions="preIgnitions"
      :timeouts="timeouts"
      :names="names"
      :timeDisplays="timeDisplays"
      :timeDangers="timeDangers"
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
