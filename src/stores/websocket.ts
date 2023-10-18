import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getClientInfo } from '@/util'
import type { ReplayResultReason } from 'pujo-puyo-core'

type OpenListener = () => void
type MessageListener = (message: any) => void

export const useWebSocketStore = defineStore('websocket', () => {
  const webSocket = ref<WebSocket | null>(null)

  const openListeners: Set<OpenListener> = new Set()
  const messageListeners: Set<MessageListener> = new Set()

  function assign(socket: WebSocket) {
    webSocket.value = socket

    socket.onopen = () => {
      for (const listener of openListeners) {
        listener()
      }
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
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

  function sendGameRequest(socket: WebSocket) {
    socket.send(
      JSON.stringify({
        type: 'game request',
        name: localStorage.getItem('name') || undefined,
        clientInfo: getClientInfo()
      })
    )
  }

  function requestGame() {
    if (guard(false)) {
      // eslint-disable-next-line no-inner-declarations
      function requestOnOpen() {
        const socket = webSocket.value!
        sendGameRequest(socket)
        removeOpenListener(requestOnOpen)
      }
      addOpenListener(requestOnOpen)
      return
    }
    const socket = webSocket.value!
    sendGameRequest(socket)
  }

  function requestState() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.send(JSON.stringify({ type: 'simple state request' }))
  }

  function makeMove(
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
    socket.send(JSON.stringify({ type: 'move', x1, y1, orientation, hardDrop, msRemaining }))
  }

  function passMove() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    socket.send(JSON.stringify({ type: 'move', pass: true }))
  }

  function timeout() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    const reason: ReplayResultReason = 'timeout'
    socket.send(JSON.stringify({ type: 'result', reason }))
  }

  function resign() {
    if (guard()) {
      return
    }
    const socket = webSocket.value!
    const reason: ReplayResultReason = 'resignation'
    socket.send(JSON.stringify({ type: 'result', reason }))
  }

  function addOpenListener(listener: OpenListener) {
    openListeners.add(listener)
  }

  function removeOpenListener(listener: OpenListener) {
    openListeners.delete(listener)
  }

  function addMessageListener(listener: MessageListener) {
    messageListeners.add(listener)
  }
  function removeMessageListener(listener: MessageListener) {
    messageListeners.delete(listener)
  }

  return {
    webSocket,
    assign,
    unassign,
    requestGame,
    requestState,
    makeMove,
    passMove,
    timeout,
    resign,
    addOpenListener,
    removeOpenListener,
    addMessageListener,
    removeMessageListener
  }
})
