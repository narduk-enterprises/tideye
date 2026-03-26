<script setup lang="ts">
const props = defineProps<{
  angle: number | string
  arrowColor?: string
  size?: number
  isApparentWind?: boolean
}>()

const rotation = computed(() => {
  const numericAngle = Number(props.angle)
  if (isNaN(numericAngle)) return 0

  // For apparent wind, we need to convert from -180/+180 to 0-360
  if (props.isApparentWind) {
    // Convert from -180/+180 to 0-360 and add 180 to show FROM direction
    const normalized = (((numericAngle + 360) % 360) + 180) % 360
    return normalized
  }

  // True wind is already in meteorological convention (direction FROM)
  return ((numericAngle % 360) + 360) % 360
})
</script>

<template>
  <div class="compass-rose" :style="{ width: `${size || 90}px`, height: `${size || 90}px` }">
    <div class="cardinal-points">
      <span class="cardinal n">N</span>
      <span class="cardinal e">E</span>
      <span class="cardinal s">S</span>
      <span class="cardinal w">W</span>
    </div>

    <div class="direction-arrow" :style="{ transform: `rotate(${rotation}deg)` }">
      <div class="arrow-body" :style="{ background: arrowColor || '#4CAF50' }" />
    </div>
  </div>
</template>

<style scoped>
.compass-rose {
  width: 90px;
  height: 90px;
  position: relative;
  border-radius: 50%;
  background: color-mix(in srgb, var(--te-value) 8%, transparent);
  border: 1px solid var(--te-metric-border);
}

.cardinal-points {
  position: absolute;
  width: 100%;
  height: 100%;
}

.cardinal {
  position: absolute;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--te-font-data);
  color: var(--te-label);
}

.cardinal.n {
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
}
.cardinal.e {
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}
.cardinal.s {
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}
.cardinal.w {
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.direction-arrow {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  transition: transform 0.3s ease;
}

.arrow-body {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 25px;
  transform: translate(-50%, -100%);
  transform-origin: bottom center;
}

.arrow-head {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 8px solid;
}

.cardinal-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--te-font-data);
  font-size: 0.875rem;
  color: var(--te-unit);
  z-index: 1;
}
</style>
