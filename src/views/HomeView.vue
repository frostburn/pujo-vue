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
  </main>
</template>
