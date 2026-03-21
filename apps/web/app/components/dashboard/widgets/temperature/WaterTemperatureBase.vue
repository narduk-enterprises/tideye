<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import { Temperatures } from '~/utils/conversions'

const { getWaterTempData } = useSignalKData()
const waterTempData = getWaterTempData()

const waterTemp = computed(() => {
  const temp = waterTempData.value?.value
  return temp ? Temperatures.kelvinToFahrenheit(temp).toFixed(1) : '0.0'
})

defineExpose({
  waterTemp,
})
</script>

<template>
  <slot :temperature="waterTemp" />
</template>
