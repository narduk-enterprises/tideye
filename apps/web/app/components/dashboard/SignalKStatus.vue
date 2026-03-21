<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSignalKStore } from '~/stores/signalk'

const { isLocalSignalK } = storeToRefs(useSignalKStore())
</script>

<template>
  <div class="signalk-status">
    <span
      class="status-dot"
      :class="isLocalSignalK ? 'local' : 'internet'"
      :title="
        isLocalSignalK ? 'Connected to local SignalK server' : 'Connected to SignalK via Internet'
      "
    />
    <span class="status-label">
      {{ isLocalSignalK ? 'Local' : 'Internet' }}
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

.status-dot.internet {
  background: #ff9800;
}

.status-label {
  opacity: 0.8;
  letter-spacing: 0.02em;
}
</style>
