<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { useSignalKData } from '~/composables/useSignalKData'
import type { Inverter } from '~/types/signalk/inverter'

const { getInverterData } = useSignalKData()
const rawInverterData = getInverterData()

const inverterData = computed(() => {
  try {
    const rawInverters = rawInverterData.value

    if (!rawInverters) {
      return new Map<string, Inverter>()
    }

    // Convert object to Map if it's not already a Map
    return rawInverters instanceof Map ? rawInverters : new Map(Object.entries(rawInverters))
  } catch (error) {
    console.error('Error in inverterData computed:', error)
    return new Map<string, Inverter>()
  }
})

const totalOutputPower = computed(() => {
  try {
    if (!inverterData.value) {
      return 0
    }

    let total = 0
    for (const inverter of inverterData.value) {
      total += inverter?.acout?.power?.value || 0
    }
    return total
  } catch (error) {
    console.error('Error in totalOutputPower computed:', error)
    return 0
  }
})

const formatPower = (watts: number) => {
  try {
    if (!watts || isNaN(watts)) return '0W'
    return watts >= 1000 ? `${(watts / 1000).toFixed(1)}kW` : `${Math.round(watts)}W`
  } catch (error) {
    console.error('Error in formatPower:', error)
    return '0W'
  }
}
</script>

<template>
  <slot :inverters="inverterData" :total-power="totalOutputPower" :format-power="formatPower" />
</template>
