<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import { formatDuration } from '~/utils/timeFormatting'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getBatteryData } = useSignalKData()
const batteryStatus = getBatteryData()
const voltage = computed(() => batteryStatus.value?.voltage?.value || 0)
const current = computed(() => batteryStatus.value?.current?.value || 0)
const stateOfCharge = computed(() => batteryStatus.value?.capacity?.stateOfCharge?.value || 0)

// Add time until fully charged calculation
const timeUntilFullyCharged = computed(() => {
  // Only calculate if we're charging (positive current)
  if (current.value <= 0) return null

  const TOTAL_CAPACITY_AH = 900 // Total battery capacity in amp hours
  const currentChargeAh = TOTAL_CAPACITY_AH * stateOfCharge.value
  const remainingAh = TOTAL_CAPACITY_AH - currentChargeAh

  // Convert current from amps to amp hours per hour (they're the same numerically)
  const chargingRateAh = Math.abs(current.value)
  const hoursToFull = remainingAh / chargingRateAh

  return {
    formatted: formatDuration(hoursToFull * 3600),
  }
})

const battery = computed(() => ({
  name: batteryStatus.value?.name?.value || 'Unknown Battery',
  powerDirection:
    batteryStatus.value?.power?.value && batteryStatus.value?.power?.value > 0
      ? 'Charging'
      : 'Discharging',
  timeRemaining: (() => {
    const seconds = batteryStatus.value?.capacity?.timeRemaining?.value || 0
    return formatDuration(seconds)
  })(),
  timeUntilFullyCharged: timeUntilFullyCharged.value?.formatted || 'N/A',
  chargePercentage: (stateOfCharge.value * 100).toFixed(1),
  voltage: voltage.value.toFixed(1),
  current: Math.abs(current.value).toFixed(1),
  power: Math.abs(batteryStatus.value?.power?.value ?? 0).toFixed(0),
}))
</script>

<template>
  <WidgetContainer :title="battery.name">
    <slot :battery="battery" />
  </WidgetContainer>
</template>
