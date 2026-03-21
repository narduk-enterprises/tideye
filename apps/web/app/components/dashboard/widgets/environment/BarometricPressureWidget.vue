<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getBarometricPressureData } = useSignalKData()
const pressureData = getBarometricPressureData()

const pressure = computed(() => {
  const outside = pressureData.value?.outside?.value ?? null
  const inside = pressureData.value?.inside?.value ?? null

  return {
    outside: outside !== null ? outside.toFixed(1) : null,
    inside: inside !== null ? inside.toFixed(1) : null,
    hasData: outside !== null || inside !== null,
  }
})
</script>

<template>
  <WidgetContainer title="Barometric Pressure">
    <div class="pressure-display">
      <div v-if="!pressure.hasData" class="no-data">
        <span>No data available</span>
      </div>

      <div v-else class="pressure-grid">
        <div v-if="pressure.outside !== null" class="pressure-item">
          <span class="pressure-label">Outside</span>
          <span class="pressure-value">{{ pressure.outside }} kPa</span>
        </div>

        <div v-if="pressure.inside !== null" class="pressure-item">
          <span class="pressure-label">Inside</span>
          <span class="pressure-value">{{ pressure.inside }} kPa</span>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.pressure-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.no-data {
  color: var(--color-text-tertiary);
  font-size: 0.875rem;
}

.pressure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  width: 100%;
}

.pressure-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pressure-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pressure-value {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
}

@media (max-width: 768px) {
  .pressure-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
