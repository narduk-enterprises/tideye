<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import WaterTemperatureClassic from './WaterTemperatureClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [WaterTemperatureClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
