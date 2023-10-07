<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  number: number
  age: number
  x: number
  y: number
}>()

const opacity = computed(() => {
  const x = 0.1 * props.age
  return x * Math.exp(1 - x)
})
</script>

<template>
  <rect
    :x="x - 0.2"
    :y="y - 0.8"
    :width="number < 10 ? 3.4 : 3.8"
    rx="0.15"
    height="1"
    fill="rgba(255, 250, 240, 0.5)"
    stroke="rgba(50, 40, 30, 0.4)"
    stroke-width="0.1"
    :opacity="opacity"
  ></rect>
  <text :x="x" :y="y" class="chain" :opacity="opacity"> {{ number }}-Chain </text>
</template>
