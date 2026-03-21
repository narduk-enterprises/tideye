<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import EntertainmentClassic from './EntertainmentClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [EntertainmentClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
