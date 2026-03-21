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
  largePercentage: boolean
}>()
</script>

<template>
  <WidgetContainer :title="title">
    <div class="bars-container">
      <div class="tank-item" v-for="tank in tanks" :key="tank.name">
        <div class="bar-container">
          <div
            class="bar-fill"
            :style="{
              height: `${tank.level * 100}%`,
              backgroundColor: getTankColor(tank.type, tank.level),
            }"
          ></div>
        </div>
        <div class="tank-percentage">
          <span :class="{ 'large-percentage': largePercentage }"
            >{{ Math.round(tank.level * 100) }}%</span
          >
        </div>
        <div class="tank-name">{{ tank.name.split(' ')[0] }}</div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.bars-container {
  flex: 1;
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 1rem;
  padding: 0.25rem;
  min-height: 0;
}

.tank-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  max-width: 3.5rem;
}

.bar-container {
  width: 100%;
  height: 6.5rem;
  background: rgba(15, 10, 10, 0.8);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 1px 1px rgba(0, 0, 0, 0.2);
}

.bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  box-shadow:
    0 -1px 2px rgba(0, 0, 0, 0.1),
    inset 0 1px 2px rgba(255, 255, 255, 0.1);
}

.tank-percentage {
  font-size: 1.1rem;
  font-family: 'SF Mono', monospace;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  margin-top: 0.1rem;
}

.tank-name {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: capitalize;
  letter-spacing: 0.02em;
  font-weight: 400;
}

.bar-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 100% 25%;
  pointer-events: none;
}

.bar-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 10%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, transparent 100%);
  pointer-events: none;
}

.large-percentage {
  font-size: 1.5rem;
  font-weight: bold;
}
</style>
