<script setup lang="ts">
import InverterWidgetBase from './InverterWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'

const getStatusColor = (power: number) => {
  if (power > 2000) return '#4CAF50' // High power
  if (power > 500) return '#FFA726' // Medium power
  return '#64B5F6' // Low/No power
}
</script>

<template>
  <InverterWidgetBase v-slot="{ totalPower, formatPower }">
    <WidgetContainer title="Inverter">
      <div class="minimal-content">
        <div class="power-display" :style="{ color: getStatusColor(totalPower) }">
          {{ formatPower(totalPower) }}
        </div>
      </div>
    </WidgetContainer>
  </InverterWidgetBase>
</template>

<style scoped>
.minimal-content {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 1rem;
}

.power-display {
  font-size: 2.5rem;
  font-family: var(--font-mono);
  font-weight: 500;
  text-align: center;
  line-height: 1;
  transition: color 0.3s ease;
}
</style>
