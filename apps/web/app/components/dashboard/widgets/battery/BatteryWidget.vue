<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import BatteryWidgetClassic from './BatteryWidgetClassic.vue'
import BatteryWidgetMinimal from './BatteryWidgetMinimal.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [BatteryWidgetMinimal, BatteryWidgetClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
