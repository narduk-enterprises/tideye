<script setup lang="ts">
/**
 * MapWindRose — A compass rose overlay showing real-time wind direction
 * and speed. Renders apparent wind arrow and speed value.
 */
const props = defineProps<{
  windAngleDeg: number | null
  windSpeedKts: number | null
  headingDeg: number | null
}>()

const rotation = computed(() => {
  if (props.windAngleDeg == null) return '0deg'
  return `${props.windAngleDeg}deg`
})
</script>

<template>
  <div class="wind-rose-container">
    <svg viewBox="0 0 100 100" class="wind-rose-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer ring -->
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        opacity="0.2"
      />
      <circle
        cx="50"
        cy="50"
        r="32"
        fill="none"
        stroke="currentColor"
        stroke-width="0.5"
        opacity="0.1"
      />

      <!-- Cardinal ticks -->
      <line x1="50" y1="4" x2="50" y2="10" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
      <line
        x1="96"
        y1="50"
        x2="90"
        y2="50"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.5"
      />
      <line
        x1="50"
        y1="96"
        x2="50"
        y2="90"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.5"
      />
      <line x1="4" y1="50" x2="10" y2="50" stroke="currentColor" stroke-width="1.5" opacity="0.5" />

      <!-- Cardinal labels -->
      <text
        x="50"
        y="18"
        text-anchor="middle"
        fill="currentColor"
        font-size="7"
        font-weight="600"
        opacity="0.6"
      >
        N
      </text>
      <text
        x="84"
        y="53"
        text-anchor="middle"
        fill="currentColor"
        font-size="7"
        font-weight="600"
        opacity="0.6"
      >
        E
      </text>
      <text
        x="50"
        y="88"
        text-anchor="middle"
        fill="currentColor"
        font-size="7"
        font-weight="600"
        opacity="0.6"
      >
        S
      </text>
      <text
        x="16"
        y="53"
        text-anchor="middle"
        fill="currentColor"
        font-size="7"
        font-weight="600"
        opacity="0.6"
      >
        W
      </text>

      <!-- Wind arrow (rotated) -->
      <g v-if="windAngleDeg != null" :transform="`rotate(${rotation.replace('deg', '')} 50 50)`">
        <line
          x1="50"
          y1="22"
          x2="50"
          y2="50"
          stroke="#0ea5e9"
          stroke-width="2.5"
          stroke-linecap="round"
        />
        <polygon points="50,20 46,30 54,30" fill="#0ea5e9" />
      </g>

      <!-- Center dot -->
      <circle cx="50" cy="50" r="2.5" fill="currentColor" opacity="0.4" />
    </svg>

    <!-- Speed label -->
    <div class="wind-rose-speed">
      <span v-if="windSpeedKts != null" class="wind-speed-value">{{
        windSpeedKts.toFixed(0)
      }}</span>
      <span v-if="windSpeedKts != null" class="wind-speed-unit">kts</span>
      <span v-else class="wind-speed-value">—</span>
    </div>
  </div>
</template>

<style scoped>
.wind-rose-container {
  position: relative;
  width: 80px;
  height: 80px;
}

.wind-rose-svg {
  width: 100%;
  height: 100%;
  color: var(--te-label, #666);
}

.wind-rose-speed {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 1px;
  font-family: var(--te-font-data, monospace);
}

.wind-speed-value {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #0ea5e9;
}

.wind-speed-unit {
  font-size: 0.5rem;
  font-weight: 500;
  color: var(--te-label, #999);
}
</style>
