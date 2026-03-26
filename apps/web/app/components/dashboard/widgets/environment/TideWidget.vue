<script setup lang="ts">
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getTideData } = useSignalKData()
const tideData = getTideData()

const tide = computed(() => {
  const heightNow = tideData.value?.heightNow?.value ?? null
  const heightHigh = tideData.value?.heightHigh?.value ?? null
  const heightLow = tideData.value?.heightLow?.value ?? null
  const timeHigh = tideData.value?.timeHigh?.value ?? null
  const timeLow = tideData.value?.timeLow?.value ?? null

  return {
    heightNow: heightNow !== null ? heightNow.toFixed(2) : null,
    heightHigh: heightHigh !== null ? heightHigh.toFixed(2) : null,
    heightLow: heightLow !== null ? heightLow.toFixed(2) : null,
    timeHigh: timeHigh ?? null,
    timeLow: timeLow ?? null,
    hasData: heightNow !== null || heightHigh !== null || heightLow !== null,
  }
})

const formatTime = (timeStr: string | null): string => {
  if (!timeStr) return 'N/A'
  try {
    const date = new Date(timeStr)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return timeStr
  }
}
</script>

<template>
  <WidgetContainer title="Tide">
    <div class="tide-display">
      <div v-if="!tide.hasData" class="no-data">
        <span>No data available</span>
      </div>

      <div v-else class="tide-content">
        <div v-if="tide.heightNow !== null" class="tide-now">
          <span class="tide-label">Current Height</span>
          <span class="tide-value">{{ tide.heightNow }} ft</span>
        </div>

        <div class="tide-extremes">
          <div v-if="tide.heightHigh !== null" class="tide-extreme">
            <span class="extreme-label">High</span>
            <span class="extreme-value">{{ tide.heightHigh }} ft</span>
            <span v-if="tide.timeHigh" class="extreme-time">{{ formatTime(tide.timeHigh) }}</span>
          </div>

          <div v-if="tide.heightLow !== null" class="tide-extreme">
            <span class="extreme-label">Low</span>
            <span class="extreme-value">{{ tide.heightLow }} ft</span>
            <span v-if="tide.timeLow" class="extreme-time">{{ formatTime(tide.timeLow) }}</span>
          </div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.tide-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.no-data {
  color: var(--te-label);
  font-size: 0.875rem;
}

.tide-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.tide-now {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.tide-label {
  font-size: 0.75rem;
  color: var(--te-unit);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tide-value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--te-value);
  font-family: var(--font-mono, monospace);
}

.tide-extremes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.tide-extreme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--te-widget-bg);
  border-radius: 8px;
}

.extreme-label {
  font-size: 0.75rem;
  color: var(--te-unit);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.extreme-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--te-value);
  font-family: var(--font-mono, monospace);
}

.extreme-time {
  font-size: 0.75rem;
  color: var(--te-label);
  font-family: var(--font-mono, monospace);
}

@media (max-width: 768px) {
  .tide-extremes {
    grid-template-columns: 1fr;
  }
}
</style>
