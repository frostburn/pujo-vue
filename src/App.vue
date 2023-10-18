<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import { useAudioContextStore } from './stores/audio-context'

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://pujo.lumipakkanen.com/ws/'

const websocket = useWebSocketStore()
const audioContext = useAudioContextStore()

function hello() {
  console.log(`Websocket opened to ${WS_URL}`)
}

function initializeAudio() {
  audioContext.initialize()
}

onMounted(async () => {
  console.log('Mounted the app')

  const socket = new WebSocket(WS_URL)

  websocket.addOpenListener(hello)

  websocket.assign(socket)

  document.addEventListener('mousedown', initializeAudio)
  document.addEventListener('keydown', initializeAudio)
})

onUnmounted(() => {
  console.log('Unmounted the app')

  websocket.removeOpenListener(hello)

  websocket.unassign()

  document.removeEventListener('mousedown', initializeAudio)
  document.removeEventListener('keydown', initializeAudio)

  audioContext.unintialize()
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
  font-size: 12px;
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
