<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
const props = defineProps<{
  degrees: number
  color?: string
  size?: 'xs' | 'small' | 'medium' | 'large' | 'xl'
}>()

const getCardinalDirection = (degrees: number) => {
  if (isNaN(degrees)) return 'N'

  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  const normalizedDegrees = ((degrees % 360) + 360) % 360
  const index = Math.round(normalizedDegrees / 22.5) % 16
  return directions[index]
}

const sizeClasses = {
  xs: 'size-xs',
  small: 'size-small',
  medium: 'size-medium',
  large: 'size-large',
  xl: 'size-xl',
}
</script>

<template>
  <div class="direction-display" :class="sizeClasses[size || 'medium']">
    <div class="direction-row">
      <div class="cardinal-container">
        <span class="cardinal" :style="{ color }">
          {{ getCardinalDirection(degrees).padEnd(3, ' ') }}
        </span>
      </div>
      <div class="angle-container">
        <span class="angle-value">{{ Math.abs(degrees).toString().padStart(3, ' ') }}°</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.direction-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.cardinal-container {
  width: 12ch;
  display: flex;
  justify-content: center;
  text-align: center;
}

.angle-container {
  width: 10ch;
  display: flex;
  justify-content: center;
  text-align: center;
}

.cardinal {
  font-family: var(--te-font-data);
  font-weight: 500;
  display: inline-block;
  text-align: center;
}

.angle-value {
  font-family: var(--te-font-data);
  font-weight: 500;
  color: var(--te-unit);
  display: inline-block;
  text-align: center;
}

/* Size variants */
.size-xs {
  .cardinal,
  .angle-value {
    font-size: 1.25rem;
  }
}

.size-small {
  .cardinal,
  .angle-value {
    font-size: 1.875rem;
  }
}

.size-medium {
  .cardinal,
  .angle-value {
    font-size: 2.625rem;
  }
}

.size-large {
  .cardinal,
  .angle-value {
    font-size: 3rem;
  }
}

.size-xl {
  .cardinal,
  .angle-value {
    font-size: 3.5rem;
  }
}
</style>
