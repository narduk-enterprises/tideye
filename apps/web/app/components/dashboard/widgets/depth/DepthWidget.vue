<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import DepthClassic from './DepthClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [DepthClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
