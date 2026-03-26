<script setup lang="ts">
import NavigationClassic from './NavigationClassic.vue'

const views = [NavigationClassic]
const currentViewIndex = ref(0)

const toggleView = () => {
  currentViewIndex.value = (currentViewIndex.value + 1) % views.length
}
</script>

<template>
  <div @click="toggleView" class="widget navigation-container">
    <component :is="views[currentViewIndex]" />
  </div>
</template>

<style scoped>
.navigation-container {
  cursor: pointer;
  transition: transform 0.2s ease;
  height: 100%;
  padding: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
}

.navigation-container:active {
  transform: scale(0.98);
}
</style>
