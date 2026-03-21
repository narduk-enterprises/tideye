<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import WidgetContainer from '../../shared/WidgetContainer.vue'

// Add computed property for percentage and color
const getWaterColor = (percentage: number): string => {
  if (percentage < 33) return '#FF6B6B' // red
  if (percentage < 66) return '#FFD93D' // yellow
  return '#4B89DC' // changed to a more vibrant blue
}
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks }">
    <WidgetContainer title="Fresh Water">
      <div class="combined-display">
        <div class="water-icon" :style="{ color: 'var(--color-info)' }">
          <svg
            class="water-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"
              fill="currentColor"
              fill-opacity="0.7"
            />
          </svg>
        </div>
        <div
          class="percentage primary-value water-percentage"
          :style="{
            color: getWaterColor(
              Math.round(
                tanks.freshWater.reduce((sum, tank) => sum + tank.level * 100, 0) /
                  tanks.freshWater.length,
              ),
            ),
          }"
        >
          {{
            Math.round(
              tanks.freshWater.reduce((sum, tank) => sum + tank.level * 100, 0) /
                tanks.freshWater.length,
            )
          }}%
        </div>
      </div>
    </WidgetContainer>
  </TanksWidgetBase>
</template>

<style scoped>
.combined-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  height: 100%;
  padding: 1rem;
}

.water-icon {
  width: 4.5rem;
  height: 4.5rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.combined-display .water-percentage.primary-value {
  font-size: 5rem !important;
  line-height: 1;
  color: var(--color-warning);
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
}
</style>
