<script setup lang="ts">
import { useSignalKConnectionHealth } from '~/composables/useSignalKConnectionHealth'

const { isConnected, isStale, connectionState } = useSignalKConnectionHealth()
</script>

<template>
  <div
    class="connection-status"
    :class="{ disconnected: !isConnected, stale: isStale && connectionState === 'connected' }"
  >
    <div class="status-dot"></div>
    <span class="status-text">
      {{ isConnected ? 'Connected' : connectionState === 'idle' ? 'Idle' : connectionState }}
    </span>
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

.stale .status-dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}
</style>
