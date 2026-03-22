<script setup lang="ts">
import { h } from 'vue'
import WidgetViewSwitcher from '../../shared/WidgetViewSwitcher.vue'
import TanksClassicView from '../shared/TanksClassicView.vue'
import TanksBarsView from '../shared/TanksBarsView.vue'
import TanksRadialView from '../shared/TanksRadialView.vue'
import FuelTanksGallons from './FuelTanksGallons.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const FuelClassic = () => h(TanksClassicView, { title: 'Fuel', tankKey: 'fuel' })
const FuelBars = () => h(TanksBarsView, { title: 'Fuel', tankKey: 'fuel' })
const FuelRadial = () => h(TanksRadialView, { title: 'Fuel', tankKey: 'fuel' })

const views = [FuelTanksGallons, FuelBars, FuelClassic, FuelRadial, FuelTanksGallons]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
