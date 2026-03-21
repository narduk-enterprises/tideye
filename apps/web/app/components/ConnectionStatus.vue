<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSignalKStore } from '~/stores/signalk'

const signalKStore = useSignalKStore()
const { vessel } = storeToRefs(signalKStore)

const isConnected = ref(true)
const lastUpdateTime = ref(Date.now())

// Update lastUpdateTime whenever we receive data
const watcher = watch(
  () => vessel.value,
  () => {
    const now = Date.now()
    // Only update if significant time has passed to avoid excessive updates
    if (now - lastUpdateTime.value > 1000) {
      lastUpdateTime.value = now
      isConnected.value = true
    }
  },
  { deep: true },
)

// Check connection status periodically
const connectionCheck = setInterval(() => {
  const timeSinceLastUpdate = Date.now() - lastUpdateTime.value
  if (timeSinceLastUpdate > 10000) {
    // Increase to 10 seconds threshold
    isConnected.value = false
  }
}, 5000) // Check less frequently

onBeforeUnmount(() => {
  clearInterval(connectionCheck)
  watcher() // Clean up watcher
})
</script>

<template>
  <div class="connection-status" :class="{ disconnected: !isConnected }">
    <div class="status-dot"></div>
    <span class="status-text">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
  </div>
</template>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: fixed;
  top: env(safe-area-inset-top, 1rem);
  right: 1rem;
  z-index: 1000;
  transition: all 0.3s ease;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
  transition: all 0.3s ease;
}

.status-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.disconnected .status-dot {
  background: #f44336;
  box-shadow: 0 0 8px rgba(244, 67, 54, 0.5);
}

.disconnected {
  background: rgba(244, 67, 54, 0.2);
}
</style>
