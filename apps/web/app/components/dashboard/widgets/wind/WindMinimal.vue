<script setup lang="ts">
import WindWidgetBase from './WindWidgetBase.vue'
import WidgetContainer from '../shared/WidgetContainer.vue'
</script>

<template>
  <WindWidgetBase v-slot="{ apparentWindSpeed, apparentWindAngle }">
    <WidgetContainer title="Wind">
      <div class="wind-content">
        <div class="wind-display">
          <div class="speed">{{ apparentWindSpeed }}<span class="unit">kts</span></div>
          <div class="angle">{{ apparentWindAngle }}°</div>
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
}

.speed {
  font-size: 3.15rem;
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.angle {
  font-size: 1.5rem;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
}

.unit {
  font-size: 1.5rem;
  color: var(--color-text-tertiary);
  margin-left: 0.5rem;
}
</style>
