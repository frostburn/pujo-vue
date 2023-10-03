<script setup lang="ts">
import PlayingField from './components/PlayingField.vue'

import { onMounted, onUnmounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import { useAudioContextStore } from './stores/audio-context'

const WS_URL = 'ws://localhost:3003'

const websocket = useWebSocketStore()
const audioContext = useAudioContextStore()

function hello() {
  console.log(`Websocket opened to ${WS_URL}`)
  websocket.requestGame()
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
  <div class="field-container">
    <PlayingField />
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.field-container {
  height: 800px;
  width: 1000px;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
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

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
