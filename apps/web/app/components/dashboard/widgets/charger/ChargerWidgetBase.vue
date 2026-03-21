<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import type { Charger } from '~/types/signalk/charger'

const { getChargerData } = useSignalKData()
const rawChargerData = getChargerData()

const chargerData = computed(() => {
  try {
    const rawChargers = rawChargerData.value

    if (!rawChargers) {
      return new Map<string, Charger>()
    }

    // Convert object to Map if it's not already a Map
    return rawChargers instanceof Map ? rawChargers : new Map(Object.entries(rawChargers))
  } catch (error) {
    console.error('Error in chargerData computed:', error)
    return new Map<string, Charger>()
  }
})

const totalChargingPower = computed(() => {
  try {
    if (!chargerData.value) {
      return 0
    }

    let total = 0
    for (const charger of chargerData.value) {
      total += charger?.power?.value || 0
    }
    return total
  } catch (error) {
    console.error('Error in totalChargingPower computed:', error)
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
  <slot :chargers="chargerData" :total-power="totalChargingPower" :format-power="formatPower" />
</template>
