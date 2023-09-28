import { ref } from 'vue'
import { defineStore } from 'pinia'

type OpenListener = () => void;
type MessageListener = (message: any) => void;

export const useWebSocketStore = defineStore('websocket', () => {
  const webSocket = ref<WebSocket | null>(null);

  const openListeners: Set<OpenListener> = new Set();
  const messageListeners: Set<MessageListener> = new Set();

  function assign(socket: WebSocket) {
    webSocket.value = socket;

    socket.onopen = () => {
      for (const listener of openListeners) {
        listener();
      }
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      for (const listener of messageListeners) {
        listener(message);
      }
    }
  }

  function unassign() {
    const socket = webSocket.value;
    if (socket !== null) {
      socket.close();
      webSocket.value = null;
    }
  }

  function guard() {
    const socket = webSocket.value;
    if (socket === null) {
      console.warn("No WebSocket assigned");
      return false;
    }
    if (socket.readyState !== 1) {
      console.warn("WebSocket not ready yet");
      return false;
    }
    return true;
  }

  function requestGame() {
    if (!guard()) {
      return;
    }
    const socket = webSocket.value!;
    socket.send(JSON.stringify({"type": "game request"}));
  }

  function requestState() {
    if (!guard()) {
      return;
    }
    const socket = webSocket.value!;
    socket.send(JSON.stringify({"type": "simple state request"}));
  }

  function makeMove(x1: number, y1: number, orientation: number) {
    if (!guard()) {
      return;
    }
    const socket = webSocket.value!;
    socket.send(JSON.stringify({"type": "move", x1, y1, orientation}));
  }

  function addOpenListener(listener: OpenListener) {
    openListeners.add(listener);
  }

  function removeOpenListener(listener: OpenListener) {
    openListeners.delete(listener);
  }

  function addMessageListener(listener: MessageListener) {
    messageListeners.add(listener);
  }
  function removeMessageListener(listener: MessageListener) {
    messageListeners.delete(listener);
  }

  return { webSocket, assign, unassign, requestGame, requestState, makeMove, addOpenListener, removeOpenListener, addMessageListener, removeMessageListener }
});
