<script setup lang="ts">
import SolarWidgetBase from './SolarWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getStatusColor = (power: number) => {
  if (power > 500) return '#4CAF50' // High production - Green
  if (power > 100) return '#FFA726' // Medium production - Orange
  return '#64B5F6' // Low/No production - Blue
}
</script>

<template>
  <SolarWidgetBase v-slot="{ totalPower, formatPower }">
    <WidgetContainer title="Solar">
      <div class="solar-content">
        <div class="solar-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M3.55 19.09L4.96 20.5L6.76 18.71L5.34 17.29M12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12C18 8.68 15.31 6 12 6M20 12.5H23V10.5H20M17.24 18.71L19.04 20.5L20.45 19.09L18.66 17.29M20.45 5L19.04 3.6L17.24 5.39L18.66 6.81M13 0.55H11V3.5H13M4 10.5H1V12.5H4M6.76 5.39L4.96 3.6L3.55 5L5.34 6.81L6.76 5.39Z"
            />
          </svg>
        </div>
        <div class="power-value" :style="{ color: getStatusColor(totalPower) }">
          {{ formatPower(totalPower) }}
          <span class="unit">W</span>
        </div>
      </div>
    </WidgetContainer>
  </SolarWidgetBase>
</template>

<style scoped>
.solar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  height: 100%;
  padding: 1rem;
}

.solar-icon {
  width: 4rem;
  height: 4rem;
  color: var(--color-info);
}

.power-value {
  font-size: 3.5rem;
  font-family: var(--te-font-data);
  line-height: 1;
}

.unit {
  font-size: 1.5rem;
  color: var(--te-label);
  margin-left: 0.5rem;
}
</style>
