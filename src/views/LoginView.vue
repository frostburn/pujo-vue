<script setup lang="ts">
import type { ServerMessage } from '@/server-api'
import { useWebSocketStore } from '@/stores/websocket'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const authUuid = route.params.uuid as string
const existing = ref(localStorage.getItem('authUuid'))

const websocket = useWebSocketStore()

const name = ref(localStorage.getItem('name') ?? '')

const location = window.location.href

function onMessage(message: ServerMessage) {
  if (message.type === 'self') {
    name.value = message.username
    localStorage.setItem('name', message.username)
  }
}

function login() {
  existing.value = null
  localStorage.setItem('authUuid', authUuid)
  websocket.getUserData()
}

if (existing.value === null) {
  login()
}

function copyToClipboard() {
  window.navigator.clipboard.writeText(location)
}

onMounted(() => {
  if (websocket.clientSocket) {
    websocket.clientSocket.addMessageListener(onMessage)
  } else {
    throw new Error('Websocket unavailable')
  }
})

onUnmounted(() => {
  if (websocket.clientSocket) {
    websocket.clientSocket.removeMessageListener(onMessage)
  }
})
</script>
<template>
  <main>
    <h1>Login from another device</h1>
    <div v-if="existing === null">
      <p>
        You're now logged in as <i>{{ name }}</i
        >.
      </p>
    </div>
    <div v-else-if="authUuid === existing">
      <p>
        Use this link to login from another device <input :value="location" size="60" />
        <button @click="copyToClipboard">copy</button>.
      </p>
    </div>
    <div v-else>
      <p>
        You're already logged in as <i>{{ name }}</i
        >.
      </p>
      <p>
        Click <button @click="login">here</button> to confirm that you wish to login as another
        user.
      </p>
    </div>
  </main>
</template>
