<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import { Distances } from '~/utils/conversions'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getDepthData } = useSignalKData()
const depthData = getDepthData()

// Get current depth from SignalK and convert to feet
const currentDepth = computed(() => {
  const depth = depthData.value?.belowSurface?.value
  return depth ? Distances.metersToFeet(depth) : 0
})

// Increase history points for a longer time period
const maxHistoryPoints = 30 // Reduced for cleaner look
const depthHistory = ref<number[]>([])

// Add timestamp tracking for smoother animations
const lastUpdateTime = ref(Date.now())

// Watch for depth changes and update history with rate limiting
watch(currentDepth, (newDepth) => {
  const now = Date.now()
  if (now - lastUpdateTime.value < 1000) return // Rate limit to 1Hz

  if (newDepth > 0 && newDepth < 1000) {
    // Basic sanity check
    depthHistory.value.push(newDepth)
    if (depthHistory.value.length > maxHistoryPoints) {
      depthHistory.value.shift()
    }
    lastUpdateTime.value = now
  }
})

// Enhanced normalization for smoother visualization
const normalizeDepth = (depth: number): number => {
  if (depthHistory.value.length === 0) return 0
  const maxDepth = Math.max(...depthHistory.value, currentDepth.value)
  const minDepth = Math.min(...depthHistory.value, currentDepth.value)
  const padding = (maxDepth - minDepth) * 0.2
  return ((depth - (minDepth - padding)) / (maxDepth - minDepth + padding * 2)) * 100
}

// Format depth to 1 decimal place
const formatDepth = (depth: number): string => {
  return depth.toFixed(1)
}
</script>

<template>
  <WidgetContainer title="DEPTH">
    <div class="depth-container">
      <div class="depth-value">
        {{ formatDepth(currentDepth) }}
        <span class="depth-unit">ft</span>
      </div>

      <div class="depth-trend">
        <div class="trend-graph">
          <div
            v-for="(point, index) in depthHistory"
            :key="index"
            class="trend-point"
            :style="{
              height: `${normalizeDepth(point)}%`,
              opacity: 0.15 + (index / depthHistory.length) * 0.85,
            }"
          ></div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.depth-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.75rem;
  height: 100%;
}

.depth-value {
  font-size: 3rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-mono);
  text-align: center;
}

.depth-unit {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 0.5rem;
}

.depth-trend {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 0.5rem;
}

.trend-graph {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100%;
}

.trend-point {
  flex: 1;
  background-color: var(--color-info);
  border-radius: 2px 2px 0 0;
  transition: all 0.5s ease;
  min-width: 4px;
  box-shadow: 0 0 8px rgba(var(--color-info-rgb), 0.2);
}

.trend-point:last-child {
  background-color: var(--color-info);
  box-shadow: 0 0 12px var(--color-info);
}

/* Subtle grid lines */
.depth-trend {
  background-image: linear-gradient(
    0deg,
    transparent calc(20% - 1px),
    rgba(255, 255, 255, 0.05) 20%,
    transparent calc(20% + 1px),
    transparent calc(40% - 1px),
    rgba(255, 255, 255, 0.05) 40%,
    transparent calc(40% + 1px),
    transparent calc(60% - 1px),
    rgba(255, 255, 255, 0.05) 60%,
    transparent calc(60% + 1px),
    transparent calc(80% - 1px),
    rgba(255, 255, 255, 0.05) 80%,
    transparent calc(80% + 1px)
  );
}
</style>
