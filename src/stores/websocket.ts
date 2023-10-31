import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getClientInfo } from '@/util'
import type { ClientMessage, GameType, ServerMessage } from '@/server-api'

type OpenListener = () => void
type MessageListener = (message: ServerMessage) => void

export class ClientSocket extends WebSocket {
  sendMessage(message: ClientMessage) {
    return super.send(JSON.stringify(message))
  }
}

export const useWebSocketStore = defineStore('websocket', () => {
  const webSocket = ref<ClientSocket | null>(null)

  const openListeners: OpenListener[] = []
  const messageListeners: MessageListener[] = []

  function assign(socket: ClientSocket) {
    webSocket.value = socket

    socket.onopen = () => {
      for (const listener of openListeners) {
        listener()
      }
    }

    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data)
      for (const listener of messageListeners) {
        listener(message)
      }
    }
  }

  function unassign() {
    const socket = webSocket.value
    if (socket !== null) {
      socket.close()
      webSocket.value = null
    }
  }

  function guard(hard = true) {
    const socket = webSocket.value
    if (socket === null) {
      console.warn('No WebSocket assigned')
      return true
    }
    if (socket.readyState !== 1) {
      if (hard) {
        console.warn('WebSocket not ready yet')
      }
      return true
    }
    return false
  }

  function sendGameRequest(socket: ClientSocket, gameType: GameType) {
    socket.sendMessage({
      type: 'game request',
      gameType,
      botsAllowed: true,
      ranked: true,
      autoMatch: true
    })
  }

  function requestGame(gameType: GameType) {
    if (guard(false)) {
      // eslint-disable-next-line no-inner-declarations
      function requestOnOpen() {
        const socket = webSocket.value!
        sendGameRequest(socket, gameType)
        removeOpenListener(requestOnOpen)
      }
      addOpenListener(requestOnOpen)
      return
    }
    const socket = webSocket.value!
    sendGameRequest(socket, gameType)
  }

  function ready() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'ready' })
  }

  function _sendUserData(socket: ClientSocket) {
    const username = localStorage.getItem('name') || 'Anonymous'
    let authUuid = localStorage.getItem('authUuid')
    if (authUuid === null) {
      authUuid = crypto.randomUUID()
      localStorage.setItem('authUuid', authUuid)
    }
    socket.sendMessage({
      type: 'user',
      username,
      authUuid,
      clientInfo: getClientInfo()
    })
  }

  function sendUserData() {
    if (guard(false)) {
      // eslint-disable-next-line no-inner-declarations
      function requestOnOpen() {
        const socket = webSocket.value!
        _sendUserData(socket)
        removeOpenListener(requestOnOpen)
      }
      addOpenListener(requestOnOpen)
      return
    }
    const socket = webSocket.value!
    _sendUserData(socket)
  }

  function requestState() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'simple state request' })
  }

  function makePausingMove(
    x1: number,
    y1: number,
    orientation: number,
    hardDrop: boolean,
    msRemaining: number
  ) {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({
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
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'pausing move', pass: true, msRemaining })
  }

  function makeRealtimeMove(
    x1: number,
    y1: number,
    orientation: number,
    hardDrop: boolean,
    time: number | undefined
  ) {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'realtime move', x1, y1, orientation, hardDrop, time })
  }

  function timeout() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'result', reason: 'timeout' })
  }

  function resign() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'result', reason: 'resignation' })
  }

  function listChallenges() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'challenge list' })
  }

  function acceptChallenge(uuid: string) {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.sendMessage({ type: 'accept challenge', uuid })
  }

  function addOpenListener(listener: OpenListener) {
    openListeners.push(listener)
  }

  function removeOpenListener(listener: OpenListener) {
    openListeners.splice(openListeners.indexOf(listener), 1)
  }

  function addMessageListener(listener: MessageListener) {
    messageListeners.push(listener)
  }
  function removeMessageListener(listener: MessageListener) {
    messageListeners.splice(messageListeners.indexOf(listener), 1)
  }

  return {
    webSocket,
    assign,
    unassign,
    requestGame,
    ready,
    sendUserData,
    requestState,
    makePausingMove,
    passMove,
    makeRealtimeMove,
    timeout,
    resign,
    addOpenListener,
    removeOpenListener,
    addMessageListener,
    removeMessageListener,
    listChallenges,
    acceptChallenge
  }
})
