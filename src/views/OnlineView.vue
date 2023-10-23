<script setup lang="ts">
import { useWebSocketStore } from '@/stores/websocket'
import PlayingField from '@/components/PlayingField.vue'
import PlayingButton from '@/components/PlayingButton.vue'
import { useAudioContextStore } from '@/stores/audio-context'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  WIDTH,
  type GameState,
  MultiplayerGame,
  type Replay,
  VISIBLE_HEIGHT,
  GHOST_Y,
  FischerTimer,
  OnePlayerGame,
  DEFAULT_TARGET_POINTS
} from 'pujo-puyo-core'
import { ChainDeck, type Chain } from '@/chain-deck'
import { processTickSounds } from '@/soundFX'

// === Type definitions ===

type NormalMove = {
  player: number
  x1: number
  y1: number
  orientation: number
  hardDrop: boolean
  pass: false
}

type PassingMove = {
  player: number
  pass: true
}

type Move = NormalMove | PassingMove

// === Constants ===

const LOG = false

// === State ===

// Server connection
const websocket = useWebSocketStore()
let identity: number | null = null
// Silly linter is silly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let moveSent = false
let opponentBagTime: DOMHighResTimeStamp | null = null
const bagQueues: number[][][] = [[], []]
const moveQueues: Move[][] = [[], []]

const audioContext = useAudioContextStore()

