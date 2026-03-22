<script setup lang="ts">
import SolarWidgetBase from './SolarWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getStatusColor = (power: number) => {
  if (power > 500) return '#4CAF50' // High production
  if (power > 100) return '#FFA726' // Medium production
  return '#64B5F6' // Low/No production
}
</script>

<template>
  <SolarWidgetBase v-slot="{ panels, formatPower, formatYield }">
    <WidgetContainer title="Solar Production">
      <div class="solar-content">
        <div v-for="panel in panels" :key="panel.name" class="panel-section">
          <div class="panel-header">
            <div class="panel-name">{{ panel.name }}</div>
            <div class="panel-mode" :class="panel.mode">{{ panel.mode }}</div>
          </div>

          <div class="panel-metrics">
            <div class="metric">
              <div class="metric-value" :style="{ color: getStatusColor(panel.power) }">
                {{ formatPower(panel.power) }}W
              </div>
              <div class="metric-label">POWER</div>
            </div>
            <div class="metric">
              <div class="metric-value">
                {{ panel.voltage ? panel.voltage.toFixed(1) : '0.0' }}V
              </div>
              <div class="metric-label">VOLTAGE</div>
            </div>
            <div class="metric">
              <div class="metric-value">
                {{ panel.current ? panel.current.toFixed(1) : '0.0' }}A
              </div>
              <div class="metric-label">CURRENT</div>
            </div>
            <div class="metric yield">
              <div class="metric-value">{{ formatYield(panel.yieldToday) }}</div>
              <div class="metric-label">kWh TODAY</div>
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </SolarWidgetBase>
</template>

<style scoped>
.solar-content {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.4rem;
  height: 100%;
}

.panel-section {
  background: color-mix(in srgb, var(--te-value) 8%, transparent);
  border-radius: 8px;
  padding: 0.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.panel-name {
  font-size: 0.95rem;
  color: var(--te-value);
}

.panel-mode {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: color-mix(in srgb, var(--te-value) 8%, transparent);
}

.panel-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}

.metric {
  text-align: center;
}

.metric-value {
  font-size: 1rem;
  font-family: var(--te-font-data);
  color: var(--te-value);
}

.metric-label {
  font-size: 0.6rem;
  color: var(--te-label);
  letter-spacing: 0.05em;
  margin-top: 0.2rem;
}

.yield {
  grid-column: 4;
}
</style>
