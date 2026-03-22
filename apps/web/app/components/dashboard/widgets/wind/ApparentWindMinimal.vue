<script setup lang="ts">
import WindWidgetBase from './WindWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'
import CardinalDirection from '../shared/CardinalDirection.vue'
</script>

<template>
  <WindWidgetBase v-slot="{ apparentWindSpeed, apparentWindAngle }">
    <WidgetContainer title="Apparent Wind">
      <div class="wind-content">
        <div class="wind-display">
          <div class="speed">{{ apparentWindSpeed }}<span class="unit">kts</span></div>
          <CardinalDirection :degrees="Number(apparentWindAngle)" color="var(--te-wind)" />
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
  font-family: var(--te-font-data);
  color: var(--te-value);
  line-height: 1;
}

.unit {
  font-size: 1.5rem;
  color: var(--te-unit);
  margin-left: 0.5rem;
}
</style>
