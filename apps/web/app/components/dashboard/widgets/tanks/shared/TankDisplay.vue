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
    <div class="tanks-list">
      <div class="tank-item" v-for="tank in tanks" :key="tank.name">
        <div class="tank-row">
          <span class="tank-name">{{ tank.name.split(' ')[0] }}</span>
          <span class="tank-percentage">{{ Math.round(tank.level * 100) }}%</span>
        </div>
        <div class="tank-gauge">
          <div
            class="tank-level"
            :style="{
              width: `${tank.level * 100}%`,
              backgroundColor: getTankColor(tank.type, tank.level),
            }"
          ></div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.tanks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.75rem;
}

.tank-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tank-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tank-name {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
}

.tank-percentage {
  font-size: 1.25rem;
  font-family: 'SF Mono', monospace;
  color: rgba(255, 255, 255, 0.9);
}

.tank-gauge {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.tank-level {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
</style>
