<script setup lang="ts">
import InverterWidgetBase from './InverterWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getEfficiency = (output: number, input: number) => {
  if (input === 0) return 0
  return (output / input) * 100
}
</script>

<template>
  <InverterWidgetBase v-slot="{ inverters, totalPower, formatPower }">
    <WidgetContainer title="Inverter Production">
      <div class="production-content">
        <div class="total-section">
          <div class="total-label">Total Output Power</div>
          <div class="total-value">{{ formatPower(totalPower) }}</div>
        </div>

        <div class="inverters-details">
          <div v-for="[id, inverter] in inverters" :key="id" class="inverter-detail">
            <div class="detail-header">Inverter {{ id }}</div>
            <div class="metrics">
              <div class="metric">
                <span class="metric-label">Output</span>
                <span class="metric-value">{{
                  formatPower(inverter.acout?.power?.value || 0)
                }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Voltage</span>
                <span class="metric-value"
                  >{{ (inverter.acout?.voltage?.value || 0).toFixed(1) }}V</span
                >
              </div>
              <div class="metric">
                <span class="metric-label">Frequency</span>
                <span class="metric-value"
                  >{{ (inverter.acout?.frequency?.value || 0).toFixed(1) }}Hz</span
                >
              </div>
              <div class="metric">
                <span class="metric-label">Efficiency</span>
                <span class="metric-value">
                  {{
                    getEfficiency(
                      inverter.acout?.power?.value || 0,
                      inverter.acin?.power?.value || 0,
                    ).toFixed(1)
                  }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </InverterWidgetBase>
</template>

<style scoped>
.production-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.total-section {
  text-align: center;
}

.total-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.total-value {
  font-size: 2.5rem;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1;
  margin-top: 0.25rem;
}

.inverters-details {
  display: grid;
  gap: 1rem;
}

.inverter-detail {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.detail-header {
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}
</style>
