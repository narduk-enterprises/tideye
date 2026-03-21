<script setup lang="ts">
import WidgetViewSwitcher from '../../shared/WidgetViewSwitcher.vue'
import WaterTanksClassic from './WaterTanksClassic.vue'
import WaterTanksRadial from './WaterTanksRadial.vue'
import WaterTanksBars from './WaterTanksBars.vue'
import WaterTanksCombined from './WaterTanksCombined.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [WaterTanksCombined, WaterTanksBars, WaterTanksClassic, WaterTanksRadial]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
