<script setup lang="ts">
/**
 * Switch panel — groups switches by category (Lights, Pumps).
 * Uses useSwitching composable for state and actions.
 */
const { lights, pumps, error, lastAction, fetchStates, toggleSwitch, isLoading } = useSwitching()
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchStates()
  refreshInterval = setInterval(() => {
    fetchStates().catch(() => {})
  }, 10_000)
})

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})
</script>

<template>
  <div class="switch-panel">
    <!-- Error Banner -->
    <div v-if="error" class="panel-banner panel-banner--error">
      <UIcon name="i-lucide-alert-triangle" class="text-lg text-error" />
      <span class="text-sm text-error">{{ error }}</span>
    </div>

    <!-- Success Banner -->
    <div v-if="lastAction" class="panel-banner panel-banner--success">
      <UIcon name="i-lucide-check-circle" class="text-lg text-success" />
      <span class="text-sm text-success">{{ lastAction }}</span>
    </div>

    <!-- Lights Section -->
    <div class="switch-section">
      <div class="section-header">
        <UIcon name="i-lucide-lightbulb" class="text-lg text-primary" />
        <h3 class="section-title">Lights</h3>
      </div>
      <div class="switch-grid">
        <SwitchingSwitchControl
          v-for="sw in lights"
          :key="sw.id"
          :id="sw.id"
          :label="sw.label"
          :state="sw.state"
          :writable="sw.writable"
          :loading="isLoading(sw.id).value"
          :category="sw.category"
          @toggle="toggleSwitch"
        />
      </div>
    </div>

    <!-- Pumps Section -->
    <div class="switch-section">
      <div class="section-header">
        <UIcon name="i-lucide-droplets" class="text-lg text-info" />
        <h3 class="section-title">Pumps</h3>
      </div>
      <div class="switch-grid">
        <SwitchingSwitchControl
          v-for="sw in pumps"
          :key="sw.id"
          :id="sw.id"
          :label="sw.label"
          :state="sw.state"
          :writable="sw.writable"
          :loading="isLoading(sw.id).value"
          :category="sw.category"
          @toggle="toggleSwitch"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="panel-footer">
      <UIcon name="i-lucide-info" class="text-sm text-dimmed" />
      <span class="text-xs text-dimmed">
        State metadata is read from the SignalK Leopard plugin. Commands are sent server-side over
        the authenticated SignalK device-access path.
      </span>
    </div>
  </div>
</template>

<style scoped>
.switch-panel {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 48rem;
  margin: 0 auto;
}

.panel-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-card);
  border: 1px solid;
}

.panel-banner--error {
  background: color-mix(in srgb, var(--color-error-500) 10%, var(--color-bg-elevated));
  border-color: var(--color-error-500);
}

.panel-banner--success {
  background: color-mix(in srgb, var(--color-success-500) 10%, var(--color-bg-elevated));
  border-color: var(--color-success-500);
}

.switch-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.25rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-default);
  margin: 0;
}

.switch-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .switch-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}

.panel-footer {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-card);
  background: var(--color-bg-muted);
}
</style>
