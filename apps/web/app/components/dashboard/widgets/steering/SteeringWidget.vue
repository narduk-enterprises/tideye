<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import SteeringClassic from './SteeringClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [SteeringClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
