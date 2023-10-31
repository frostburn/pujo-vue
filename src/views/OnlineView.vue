<script setup lang="ts">
import type { Challenge, ServerMessage } from '@/server-api'
import { useWebSocketStore } from '@/stores/websocket'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const LOG = import.meta.env.DEV

const websocket = useWebSocketStore()

const botsAllowed = ref(false)

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
  if (websocket.clientSocket) {
    websocket.clientSocket.addMessageListener(onMessage)
  } else {
    throw new Error('Websocket unavailable')
  }
  websocket.sendUserData()
  websocket.listChallenges()
  pollId.value = window.setInterval(pollChallenges, 500)
})

onUnmounted(() => {
  if (websocket.clientSocket) {
    websocket.clientSocket.removeMessageListener(onMessage)
  }
  if (pollId.value) {
    window.clearInterval(pollId.value)
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
    <input id="allow-bots" type="checkbox" v-model="botsAllowed" />
    <label for="allow-bots"> Accept challenges from bots</label>
    <ul>
      <li>
        <router-link :to="{ name: 'play-pausing', query: { b: botsAllowed ? '1' : '0' } }"
          >Pausing</router-link
        >
      </li>
      <li>
        <router-link :to="{ name: 'play-realtime', query: { b: botsAllowed ? '1' : '0' } }"
          >Realtime</router-link
        >
      </li>
    </ul>
  </main>
</template>
