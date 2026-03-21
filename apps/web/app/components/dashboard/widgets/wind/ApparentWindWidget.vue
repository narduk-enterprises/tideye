<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import ApparentWindMinimal from './ApparentWindMinimal.vue'
import ApparentWindClassic from './ApparentWindClassic.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [ApparentWindMinimal, ApparentWindClassic]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
