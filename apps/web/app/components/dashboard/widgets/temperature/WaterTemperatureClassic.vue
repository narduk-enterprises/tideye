<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import { Temperatures } from '~/utils/conversions'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getWaterTempData } = useSignalKData()
const waterTempData = getWaterTempData()

const waterTemp = computed(() => {
  const temp = waterTempData.value?.value
  return temp ? Temperatures.kelvinToFahrenheit(temp).toFixed(1) : '0.0'
})
</script>

<template>
  <WidgetContainer title="Water Temperature">
    <div class="temp-container">
      <div class="temp-value">{{ waterTemp }}°F</div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.temp-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.temp-value {
  font-size: 3.15rem;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
  margin-bottom: 0.5rem;
}
</style>
