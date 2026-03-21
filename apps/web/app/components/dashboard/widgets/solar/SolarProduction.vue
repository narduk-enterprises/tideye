<script setup lang="ts">
import SolarWidgetBase from './SolarWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const calculateTotalYield = (panels: any[], type: 'today' | 'yesterday') => {
  const field = type === 'today' ? 'yieldToday' : 'yieldYesterday'
  return panels.reduce((sum, panel) => sum + panel[field], 0)
}

const getComparisonIndicator = (today: number, yesterday: number) => {
  const diff = today - yesterday
  if (diff > 0) return '↑'
  if (diff < 0) return '↓'
  return '='
}

const getComparisonColor = (today: number, yesterday: number) => {
  const diff = today - yesterday
  if (diff > 0) return '#4CAF50' // Green for increase
  if (diff < 0) return '#FF5252' // Red for decrease
  return '#FFA726' // Orange for same
}
</script>

<template>
  <SolarWidgetBase v-slot="{ panels, totalPower, formatPower, formatYield }">
    <WidgetContainer title="Solar Production">
      <div class="production-content">
        <!-- Current Power -->
        <div class="current-power">
          <div class="power-value">{{ formatPower(totalPower) }}W</div>
          <div class="power-label">Current Production</div>
        </div>

        <!-- Daily Production -->
        <div class="daily-production">
          <div class="production-row">
            <div class="day-label">Today</div>
            <div class="yield-value">
              {{ formatYield(calculateTotalYield(panels, 'today')) }}
              <span class="unit">kWh</span>
            </div>
          </div>

          <div class="production-row">
            <div class="day-label">Yesterday</div>
            <div class="yield-value">
              {{ formatYield(calculateTotalYield(panels, 'yesterday')) }}
              <span class="unit">kWh</span>
            </div>
          </div>

          <!-- Comparison Indicator -->
          <div
            class="comparison"
            :style="{
              color: getComparisonColor(
                calculateTotalYield(panels, 'today'),
                calculateTotalYield(panels, 'yesterday'),
              ),
            }"
          >
            {{
              getComparisonIndicator(
                calculateTotalYield(panels, 'today'),
                calculateTotalYield(panels, 'yesterday'),
              )
            }}
          </div>
        </div>

        <!-- Individual Panel Production -->
        <div class="panels-grid">
          <div v-for="panel in panels" :key="panel.name" class="panel-item">
            <div class="panel-name">{{ panel.name }}</div>
            <div class="panel-yield">{{ formatYield(panel.yieldToday) }} kWh</div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  </SolarWidgetBase>
</template>

<style scoped>
.production-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  height: 100%;
}

.current-power {
  text-align: center;
}

.power-value {
  font-size: 3rem;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
}

.power-label {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.5rem;
}

.daily-production {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  position: relative;
}

.production-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.yield-value {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.unit {
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  margin-left: 0.25rem;
}

.comparison {
  position: absolute;
  right: -0.5rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.5rem;
  padding: 0.5rem;
}

.panels-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.panel-item {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  text-align: center;
}

.panel-name {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.panel-yield {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--color-text-primary);
}
</style>
