<script setup lang="ts">
import { getCursorType } from '@/util'
import { ref, watch } from 'vue'
import { goFullScreen } from '@/util'

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
    <h2><router-link to="play-online">Click here to play online</router-link></h2>
    <h2>
      <router-link @click="goFullScreen" to="play-cpu">Click here to play offline</router-link>
    </h2>
    <h2>Notes about the beta version</h2>
    <p>Things are a still a bit rough around here...</p>
    <p>Missing features include:</p>
    <ul>
      <li>Online profiles and ranking</li>
      <li>Portrait layout for smartphones</li>
      <li>Classic (gravity-based) interface</li>
      <li>Layout tweaks</li>
    </ul>
    <p>Thank you for your patience! Don't forget to turn your phone sideways for now.</p>
    <h2>Controls</h2>
    <p>
      The game goes full screen during gameplay, but if you exit accidentally you can press
      <b>Enter</b> to go full screen again.
    </p>
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
    <p>
      You can cancel a move before committing by moving far away from the locked panel.<br />
      In <i>pausing</i> mode you can wait for the screens to quiet down by pressing the on-screen
      <b>Pass</b> button or by pressing <b>P</b>.
    </p>
    <p>
      If you're on a touch device the <i>Snake</i> interface is a better option. The primary panel
      follows your touch and the secondary panel "snakes" behind. Release the touch to commit the
      move.
    </p>
  </main>
</template>
