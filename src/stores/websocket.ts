import { ref, type MaybeRefOrGetter } from 'vue'
import { defineStore } from 'pinia'
import { getClientInfo } from '@/util'
import type { ClientMessage, GameType, ServerMessage } from '@/server-api'
import { useWebSocket } from '@vueuse/core'

type ConnectedListener = () => void
type MessageListener = (message: ServerMessage) => void

export class ClientSocket {
  send: ReturnType<typeof useWebSocket>['send']
  connectedListeners: ConnectedListener[]
  listeners: MessageListener[]
  verbose: boolean

  constructor(url: MaybeRefOrGetter<string | URL>, verbose = false) {
    this.connectedListeners = []
    this.listeners = []
    const onMessage = this.onMessage.bind(this)
    const onConnected = this.onConnected.bind(this)
    this.send = useWebSocket(url, {
      heartbeat: { interval: 5000, pongTimeout: 2000 },
      autoReconnect: true,
      onMessage,
      onConnected
    }).send
    this.verbose = verbose
  }

  onMessage(ws: WebSocket, event: MessageEvent) {
    if (event.data === 'pong') {
      if (this.verbose) {
        console.log('pong')
      }
      return
    }
    const message: ServerMessage = JSON.parse(event.data)
    for (const listener of this.listeners) {
      listener(message)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConnected(ws: WebSocket) {
    for (const listener of this.connectedListeners) {
      listener()
    }
  }

  sendMessage(message: ClientMessage) {
    return this.send(JSON.stringify(message))
  }

  addMessageListener(listener: MessageListener) {
    this.listeners.push(listener)
  }

  removeMessageListener(listener: MessageListener) {
    if (this.listeners.includes(listener)) {
      this.listeners.splice(this.listeners.indexOf(listener), 1)
    }
  }

  addConnectedListener(listener: ConnectedListener) {
    this.connectedListeners.push(listener)
  }

  removeConnectedListener(listener: ConnectedListener) {
    if (this.connectedListeners.includes(listener)) {
      this.connectedListeners.splice(this.connectedListeners.indexOf(listener), 1)
    }
  }
}

export const useWebSocketStore = defineStore('websocket', () => {
  const clientSocket = ref<ClientSocket | null>(null)

  function requestGame(gameType: GameType, botsAllowed: boolean, password?: string) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({
      type: 'game request',
      gameType,
      botsAllowed,
      ranked: true,
      autoMatch: password === undefined,
      password
    })
  }

  function ready() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'ready' })
  }

  function sendUserData() {
    if (!clientSocket.value) {
      return
    }
    let authUuid = localStorage.getItem('authUuid')
    if (authUuid === null) {
      authUuid = crypto.randomUUID()
      localStorage.setItem('authUuid', authUuid)
    }
    const username = localStorage.getItem('name') || `Anonymous-${authUuid.slice(0, 4)}`
    clientSocket.value.sendMessage({
      type: 'self',
      username,
      authUuid,
      clientInfo: getClientInfo()
    })
  }

  function getUserData() {
    if (!clientSocket.value) {
      return
    }
    const authUuid = localStorage.getItem('authUuid')
    if (authUuid === null) {
      throw new Error('Must set auth UUID before trying to obtain user data')
    }
    clientSocket.value.sendMessage({ type: 'self', authUuid, clientInfo: getClientInfo() })
  }

  function requestState() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'simple state request' })
  }

  function makePausingMove(
    x1: number,
    y1: number,
    orientation: number,
    hardDrop: boolean,
    msRemaining: number
  ) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({
      type: 'pausing move',
      x1,
      y1,
      pass: false,
      orientation,
      hardDrop,
      msRemaining
    })
  }

  function passMove(msRemaining: number) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'pausing move', pass: true, msRemaining })
  }

  function makeRealtimeMove(
    x1: number,
    y1: number,
    orientation: number,
    hardDrop: boolean,
    time: number | undefined
  ) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'realtime move', x1, y1, orientation, hardDrop, time })
  }

  function timeout() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'result', reason: 'timeout' })
  }

  function resign() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'result', reason: 'resignation' })
  }

  function listChallenges() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'challenge list' })
  }

  function acceptChallenge(uuid: string) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'accept challenge', uuid })
  }

  function cancelGameRequest() {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'cancel game request' })
  }

  function listReplays(page: number, perPage = 10, userId?: number) {
    if (!clientSocket.value) {
      return
    }
    const limit = perPage
    const offset = page * perPage
    clientSocket.value.sendMessage({
      type: 'list replays',
      direction: 'DESC',
      limit,
      offset,
      userId,
      finishedOnly: true
    })
  }

  function getReplay(id: number) {
    if (!clientSocket.value) {
      return
    }
    clientSocket.value.sendMessage({ type: 'get replay', id })
  }

  return {
    clientSocket,
    requestGame,
    ready,
    sendUserData,
    getUserData,
    requestState,
    makePausingMove,
    passMove,
    makeRealtimeMove,
    timeout,
    resign,
    listChallenges,
    acceptChallenge,
    cancelGameRequest,
    listReplays,
    getReplay
  }
})
