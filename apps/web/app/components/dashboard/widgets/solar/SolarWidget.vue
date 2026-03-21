<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import SolarMinimal from './SolarMinimal.vue'
import SolarClassic from './SolarClassic.vue'
import SolarProduction from './SolarProduction.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [SolarMinimal, SolarClassic, SolarProduction]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
