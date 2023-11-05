<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { ClientSocket, useWebSocketStore } from '@/stores/websocket'
import { useAudioContextStore } from './stores/audio-context'

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://pujo.lumipakkanen.com/ws/'

const websocket = useWebSocketStore()
const audioContext = useAudioContextStore()

function hello() {
  console.log(`Websocket opened to ${WS_URL}`)
}

onMounted(() => {
  console.log('Mounted the app')

  const clientSocket = new ClientSocket(WS_URL)

  websocket.clientSocket = clientSocket

  websocket.clientSocket.addConnectedListener(hello)

  document.addEventListener('touchstart', audioContext.initialize)
  document.addEventListener('mousedown', audioContext.initialize)
  document.addEventListener('keydown', audioContext.initialize)
})

onUnmounted(async () => {
  console.log('Unmounted the app')

  if (websocket.clientSocket) {
    websocket.clientSocket.removeConnectedListener(hello)
    websocket.clientSocket = null
  }

  document.removeEventListener('touchstart', audioContext.initialize)
  document.removeEventListener('mousedown', audioContext.initialize)
  document.removeEventListener('keydown', audioContext.initialize)

  await audioContext.unintialize()
})
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>
    <RouterLink to="/play-online">Play Online</RouterLink>
    <RouterLink to="/play-cpu">Play CPU</RouterLink>
    <RouterLink to="/replay">Replay</RouterLink>
  </nav>
  <RouterView />
</template>

<style scoped>
nav {
  width: 100%;
  font-size: 19px;
  text-align: center;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}
</style>
