<script setup lang="ts">
import type { Challenge, ServerMessage } from '@/server-api'
import { useWebSocketStore } from '@/stores/websocket'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const LOG = import.meta.env.DEV

const websocket = useWebSocketStore()

const challenges = reactive<Challenge[]>([])

const pollId = ref<number | null>(null)

function onMessage(message: ServerMessage) {
  if (LOG) {
    console.log(message)
  }
  if (message.type === 'challenge list') {
    challenges.length = 0
    for (const challenge of message.challenges) {
      challenges.push(challenge)
    }
  }
}

function pollChallenges() {
  websocket.listChallenges()
}

onMounted(() => {
  websocket.addMessageListener(onMessage)
  websocket.sendUserData()
  websocket.listChallenges()
  pollId.value = setInterval(pollChallenges, 500)
})

onUnmounted(() => {
  websocket.removeMessageListener(onMessage)
  if (pollId.value) {
    clearInterval(pollId.value)
  }
})
</script>

<template>
  <main>
    <h1>Open challenges</h1>
    <ul>
      <li v-for="challenge of challenges" :key="challenge.uuid">
        <router-link
          v-if="challenge.gameType === 'pausing'"
          :to="{ name: 'play-pausing', params: { uuid: challenge.uuid } }"
        >
          {{ challenge.name }} / {{ challenge.gameType }}
        </router-link>
        <router-link v-else :to="{ name: 'play-realtime', params: { uuid: challenge.uuid } }">
          {{ challenge.name }} / {{ challenge.gameType }}
        </router-link>
      </li>
    </ul>
    <h2>Automatch</h2>
    <ul>
      <li><router-link to="/play-pausing">Pausing</router-link></li>
      <li><router-link to="/play-realtime">Realtime</router-link></li>
    </ul>
  </main>
</template>
