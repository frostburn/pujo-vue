<script setup lang="ts">
defineProps<{
  x: number
  y: number
  text: string
}>()
</script>
<template xmlns="http://www.w3.org/2000/svg">
  <g class="control">
    <rect :x="x" :y="y" rx="0.1" width="2.5" height="0.8"></rect>
    <text :x="x + 1.25" :y="y + 0.55">{{ text }}</text>
  </g>
</template>
