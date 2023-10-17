<script setup lang="ts">
import SVGDefs from '@/components/SVGDefs.vue'
</script>

<template>
  <main>
    <svg width="600px" height="300px" xmlns="http://www.w3.org/2000/svg" viewBox="-0.1 -0.1 7 2.5">
      <SVGDefs />
      <use href="#full-logo"></use>
    </svg>
    <h2>Developed by Lumi Pakkanen (frostburn)</h2>
    <p>
      Report bugs and request features at
      <a href="https://github.com/frostburn/pujo-vue/issues">github.com/frostburn/pujo-vue</a>
    </p>
  </main>
</template>

<style scoped>
svg {
  display: block;
  margin-left: auto;
  margin-right: auto;
  margin-top: 100px;
}
main {
  text-align: center;
}
</style>
