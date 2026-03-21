<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import InverterMinimal from './InverterMinimal.vue'
import InverterClassic from './InverterClassic.vue'
import InverterProduction from './InverterProduction.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [InverterMinimal, InverterClassic, InverterProduction]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
