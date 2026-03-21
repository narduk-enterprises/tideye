<script setup lang="ts">
import WidgetContainer from '../../shared/WidgetContainer.vue'

defineProps<{
  title: string
  tanks: Array<{
    name: string
    level: number
    type: string
  }>
  getTankColor: (type: string, level: number) => string
}>()
</script>

<template>
  <WidgetContainer :title="title">
    <div class="radials-container">
      <div class="tank-radial" v-for="tank in tanks" :key="tank.name">
        <svg class="radial-progress" viewBox="0 0 100 100">
          <circle
            class="progress-bg"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            stroke-width="10"
          />
          <circle
            class="progress"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            :stroke="getTankColor(tank.type, tank.level)"
            stroke-width="10"
            :stroke-dasharray="`${tank.level * 283} 283`"
            transform="rotate(-90 50 50)"
          />
          <text class="percentage" x="50" y="50" text-anchor="middle" dominant-baseline="middle">
            {{ Math.round(tank.level * 100) }}%
          </text>
        </svg>
        <span class="tank-label">{{ tank.name.split(' ')[0] }}</span>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.radials-container {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  padding: 1rem;
}

.tank-radial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.radial-progress {
  width: 100%;
  max-width: 140px;
  height: auto;
}

.progress {
  transition: stroke-dasharray 0.3s ease;
}

.percentage {
  font-size: 1.75rem;
  font-family: 'SF Mono', monospace;
  fill: rgba(255, 255, 255, 0.9);
  font-weight: 400;
}

.tank-label {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}
</style>
