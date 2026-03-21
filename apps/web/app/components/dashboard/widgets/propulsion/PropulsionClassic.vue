<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getPropulsionData } = useSignalKData()
const propulsionData = getPropulsionData()

const engines = computed(() => {
  if (!propulsionData.value) return []

  const enginesList: Array<{
    id: string
    label: string
    state: string
    revolutions: number
    temperature: number | null
  }> = []

  for (const [id, engine] of Object.entries(propulsionData.value)) {
    enginesList.push({
      id,
      label: engine?.label?.value ?? id,
      state: engine?.state?.value ?? 'unknown',
      revolutions: engine?.revolutions?.value ?? 0,
      temperature: engine?.temperature?.value ?? null,
    })
  }

  return enginesList
})

const formatRPM = (rpm: number): string => {
  return `${Math.round(rpm)} RPM`
}

const formatTemp = (temp: number | null): string => {
  if (temp === null || temp === undefined) return 'N/A'
  return `${temp.toFixed(0)}°F`
}

const getStateColor = (state: string): string => {
  const stateLower = state.toLowerCase()
  if (stateLower === 'running' || stateLower === 'on') return 'var(--color-success)'
  if (stateLower === 'starting' || stateLower === 'warming') return 'var(--color-warning)'
  if (stateLower === 'stopped' || stateLower === 'off') return 'var(--color-text-tertiary)'
  return 'var(--color-text-secondary)'
}
</script>

<template>
  <WidgetContainer title="Propulsion">
    <div class="propulsion-display">
      <div v-if="engines.length === 0" class="no-engines">
        <span class="no-data-text">No engine data available</span>
      </div>

      <div v-for="engine in engines" :key="engine.id" class="engine-card">
        <div class="engine-header">
          <span class="engine-label">{{ engine.label }}</span>
          <span class="engine-state" :style="{ color: getStateColor(engine.state) }">
            {{ engine.state }}
          </span>
        </div>

        <div class="engine-metrics">
          <div class="metric">
            <span class="metric-label">RPM</span>
            <span class="metric-value">{{ formatRPM(engine.revolutions) }}</span>
          </div>

          <div v-if="engine.temperature !== null" class="metric">
            <span class="metric-label">Temp</span>
            <span class="metric-value">{{ formatTemp(engine.temperature) }}</span>
          </div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.propulsion-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.no-engines {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.no-data-text {
  color: var(--color-text-tertiary);
  font-size: 0.875rem;
}

.engine-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.engine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.engine-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.engine-state {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.engine-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
}
</style>
