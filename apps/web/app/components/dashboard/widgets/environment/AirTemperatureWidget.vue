<script setup lang="ts">
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getAirTemperatureData } = useSignalKData()
const airTempData = getAirTemperatureData()

const airTemp = computed(() => {
  const outside = airTempData.value?.outside?.value ?? null
  const inside = airTempData.value?.inside?.value ?? null

  return {
    outside: outside !== null ? outside.toFixed(1) : null,
    inside: inside !== null ? inside.toFixed(1) : null,
    hasData: outside !== null || inside !== null,
  }
})
</script>

<template>
  <WidgetContainer title="Air Temperature">
    <div class="air-temp-display">
      <div v-if="!airTemp.hasData" class="no-data">
        <span>No data available</span>
      </div>

      <div v-else class="temp-grid">
        <div v-if="airTemp.outside !== null" class="temp-item">
          <span class="temp-label">Outside</span>
          <span class="temp-value">{{ airTemp.outside }}°F</span>
        </div>

        <div v-if="airTemp.inside !== null" class="temp-item">
          <span class="temp-label">Inside</span>
          <span class="temp-value">{{ airTemp.inside }}°F</span>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.air-temp-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.no-data {
  color: var(--te-label);
  font-size: 0.875rem;
}

.temp-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  width: 100%;
}

.temp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.temp-label {
  font-size: 0.75rem;
  color: var(--te-unit);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.temp-value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--te-value);
  font-family: var(--font-mono, monospace);
}

@media (max-width: 768px) {
  .temp-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
