<script setup lang="ts">
import BatteryWidgetBase from './BatteryWidgetBase.vue'

// Calculate the circumference for the progress ring
const radius = 42
const circumference = 2 * Math.PI * radius

const getStatusColor = (percentage: number | null, alpha = 1) => {
  // Ultra neon green
  const greenColor = `rgba(57, 255, 20, ${alpha})` // More neon green

  // Default to green if no percentage (initial load)
  if (percentage === null || isNaN(percentage)) {
    return greenColor
  }

  if (percentage >= 60) {
    return greenColor
  }
  if (percentage >= 20) {
    return `rgba(255, 204, 0, ${alpha})` // Yellow
  }
  return `rgba(255, 59, 48, ${alpha})` // Red
}

const getCircleOffset = (percentage: number | null) => {
  // Default to 100% if no percentage (initial load)
  if (percentage === null || isNaN(percentage)) {
    return 0
  }
  return circumference - (percentage / 100) * circumference
}

// Enhanced glow effect for more neon appearance
const getGlowFilter = (percentage: number | null) => {
  if (percentage === null || isNaN(percentage) || percentage >= 60) {
    return `
      drop-shadow(0 0 2px rgba(57, 255, 20, 0.8))
      drop-shadow(0 0 4px rgba(57, 255, 20, 0.7))
      drop-shadow(0 0 6px rgba(57, 255, 20, 0.6))
    `
  }
  // ... handle other states ...
}
</script>

<template>
  <BatteryWidgetBase v-slot="{ battery }">
    <div class="battery-content">
      <div class="charge-circle-container">
        <svg class="progress-ring glow-filter" viewBox="-5 -5 110 110">
          <defs>
            <!-- Enhanced outer glow -->
            <filter id="outerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur1" />
              <feGaussianBlur in="blur1" stdDeviation="2" result="blur2" />
              <feGaussianBlur in="blur2" stdDeviation="4" result="blur3" />
              <feMerge>
                <feMergeNode in="blur3" />
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <!-- Ambient light effect -->
            <radialGradient id="ambientLight" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                :stop-color="getStatusColor(Number(battery.chargePercentage), 0.15)"
              />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          <!-- Background circle (full ring) -->
          <circle
            class="progress-ring-background"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--te-metric-border)"
            stroke-width="2"
          />

          <!-- Progress circle -->
          <circle
            class="progress-ring-circle"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            :stroke="
              getStatusColor(battery?.chargePercentage ? Number(battery.chargePercentage) : null)
            "
            stroke-width="2"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="
              getCircleOffset(battery?.chargePercentage ? Number(battery.chargePercentage) : null)
            "
          />
        </svg>

        <div class="content-wrapper">
          <div class="percentage">{{ battery.chargePercentage }}%</div>
          <div class="time-remaining">{{ battery.timeRemaining }}</div>
          <div v-if="battery.powerDirection === 'Charging'" class="time-until-full">
            Full in {{ battery.timeUntilFullyCharged }}
          </div>
        </div>
      </div>
    </div>
  </BatteryWidgetBase>
</template>

<style scoped>
.battery-content {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 1rem;
}

.charge-circle-container {
  position: relative;
  width: 100%;
  max-width: 190px;
  aspect-ratio: 1;
  margin: 0 auto;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.75s cubic-bezier(0.4, 0, 0.2, 1);
  stroke-linecap: round;
}

.content-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.percentage {
  font-family: var(--te-font-data);
  font-size: 2.25rem;
  font-weight: var(--font-weight-regular);
  color: var(--te-value);
  line-height: 1;
  opacity: 0.9;
}

.time-remaining {
  font-family: var(--te-font-data);
  font-size: 0.9rem;
  font-weight: var(--font-weight-regular);
  color: var(--te-unit);
  line-height: 1;
}

.time-until-full {
  font-family: var(--te-font-data);
  font-size: 0.8rem;
  font-weight: var(--font-weight-regular);
  color: var(--te-unit);
  line-height: 1;
  opacity: 0.8;
}

.ambient-light {
  animation: pulseAmbient 4s ease-in-out infinite;
}

@keyframes pulseAmbient {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.6;
  }
}
</style>
