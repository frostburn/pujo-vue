<script setup lang="ts">
import PlayingField from './components/PlayingField.vue'

/*
import { onMounted, onUnmounted } from 'vue';
import { useWebSocketStore } from '@/stores/websocket'
import { SimpleGame } from 'pujo-puyo-core';
const websocket = useWebSocketStore();

function requestGame() {
  websocket.requestGame();
}

function requestState() {
  websocket.requestState();
}

function onMessage(message: any) {
  if (message.type === "simple state") {
    const game = SimpleGame.fromJSON(message.state);
    game.log();
    websocket.makeMove(0, 2, 0);
  }

  if (message.type === "game result") {
    console.log(message.result, message.reason);
    websocket.requestGame();
  }
}

onMounted(() => {
  console.log("Mounted the app");

  const socket = new WebSocket("ws://localhost:3003");

  websocket.addOpenListener(requestGame);
  websocket.addMessageListener(onMessage);

  websocket.assign(socket);
});

onUnmounted(() => {
  console.log("Unmounted the app");

  websocket.removeOpenListener(requestGame);
  websocket.removeMessageListener(onMessage);

  websocket.unassign();
});
*/
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
