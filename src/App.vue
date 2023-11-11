<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { ClientSocket, useWebSocketStore } from '@/stores/websocket'
import { useAudioContextStore } from './stores/audio-context'
import { goFullscreen, exitFullscreen } from './util'

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://pujo.lumipakkanen.com/ws/'

const websocket = useWebSocketStore()
const audioContext = useAudioContextStore()

function hello() {
  console.log(`Websocket opened to ${WS_URL}`)
}

async function onKeydown(event: KeyboardEvent) {
  if (event.code === 'Enter') {
    goFullscreen()
  }
  await audioContext.initialize()
}

onMounted(() => {
  console.log('Mounted the app')

  const clientSocket = new ClientSocket(WS_URL)

  websocket.clientSocket = clientSocket

  websocket.clientSocket.addConnectedListener(hello)

  document.addEventListener('touchstart', audioContext.initialize)
  document.addEventListener('mousedown', audioContext.initialize)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(async () => {
  console.log('Unmounted the app')

  if (websocket.clientSocket) {
    websocket.clientSocket.removeConnectedListener(hello)
    websocket.clientSocket = null
  }

  document.removeEventListener('touchstart', audioContext.initialize)
  document.removeEventListener('mousedown', audioContext.initialize)
  document.removeEventListener('keydown', onKeydown)

  await audioContext.unintialize()
})
</script>

<template>
  <nav>
    <RouterLink @click="exitFullscreen" to="/">Home</RouterLink>
    <RouterLink @click="exitFullscreen" to="/about">About</RouterLink>
    <RouterLink @click="exitFullscreen" to="/play-online">Play Online</RouterLink>
    <RouterLink @click="goFullscreen" to="/play-cpu">Play CPU</RouterLink>
    <RouterLink @click="goFullscreen" to="/replay">Replay</RouterLink>
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
