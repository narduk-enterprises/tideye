<script setup lang="ts">
import { useSignalK } from '~/composables/useSignalK'

const { activeEndpointKind, connectionState } = useSignalK()

const label = computed(() => {
  if (connectionState.value === 'idle') return 'Idle'
  if (connectionState.value === 'connecting') return 'Connecting'
  if (connectionState.value === 'reconnecting') return 'Reconnecting'
  if (connectionState.value === 'error') return 'Error'

  if (activeEndpointKind.value === 'local') return 'Local'
  if (activeEndpointKind.value === 'dev') return 'Dev'
  return 'Internet'
})

const statusClass = computed(() => {
  if (connectionState.value !== 'connected') {
    return connectionState.value
  }

  return activeEndpointKind.value
})
</script>

<template>
  <div class="signalk-status">
    <span
      class="status-dot"
      :class="statusClass"
      :title="`SignalK ${connectionState} via ${activeEndpointKind}`"
    />
    <span class="status-label">
      {{ label }}
    </span>
  </div>
</template>

<style scoped>
.signalk-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-family: var(--font-mono, monospace);
  margin-bottom: 0.5rem;
}

.status-dot {
  width: 0.9em;
  height: 0.9em;
  border-radius: 50%;
  display: inline-block;
  border: 2px solid #222;
}

.status-dot.local {
  background: #4caf50;
}

.status-dot.remote {
  background: #ff9800;
}

.status-dot.dev {
  background: #38bdf8;
}

.status-dot.connecting,
.status-dot.reconnecting {
  background: #facc15;
}

.status-dot.error {
  background: #ef4444;
}

.status-dot.none,
.status-dot.idle {
  background: #6b7280;
}

.status-label {
  opacity: 0.8;
  letter-spacing: 0.02em;
}
</style>
