<script setup lang="ts">
import WidgetViewSwitcher from '../../shared/WidgetViewSwitcher.vue'
import TanksClassicView from '../shared/TanksClassicView.vue'
import TanksBarsView from '../shared/TanksBarsView.vue'
import TanksRadialView from '../shared/TanksRadialView.vue'
import WaterTanksCombined from './WaterTanksCombined.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const WaterClassic = () => h(TanksClassicView, { title: 'Fresh Water', tankKey: 'freshWater' })
const WaterBars = () => h(TanksBarsView, { title: 'Fresh Water', tankKey: 'freshWater' })
const WaterRadial = () => h(TanksRadialView, { title: 'Fresh Water', tankKey: 'freshWater' })

const views = [WaterTanksCombined, WaterBars, WaterClassic, WaterRadial]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
