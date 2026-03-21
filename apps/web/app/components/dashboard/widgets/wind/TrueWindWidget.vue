<script setup lang="ts">
import WidgetViewSwitcher from '../shared/WidgetViewSwitcher.vue'
import TrueWindMinimal from './TrueWindMinimal.vue'

const props = defineProps<{
  currentView: number
  maxStates?: number
}>()

const views = [TrueWindMinimal]
</script>

<template>
  <WidgetViewSwitcher :views="views" :current-view="props.currentView" />
</template>
