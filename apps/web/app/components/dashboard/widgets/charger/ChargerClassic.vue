<script setup lang="ts">
import ChargerWidgetBase from './ChargerWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getStatusColor = (power: number) => {
  if (power > 2000) return '#4CAF50'
  if (power > 500) return '#FFA726'
  return '#64B5F6'
}

const getChargingModeLabel = (mode: string) => {
  const modes: Record<string, string> = {
    bulk: 'Bulk',
    absorption: 'Absorption',
    float: 'Float',
    unknown: 'Unknown',
  }
  return modes[mode] || mode
}
</script>

<template>
  <ChargerWidgetBase v-slot="{ chargers, totalPower, formatPower }">
    <WidgetContainer title="Charger Status">
      <div class="classic-content">
        <div class="total-power">
          <div class="power-value" :style="{ color: getStatusColor(totalPower) }">
            {{ formatPower(totalPower) }}
          </div>
          <div class="power-label">Total Charging</div>
        </div>

        <div class="chargers-grid">
          <div v-for="[id, charger] in chargers" :key="id" class="charger-item">
            <div class="charger-header">
              <span class="charger-name">Charger {{ id }}</span>
              <span class="charger-mode">{{
                getChargingModeLabel(charger.chargingMode?.value || 'unknown')
              }}</span>
            </div>
            <div class="charger-stats">
              <div class="stat">
                <span class="label">Power:</span>
                <span class="value">{{ formatPower(charger.power?.value || 0) }}</span>
              </div>
              <div class="stat">
                <span class="label">Current:</span>
                <span class="value">{{ (charger.current?.value || 0).toFixed(1) }}A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </ChargerWidgetBase>
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

.chargers-grid {
  display: grid;
  gap: 1rem;
}

.charger-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.charger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.charger-name {
  font-weight: 500;
}

.charger-mode {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.charger-stats {
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
