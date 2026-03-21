<script setup lang="ts">
import BatteryWidgetBase from './BatteryWidgetBase.vue'

const getStatusColor = (percentage: string) => {
  const value = Number.parseFloat(percentage)
  if (value >= 80) return '#4CAF50' // Green for high charge
  if (value >= 20) return '#FFA726' // Orange for medium charge
  return '#FF5252' // Red for low charge
}

const getCircleOffset = (percentage: string) => {
  const value = Number.parseFloat(percentage)
  const circumference = 2 * Math.PI * 45
  return circumference * (1 - value / 100)
}
</script>

<template>
  <BatteryWidgetBase v-slot="{ battery }">
    <div class="battery-content">
      <!-- Main Status Section -->
      <div class="main-display">
        <div class="charge-circle-container">
          <svg class="progress-ring" viewBox="0 0 100 100">
            <!-- Background circle -->
            <circle
              class="progress-ring-circle-bg"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              stroke-width="4"
            />
            <!-- Progress circle -->
            <circle
              class="progress-ring-circle"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              :stroke="getStatusColor(battery.chargePercentage)"
              stroke-width="4"
              :stroke-dasharray="`${2 * Math.PI * 45} ${2 * Math.PI * 45}`"
              :stroke-dashoffset="getCircleOffset(battery.chargePercentage)"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="percentage">{{ battery.chargePercentage }}%</div>
        </div>

        <div class="status-section">
          <div class="status-badge" :class="battery.powerDirection.toLowerCase()">
            {{ battery.powerDirection }}
          </div>
          <div class="time-section">
            <div class="time">{{ battery.timeRemaining }}</div>
            <div class="time-label">Remaining</div>
          </div>
          <div v-if="battery.powerDirection === 'Charging'" class="time-section">
            <div class="time">{{ battery.timeUntilFullyCharged }}</div>
            <div class="time-label">Until Full</div>
          </div>
        </div>
      </div>

      <!-- Power Metrics -->
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">{{ battery.voltage }}V</div>
          <div class="metric-label">Voltage</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ battery.current }}A</div>
          <div class="metric-label">Current</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ battery.power }}W</div>
          <div class="metric-label">Power</div>
        </div>
      </div>
    </div>
  </BatteryWidgetBase>
</template>

<style scoped>
.battery-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.75rem;
  gap: 0.75rem;
}

.main-display {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.charge-circle-container {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.progress-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.3s ease;
}

.percentage {
  font-size: 1.25rem;
  font-family: var(--font-mono);
  color: rgba(255, 255, 255, 0.9);
  position: relative;
  z-index: 1;
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.charging {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.status-badge.discharging {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.time {
  font-size: 1.5rem;
  font-family: var(--font-mono);
  color: rgba(255, 255, 255, 0.9);
}

.time-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: auto;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--color-text-primary);
  line-height: 1;
  opacity: 0.8;
}

.metric-label {
  font-size: 0.6rem;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.capacity-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.metric-item .metric-value {
  font-size: 0.875rem;
}

.metric-item .metric-label {
  font-size: 0.7rem;
}
</style>