// Frames per millisecond
const gameFrameRate = ref(45 / 1000) // This is 50% faster than realtime
const msPerFrame = computed(() => 1 / gameFrameRate.value)
const gameType = ref<'pausing' | 'realtime'>('pausing')
// Engine: In pausing mode the game is merely a mirror driven by the server.
let game: MultiplayerGame | null = null
let chainDeck = new ChainDeck()
const replay: Replay = {
  gameSeed: -1,
  screenSeed: -1,
  colorSelection: [],
  targetPoints: [DEFAULT_TARGET_POINTS, DEFAULT_TARGET_POINTS],
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
const passing = ref(false)
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

function onMessage(message: any) {
  if (LOG) {
    console.log(message)
  }
  if (message.type === 'game params') {
    game = new MultiplayerGame(
      null,
      message.colorSelection,
      message.screenSeed,
      message.targetPoints
    )
    identity = message.identity as number
    replay.gameSeed = -1
    replay.colorSelection = message.colorSelection
    replay.screenSeed = message.screenSeed
    replay.targetPoints = message.targetPoints
    replay.moves.length = 0
    replay.metadata = message.metadata
    names[0] = message.metadata.names[identity]
    names[1] = message.metadata.names[1 - identity]
    replay.metadata.names = [...names]
    timers[0] = FischerTimer.fromString(message.metadata.timeControl)
    timers[1] = FischerTimer.fromString(message.metadata.timeControl)
    bagQueues.forEach((queue) => (queue.length = 0))
    moveQueues.forEach((queue) => (queue.length = 0))
    gameFrameRate.value = 45 / 1000
    gameType.value = 'pausing'
    referenceAge = 0
    referenceTime = null
    lastTickTime = null
    lastAgeDrawn = -1
    opponentBagTime = null
    moveSent = false
    chainDeck = new ChainDeck()
    opponentThinkingOpacity.value = 0
    passing.value = false
    justPassed.value = false
    canRequeue.value = false
    timeouts.fill(false)
    if (tickId === null) {
      tickId = window.setTimeout(tick, 1)
    } else {
      window.clearTimeout(tickId)
      tickId = window.setTimeout(tick, 100)
    }
  }
  if (message.type === 'bag') {
    message.player = identity ? 1 - message.player : message.player
    timers[message.player].begin()
    bagQueues[message.player].push(message.bag)
    if (game!.games[message.player].bag.length < 6) {
      game!.games[message.player].bag = [...message.bag]
      lastAgeDrawn = -1
      if (LOG) {
        console.log(`Setting bag of ${message.player} from message`)
      }
    }
    if (message.player === 1) {
      opponentBagTime = performance.now()
    }
  }
  if (message.type === 'timer' && message.player !== identity) {
    timers[1].end()
    timers[1].remaining = message.msRemaining
  }
  if (message.type === 'move') {
    message.player = identity ? 1 - message.player : message.player
    if (message.player === 1 && timers[1].reference !== null) {
      timers[1].end()
      timers[1].remaining = message.msRemaining
    }
    moveQueues[message.player].push(message)
  }
  if (message.type === 'game result') {
    replay.gameSeed = message.gameSeed
    replay.result.winner = message.winner
    replay.result.reason = message.reason
    replay.metadata.endTime = message.msSince1970
    if (message.winner === identity) {
      wins[0] = 1
      wins[1] = 0
    } else if (message.winner === undefined) {
      // Negative powers of two have exact representation so this is safe
      wins[0] = 0.5
      wins[1] = 0.5
    } else {
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
    gameFrameRate.value = 30 / 1000
    gameType.value = 'realtime'
    referenceTime = null
    referenceAge = 0
    if (game) {
      // This is basically brain surgery just to keep playing
      const surrogate = new OnePlayerGame(replay.gameSeed, replay.colorSelection, replay.screenSeed)
      for (const move of replay.moves) {
        if (move.player === 0) {
          surrogate.advanceColors()
        }
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
    if (!game.games[i].busy && moveQueues[i].length) {
      const move = moveQueues[i].shift()!
      const bag = bagQueues[i].shift()
      if (bag === undefined) {
        throw new Error('Bag queue desync')
      }
      if (move.pass) {
        passing.value = true
      } else {
        passing.value = false
        game.games[i].bag = bag
        const playedMove = game.play(i, move.x1, move.y1, move.orientation, move.hardDrop)
        lastAgeDrawn = -1
        replay.moves.push(playedMove)

        if (game.games[i].bag.length < 6 && bagQueues[i].length) {
          if (LOG) {
            console.log(`Setting bag of ${i} from queue`)
          }
          game.games[i].bag = [...bagQueues[i][0]]
          lastAgeDrawn = -1
        }
      }
    }
  }

  const intendedAge = (timeStamp - referenceTime) * gameFrameRate.value
  while (referenceAge < intendedAge) {
    if (
      game.games.every((game) => game.busy) ||
      (passing.value && game.games.some((game) => game.busy)) ||
      gameType.value === 'realtime'
    ) {
      const tickResults = game.tick()
      chainDeck.processTick(game, tickResults)
      if (tickResults.every((r) => !r.busy)) {
        passing.value = false
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
    chainCards.value = chainDeck.chains
    lastAgeDrawn = game.age
  }

  const moveReceived = moveQueues[1].length
  const waitingOnSelf = gameStates.value && !gameStates.value[0].busy
  const opponentResolving = gameStates.value && gameStates.value[1].busy
  const gameOver = gameStates.value && gameStates.value.some((s) => s.lockedOut)
  const realtime = gameType.value === 'realtime'

  // XXX: Fading depends on framerate
  if (
    opponentBagTime === null ||
    moveReceived ||
    waitingOnSelf ||
    opponentResolving ||
    gameOver ||
    realtime
  ) {
    opponentThinkingOpacity.value *= 0.7
  } else if (drawTime - opponentBagTime > 1000) {
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
  websocket.passMove()
}

function requeue() {
  if (canRequeue.value) {
    localStorage.setItem('replays.latest', JSON.stringify(replay))
    websocket.requestGame()
  }
}

function commitMove(x1: number, y1: number, orientation: number, hardDrop: boolean) {
  if (gameType.value === 'pausing') {
    if (timers[0].end()) {
      websocket.timeout()
    } else {
      websocket.makeMove(x1, y1, orientation, hardDrop, timers[0].remaining)
      moveSent = true
    }
  } else if (game) {
    const playedMove = game.play(0, x1, y1, orientation)
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
  websocket.addMessageListener(onMessage)
  websocket.sendUserData()
  websocket.requestGame()
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
      @pass="pass"
      @commit="commitMove"
      :wins="wins"
      :gameStates="gameStates"
      :chainCards="chainCards"
      :canPass="canPass"
      :passing="passing"
      :opponentThinkingOpacity="opponentThinkingOpacity"
      :fallMu="fallMu"
      :justPassed="justPassed"
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
