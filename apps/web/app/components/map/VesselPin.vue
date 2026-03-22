<script setup lang="ts">
const props = defineProps<{
  heading: number
  isLive: boolean
}>()

const rotation = computed(() => `rotate(${props.heading}deg)`)
</script>

<template>
  <div class="vessel-pin-wrapper">
    <div v-if="isLive" class="pulse-ring" />

    <div class="vessel-icon text-[var(--te-nav)]" :style="{ transform: rotation }">
      <UIcon name="i-lucide-ship" class="size-8 drop-shadow-md" />
    </div>
  </div>
</template>

<style scoped>
.vessel-pin-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--te-nav);
  animation: pulse 2s ease-out infinite;
}

.vessel-icon {
  position: relative;
  z-index: 1;
  transition: transform 0.5s ease;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
</style>
