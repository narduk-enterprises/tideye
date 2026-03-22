<script setup lang="ts">
import WidgetContainer from '../shared/WidgetContainer.vue'
import CompassRose from '../shared/CompassRose.vue'
import CardinalDirection from '../shared/CardinalDirection.vue'

defineProps<{
  title: string
  speed: string
  angle: string
  showCompass?: boolean
}>()
</script>

<template>
  <WidgetContainer :title="title">
    <div class="wind-content">
      <div class="speed-display">
        <div class="speed-value">{{ speed }}</div>
        <div class="speed-unit">knots</div>
      </div>

      <div class="direction-display">
        <CardinalDirection :degrees="Number(angle)" color="var(--color-success)" size="large" />
      </div>

      <div v-if="showCompass" class="compass-section">
        <slot name="compass" />
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.wind-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 1.5rem 1rem;
}

.speed-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
}

.speed-value {
  font-size: 5.5rem;
  font-family: var(--te-font-data);
  font-weight: 500;
  color: var(--te-value);
  line-height: 1;
  letter-spacing: -0.02em;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 4px 8px rgba(0, 0, 0, 0.1);
}

.speed-unit {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--te-label);
  margin-top: 0.5rem;
}

.direction-display {
  margin-top: 0.5rem;
}

.compass-section {
  margin-top: 1.5rem;
  opacity: 0.8;
}
</style>
