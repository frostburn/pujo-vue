<script setup lang="ts">
import TheButton from '../components/TheButton.vue'
</script>

<template>
  <div class="about">
    <h1>This is an about page</h1>
    <div class="content">
      <TheButton />
    </div>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
    flex-flow: row wrap;
  }
  .about > * {
    padding: 10px;
    flex: 1 100%;
  }
}
</style>
