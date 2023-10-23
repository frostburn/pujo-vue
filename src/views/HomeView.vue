<script setup lang="ts">
import { ref, watch } from 'vue'

const name = ref(localStorage.getItem('name') || '')

watch(name, (newValue) => localStorage.setItem('name', newValue))
</script>

<template>
  <main>
    <h1>Welcome to Artemisia, {{ name || '(Anonymous)' }}!</h1>
    <label for="name">Set your name: </label>
    <input id="name" type="text" v-model="name" />
    <h2>Notes about the alpha version</h2>
    <p>Things are a still a bit rough around here...</p>
    <p>Missing features include:</p>
    <ul>
      <li>Realtime online play</li>
      <li>Proper online matchmaking</li>
      <li>Private matchmaking</li>
      <li>Online profiles and ranking</li>
      <li>Storing more than the latest replay</li>
      <li>Smartphone support (responsive design)</li>
      <li>Classic (gravity-based) interface</li>
      <li>Layout tweaks</li>
    </ul>
    <p>Thank you for your patience!</p>
    <h3>Controls</h3>
    <p>
      It's recommended to use the mouse. Click on the playing field to lock in the primary panel and
      orbit the secondary panel in place before releasing the mouse button to commit the move.
    </p>
    <p>
      You can also move the cursor with <b>W,A,S,D</b> or the <b>Arrow Keys</b>. Lock the primary
      panel with the <b>Spacebar</b> and orbit the secondary with <b>J</b> and <b>K</b>.
    </p>
    <p>You can cancel a move before committing by moving far away from the locked panel.</p>
  </main>
</template>
