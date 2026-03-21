<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import { Angles, Speeds } from '~/utils/conversions'

const { getWindData } = useSignalKData()
const windData = getWindData()

const apparentWindSpeed = computed(() => {
  const speed = windData.value?.speedApparent?.value
  return speed ? Speeds.msecToKnots(speed).toFixed(1) : '0.0'
})

const apparentWindAngle = computed(() => {
  const angle = windData.value?.angleApparent?.value
  return angle ? Angles.radiansToDegrees(angle).toFixed(0) : '0'
})

const trueWindSpeed = computed(() => {
  const speed = windData.value?.speedTrue?.value
  return speed ? Speeds.msecToKnots(speed).toFixed(1) : '0.0'
})

const trueWindAngle = computed(() => {
  const angle = windData.value?.directionTrue?.value
  return angle ? Angles.radiansToDegrees(angle).toFixed(0) : '0'
})
</script>

<template>
  <slot
    :apparent-wind-speed="apparentWindSpeed"
    :apparent-wind-angle="apparentWindAngle"
    :true-wind-speed="trueWindSpeed"
    :true-wind-angle="trueWindAngle"
  />
</template>
