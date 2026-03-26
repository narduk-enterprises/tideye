<script setup lang="ts">
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getCurrentData } = useSignalKData()
const currentData = getCurrentData()

const current = computed(() => {
  const setTrue = currentData.value?.setTrue?.value ?? null
  const setMagnetic = currentData.value?.setMagnetic?.value ?? null
  const drift = currentData.value?.drift?.value ?? null

  return {
    setTrue: setTrue !== null ? setTrue.toFixed(1) : null,
    setMagnetic: setMagnetic !== null ? setMagnetic.toFixed(1) : null,
    drift: drift !== null ? drift.toFixed(2) : null,
    hasData: setTrue !== null || setMagnetic !== null || drift !== null,
  }
})
</script>

<template>
  <WidgetContainer title="Current">
    <div class="current-display">
      <div v-if="!current.hasData" class="no-data">
        <span>No data available</span>
      </div>

      <div v-else class="current-grid">
        <div v-if="current.setTrue !== null" class="current-item">
          <span class="current-label">Set (True)</span>
          <span class="current-value">{{ current.setTrue }}°</span>
        </div>

        <div v-if="current.setMagnetic !== null" class="current-item">
          <span class="current-label">Set (Mag)</span>
          <span class="current-value">{{ current.setMagnetic }}°</span>
        </div>

        <div v-if="current.drift !== null" class="current-item">
          <span class="current-label">Drift</span>
          <span class="current-value">{{ current.drift }} kts</span>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.current-display {
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

.current-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  width: 100%;
}

.current-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.current-label {
  font-size: 0.75rem;
  color: var(--te-unit);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.current-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--te-value);
  font-family: var(--font-mono, monospace);
}

@media (max-width: 768px) {
  .current-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
