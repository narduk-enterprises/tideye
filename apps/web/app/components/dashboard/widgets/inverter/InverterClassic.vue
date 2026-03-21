<script setup lang="ts">
import InverterWidgetBase from './InverterWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getStatusColor = (power: number) => {
  if (power > 2000) return '#4CAF50' // High power
  if (power > 500) return '#FFA726' // Medium power
  return '#64B5F6' // Low/No power
}
</script>

<template>
  <InverterWidgetBase v-slot="{ inverters, totalPower, formatPower }">
    <WidgetContainer title="Inverter Status">
      <div class="classic-content">
        <div class="total-power">
          <div class="power-value" :style="{ color: getStatusColor(totalPower) }">
            {{ formatPower(totalPower) }}
          </div>
          <div class="power-label">Total Output</div>
        </div>

        <div class="inverters-grid">
          <div v-for="[id, inverter] in inverters" :key="id" class="inverter-item">
            <div class="inverter-header">
              <span class="inverter-name">Inverter {{ id }}</span>
              <span class="inverter-mode">{{ inverter.mode?.value }}</span>
            </div>
            <div class="inverter-stats">
              <div class="stat">
                <span class="label">Output:</span>
                <span class="value">{{ formatPower(inverter.acout?.power?.value || 0) }}</span>
              </div>
              <div class="stat">
                <span class="label">Input:</span>
                <span class="value">{{ formatPower(inverter.acin?.power?.value || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </InverterWidgetBase>
</template>

<style scoped>
.classic-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.total-power {
  text-align: center;
}

.power-value {
  font-size: 2.5rem;
  font-family: var(--font-mono);
  font-weight: 500;
  line-height: 1;
  transition: color 0.3s ease;
}

.power-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: 0.25rem;
}

.inverters-grid {
  display: grid;
  gap: 1rem;
}

.inverter-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.inverter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.inverter-name {
  font-weight: 500;
}

.inverter-mode {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.inverter-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.label {
  color: var(--color-text-secondary);
}

.value {
  font-family: var(--font-mono);
}
</style>
