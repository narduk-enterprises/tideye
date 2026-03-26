<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{
  views: Component[]
  currentView: number
}>()

const currentViewIndex = computed(() => props.currentView % props.views.length)
</script>

<template>
  <div class="widget widget-container">
    <component :is="views[currentViewIndex]" />
  </div>
</template>

<style scoped>
.widget-container {
  cursor: pointer;
  transition: transform 0.2s ease;
  height: 100%;
  padding: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.widget-container:active {
  transform: scale(0.98);
}
</style>
