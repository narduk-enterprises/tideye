<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import PropulsionClassic from './PropulsionClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [PropulsionClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
