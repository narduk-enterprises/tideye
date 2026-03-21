<script setup lang="ts">
import { ref, watch } from 'vue'
import WindClassic from './WindClassic.vue'

const views = [WindClassic]

const props = defineProps<{
  currentView: number
}>()

const currentViewIndex = ref(props.currentView)

watch(
  () => props.currentView,
  (newView) => {
    currentViewIndex.value = newView
  },
)
</script>

<template>
  <div class="widget wind-container">
    <component :is="views[currentViewIndex]" />
  </div>
</template>

<style scoped>
.wind-container {
  cursor: pointer;
  transition: transform 0.2s ease;
  height: 100%;
  padding: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
}

.wind-container:active {
  transform: scale(0.98);
}
</style>
