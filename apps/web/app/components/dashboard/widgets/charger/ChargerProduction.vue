<script setup lang="ts">
import ChargerWidgetBase from './ChargerWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getLedColor = (value: number) => {
  return value ? '#4CAF50' : 'rgba(255, 255, 255, 0.1)'
}

const getWarningLedColor = (value: number) => {
  return value ? '#FF5252' : 'rgba(255, 255, 255, 0.1)'
}
</script>

<template>
  <ChargerWidgetBase v-slot="{ chargers, totalPower, formatPower }">
    <WidgetContainer title="Charger Production">
      <div class="production-content">
        <div class="total-section">
          <div class="total-label">Total Charging Power</div>
          <div class="total-value">{{ formatPower(totalPower) }}</div>
        </div>

        <div class="chargers-details">
          <div v-for="[id, charger] in chargers" :key="id" class="charger-detail">
            <div class="detail-header">Charger {{ id }}</div>
            <div class="metrics">
              <div class="metric">
                <span class="metric-label">Power</span>
                <span class="metric-value">{{ formatPower(charger.power?.value || 0) }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Voltage</span>
                <span class="metric-value">{{ (charger.voltage?.value || 0).toFixed(1) }}V</span>
              </div>
              <div class="metric">
                <span class="metric-label">Current</span>
                <span class="metric-value">{{ (charger.current?.value || 0).toFixed(1) }}A</span>
              </div>
              <div class="metric">
                <span class="metric-label">Mode</span>
                <span class="metric-value">{{ charger.mode?.value || 'unknown' }}</span>
              </div>
            </div>
            <div class="leds-section">
              <div
                class="led"
                :style="{ backgroundColor: getLedColor(charger.leds?.bulk?.value || 0) }"
                title="Bulk"
              />
              <div
                class="led"
                :style="{ backgroundColor: getLedColor(charger.leds?.absorption?.value || 0) }"
                title="Absorption"
              />
              <div
                class="led"
                :style="{ backgroundColor: getLedColor(charger.leds?.float?.value || 0) }"
                title="Float"
              />
              <div
                class="led"
                :style="{
                  backgroundColor: getWarningLedColor(charger.leds?.temperature?.value || 0),
                }"
                title="Temperature"
              />
              <div
                class="led"
                :style="{
                  backgroundColor: getWarningLedColor(charger.leds?.lowBattery?.value || 0),
                }"
                title="Low Battery"
              />
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </ChargerWidgetBase>
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

.chargers-details {
  display: grid;
  gap: 1rem;
}

.charger-detail {
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
  margin-bottom: 1rem;
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

.leds-section {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.led {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}
</style>
