<script setup lang="ts">
defineProps({
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    default: 2.5
  },
  height: {
    type: Number,
    default: 0.8
  }
})
</script>
<template xmlns="http://www.w3.org/2000/svg">
  <g class="control">
    <rect :x="x" :y="y" rx="0.1" :width="width" :height="height"></rect>
    <text :x="x + width / 2" :y="y + 0.55"><slot></slot></text>
  </g>
</template>
