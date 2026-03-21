<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'

const { getSolarData } = useSignalKData()
const solarData = getSolarData()

const totalCurrentPower = computed(() => {
  const power1 = solarData.value?.tideyeSolar1?.panelPower?.value || 0
  const power2 = solarData.value?.tideyeSolar2?.panelPower?.value || 0
  return power1 + power2
})

const panels = computed(() => {
  const panelsArray = [
    {
      name: solarData.value?.tideyeSolar1?.name?.value || 'Panel 1',
      power: solarData.value?.tideyeSolar1?.panelPower?.value || 0,
      voltage: solarData.value?.tideyeSolar1?.voltage?.value || 0,
      current: solarData.value?.tideyeSolar1?.current?.value || 0,
      yieldToday: solarData.value?.tideyeSolar1?.yieldToday?.value || 0,
      yieldYesterday: solarData.value?.tideyeSolar1?.yieldYesterday?.value || 0,
      mode: solarData.value?.tideyeSolar1?.controllerMode?.value || 'unknown',
    },
    {
      name: solarData.value?.tideyeSolar2?.name?.value || 'Panel 2',
      power: solarData.value?.tideyeSolar2?.panelPower?.value || 0,
      voltage: solarData.value?.tideyeSolar2?.voltage?.value || 0,
      current: solarData.value?.tideyeSolar2?.current?.value || 0,
      yieldToday: solarData.value?.tideyeSolar2?.yieldToday?.value || 0,
      yieldYesterday: solarData.value?.tideyeSolar2?.yieldYesterday?.value || 0,
      mode: solarData.value?.tideyeSolar2?.controllerMode?.value || 'unknown',
    },
  ]
  //console.log('Panels Array:', panelsArray);
  return panelsArray
})

// Helper function to format power values
const formatPower = (value: number) => {
  return value.toFixed(1)
}

// Helper function to format yield values (convert Joules to kWh)
const formatYield = (value: number) => {
  return (value / 3600000).toFixed(2)
}
</script>

<template>
  <slot
    :panels="panels"
    :total-power="totalCurrentPower"
    :format-power="formatPower"
    :format-yield="formatYield"
  />
</template>
