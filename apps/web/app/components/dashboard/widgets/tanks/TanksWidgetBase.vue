<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'

const { getTankData } = useSignalKData()
const tankData = getTankData()

const tanks = computed(() => ({
  freshWater: [
    {
      name: 'Port Water',
      level: tankData.value?.freshWater?.[0]?.currentLevel?.value || 0,
      capacity: tankData.value?.freshWater?.[0]?.capacity?.value,
      type: 'water',
    },
    {
      name: 'Starboard Water',
      level: tankData.value?.freshWater?.[1]?.currentLevel?.value || 0,
      capacity: tankData.value?.freshWater?.[1]?.capacity?.value,
      type: 'water',
    },
  ],
  fuel: [
    {
      name: 'Port Fuel',
      level: tankData.value?.fuel?.[0]?.currentLevel?.value || 0,
      capacity: tankData.value?.fuel?.[0]?.capacity?.value,
      type: 'fuel',
    },
    {
      name: 'Starboard Fuel',
      level: tankData.value?.fuel?.[1]?.currentLevel?.value || 0,
      capacity: tankData.value?.fuel?.[1]?.capacity?.value,
      type: 'fuel',
    },
  ],
}))

const getTankColor = (type: string, level: number) => {
  if (type === 'water') {
    return level < 0.2 ? 'var(--te-danger)' : 'var(--te-water)'
  }
  return level < 0.2 ? 'var(--te-danger)' : 'var(--te-fuel-warn)'
}

const getFuelColor = (totalGallons: number) => {
  // Calculate total capacity from fuel tanks
  const totalCapacity = tanks.value.fuel.reduce((sum, tank) => {
    // If capacity is available, use it; otherwise assume 80 gallons per tank
    return sum + (tank.capacity || 80)
  }, 0)

  if (totalCapacity === 0) {
    return 'var(--te-fuel-warn)' // Default orange if no capacity data
  }

  const level = totalGallons / totalCapacity

  if (level < 0.2) {
    return 'var(--te-fuel-danger)' // Red for low fuel
  } else if (level < 0.5) {
    return 'var(--te-fuel-warn)' // Orange/amber for medium fuel
  }
  return 'var(--te-fuel)' // Green for good fuel level
}

// Expose the data to child components
defineExpose({
  tanks,
  getTankColor,
  getFuelColor,
})
</script>

<template>
  <slot :tanks="tanks" :get-tank-color="getTankColor" :get-fuel-color="getFuelColor"></slot>
</template>
