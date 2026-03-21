<script setup lang="ts">
import WidgetViewSwitcher from '../../shared/WidgetViewSwitcher.vue'
import FuelTanksClassic from './FuelTanksClassic.vue'
import FuelTanksRadial from './FuelTanksRadial.vue'
import FuelTanksBars from './FuelTanksBars.vue'
import FuelTanksGallons from './FuelTanksGallons.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [FuelTanksGallons, FuelTanksBars, FuelTanksClassic, FuelTanksRadial, FuelTanksGallons]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
