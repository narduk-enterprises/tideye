<script setup lang="ts">
import TanksWidgetBase from '../TanksWidgetBase.vue'
import WidgetContainer from '../../shared/WidgetContainer.vue'
</script>

<template>
  <TanksWidgetBase v-slot="{ tanks, getFuelColor }">
    <WidgetContainer title="Fuel">
      <div class="combined-display">
        <div
          class="gallons primary-value fuel-gallons"
          :style="{
            color: getFuelColor(tanks.fuel.reduce((sum, tank) => sum + tank.level * 80, 0)),
          }"
        >
          {{ Math.round(tanks.fuel.reduce((sum, tank) => sum + tank.level * 80, 0) * 10) / 10 }} gal
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

.fuel-icon {
  width: 4.5rem;
  height: 4.5rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.combined-display .fuel-gallons.primary-value {
  font-size: 5rem !important;
  line-height: 1;
  color: var(--color-warning);
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
}
</style>
