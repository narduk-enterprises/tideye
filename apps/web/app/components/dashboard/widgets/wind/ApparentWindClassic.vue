<script setup lang="ts">
import WindWidgetBase from './WindWidgetBase.vue'
import CompassRose from '../shared/CompassRose.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'
</script>

<template>
  <WindWidgetBase v-slot="{ apparentWindSpeed, apparentWindAngle }">
    <WidgetContainer title="APPARENT WIND">
      <div class="wind-content">
        <!-- Primary Speed Display -->
        <div class="speed-display">
          <div class="speed-value">{{ apparentWindSpeed }}</div>
          <div class="speed-unit">knots</div>
        </div>

        <!-- Direction Display -->
        <div class="direction-display">
          <div class="angle-container">
            <div class="angle-value">{{ Math.abs(Number(apparentWindAngle)) }}°</div>
          </div>
          <div class="cardinal">{{ Number(apparentWindAngle) >= 0 ? 'E' : 'W' }}</div>
        </div>
      </div>
    </WidgetContainer>
  </WindWidgetBase>
</template>

<style scoped>
.wind-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 1rem;
  gap: 0.75rem;
}

/* Speed Display Styles */
.speed-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0.5rem;
}

.speed-value {
  font-size: 5rem;
  font-family: var(--te-font-data);
  font-weight: 500;
  color: var(--te-value);
  line-height: 1;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.speed-unit {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--te-label);
  margin-top: 0.25rem;
}

/* Direction Display Styles */
.direction-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.angle-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.angle-marker {
  width: 3px;
  height: 3px;
  background-color: var(--color-warning);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--color-warning);
}

.angle-value {
  font-family: var(--te-font-data);
  font-size: 1.25rem;
  color: var(--te-unit);
}

.cardinal {
  font-family: var(--te-font-data);
  font-size: 1rem;
  color: var(--color-warning);
  opacity: 0.8;
  letter-spacing: 0.1em;
  margin-top: 0.125rem;
}
</style>
