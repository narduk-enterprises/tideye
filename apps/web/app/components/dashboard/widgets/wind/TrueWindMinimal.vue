<script setup lang="ts">
import WindWidgetBase from './WindWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'
import CardinalDirection from '../shared/CardinalDirection.vue'
</script>

<template>
  <WindWidgetBase v-slot="{ trueWindSpeed, trueWindAngle }">
    <WidgetContainer title="True Wind">
      <div class="wind-content">
        <div class="wind-display">
          <div class="speed">{{ trueWindSpeed }}<span class="unit">kts</span></div>
          <CardinalDirection :degrees="Number(trueWindAngle)" color="var(--color-success)" />
        </div>
      </div>
    </WidgetContainer>
  </WindWidgetBase>
</template>

<style scoped>
.wind-content {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 1rem;
}

.wind-display {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.speed {
  font-size: 3.5rem;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
}

.unit {
  font-size: 1.5rem;
  color: var(--color-text-tertiary);
  margin-left: 0.5rem;
}
</style>
