<script setup lang="ts">
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getSteeringData } = useSignalKData()
const steeringData = getSteeringData()

const steering = computed(() => {
  const rudderAngle = steeringData.value?.rudderAngle?.value ?? 0
  const autopilot = steeringData.value?.autopilot

  return {
    rudderAngle: rudderAngle.toFixed(1),
    rudderAngleRaw: rudderAngle,
    autopilot: {
      state: autopilot?.state?.value ?? 'unknown',
      mode: autopilot?.mode?.value ?? 'unknown',
      engaged: autopilot?.engaged?.value ?? false,
      target: {
        headingTrue: autopilot?.target?.headingTrue?.value ?? null,
        headingMagnetic: autopilot?.target?.headingMagnetic?.value ?? null,
        courseOverGroundTrue: autopilot?.target?.courseOverGroundTrue?.value ?? null,
        windAngleApparent: autopilot?.target?.windAngleApparent?.value ?? null,
        windAngleTrue: autopilot?.target?.windAngleTrue?.value ?? null,
      },
      alarm: autopilot?.alarm?.value ?? null,
    },
  }
})

const formatAngle = (angle: number | null): string => {
  if (angle === null || angle === undefined) return 'N/A'
  return `${angle.toFixed(0)}°`
}

const getRudderColor = (angle: number): string => {
  const abs = Math.abs(angle)
  if (abs < 5) return 'var(--color-success)'
  if (abs < 15) return 'var(--color-warning)'
  return 'var(--color-danger)'
}
</script>

<template>
  <WidgetContainer title="Steering">
    <div class="steering-display">
      <div class="rudder-section">
        <div class="rudder-indicator">
          <div class="rudder-angle" :style="{ color: getRudderColor(steering.rudderAngleRaw) }">
            {{ steering.rudderAngle }}°
          </div>
          <div class="rudder-label">Rudder</div>
        </div>
      </div>

      <div class="autopilot-section">
        <div class="ap-status">
          <span class="ap-label">Autopilot:</span>
          <span class="ap-state" :class="{ engaged: steering.autopilot.engaged }">
            {{ steering.autopilot.engaged ? 'Engaged' : 'Disengaged' }}
          </span>
        </div>

        <div v-if="steering.autopilot.engaged" class="ap-details">
          <div class="ap-mode">
            <span class="detail-label">Mode:</span>
            <span class="detail-value">{{ steering.autopilot.mode }}</span>
          </div>

          <div v-if="steering.autopilot.target.headingTrue !== null" class="ap-target">
            <span class="detail-label">Target Heading:</span>
            <span class="detail-value">{{
              formatAngle(steering.autopilot.target.headingTrue)
            }}</span>
          </div>

          <div v-if="steering.autopilot.target.courseOverGroundTrue !== null" class="ap-target">
            <span class="detail-label">Target COG:</span>
            <span class="detail-value">{{
              formatAngle(steering.autopilot.target.courseOverGroundTrue)
            }}</span>
          </div>

          <div v-if="steering.autopilot.alarm" class="ap-alarm">
            <span class="alarm-label">⚠️ Alarm:</span>
            <span class="alarm-value">{{ steering.autopilot.alarm }}</span>
          </div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.steering-display {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.rudder-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0;
}

.rudder-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.rudder-angle {
  font-size: 3rem;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  transition: color 0.3s ease;
}

.rudder-label {
  font-size: 0.875rem;
  color: var(--te-unit);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.autopilot-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.ap-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--te-widget-bg);
  border-radius: 8px;
}

.ap-label {
  font-size: 0.875rem;
  color: var(--te-unit);
}

.ap-state {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--te-label);
  text-transform: uppercase;
}

.ap-state.engaged {
  color: var(--color-success);
}

.ap-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ap-mode,
.ap-target {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.detail-label {
  color: var(--te-unit);
}

.detail-value {
  color: var(--te-value);
  font-weight: 500;
  font-family: var(--font-mono, monospace);
}

.ap-alarm {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  font-size: 0.875rem;
}

.alarm-label {
  color: var(--color-danger);
  font-weight: 600;
}

.alarm-value {
  color: var(--te-value);
}
</style>
