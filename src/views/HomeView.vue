<script setup lang="ts">
import { getCursorType } from '@/util'
import { ref, watch } from 'vue'

const name = ref(localStorage.getItem('name') || '')

const cursorType = ref(getCursorType())

watch(name, (newValue) => localStorage.setItem('name', newValue))

watch(cursorType, (newValue) => localStorage.setItem('cursorType', newValue))
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
      <li>Proper online matchmaking</li>
      <li>Private matchmaking</li>
      <li>Online profiles and ranking</li>
      <li>Storing more than the latest replay</li>
      <li>Portrait layout for smartphones</li>
      <li>Classic (gravity-based) interface</li>
      <li>Layout tweaks</li>
    </ul>
    <p>Thank you for your patience!</p>
    <h2>Controls</h2>
    <label>Interface type: </label>
    <input type="radio" id="lock-orbit" value="lock-orbit" v-model="cursorType" />
    <label for="lock-orbit"> Lock/Orbit </label>
    <input type="radio" id="snake" value="snake" v-model="cursorType" />
    <label for="snake"> Snake </label>
    <br />
    <p>
      It's recommended to use the mouse with the <i>Lock/Orbit</i> interface. Click on the playing
      field to lock in the primary panel and orbit the secondary panel in place before releasing the
      mouse button to commit the move.
    </p>
    <p>
      You can also move the cursor with <b>W,A,S,D</b> or the <b>Arrow Keys</b>. Lock the primary
      panel with the <b>Spacebar</b> and orbit the secondary with <b>J</b> and <b>K</b>.
    </p>
    <p>You can cancel a move before committing by moving far away from the locked panel.</p>
    <p>
      If you're on a touch device the <i>Snake</i> interface is a better option. The primary panel
      follows your touch and the secondary panel "snakes" behind. Release the touch to commit the
      move.
    </p>
  </main>
</template>
