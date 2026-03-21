<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import ChargerMinimal from './ChargerMinimal.vue'
import ChargerClassic from './ChargerClassic.vue'
import ChargerProduction from './ChargerProduction.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [ChargerMinimal, ChargerClassic, ChargerProduction]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
