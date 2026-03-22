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
  <div class="flex flex-col gap-8 max-w-3xl mx-auto">
    <!-- Error Banner -->
    <div
      v-if="error"
      class="flex items-center gap-3 px-4 py-3 rounded-(--radius-card) border border-error bg-[color-mix(in_srgb,var(--color-error-500)_10%,var(--color-bg-elevated))]"
    >
      <UIcon name="i-lucide-alert-triangle" class="text-lg text-error" />
      <span class="text-sm text-error">{{ error }}</span>
    </div>

    <!-- Success Banner -->
    <div
      v-if="lastAction"
      class="flex items-center gap-3 px-4 py-3 rounded-(--radius-card) border border-success bg-[color-mix(in_srgb,var(--color-success-500)_10%,var(--color-bg-elevated))]"
    >
      <UIcon name="i-lucide-check-circle" class="text-lg text-success" />
      <span class="text-sm text-success">{{ lastAction }}</span>
    </div>

    <!-- Lights Section -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 px-1">
        <UIcon name="i-lucide-lightbulb" class="text-lg text-primary" />
        <h3 class="text-base font-semibold text-default m-0">Lights</h3>
      </div>
      <div class="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
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
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 px-1">
        <UIcon name="i-lucide-droplets" class="text-lg text-info" />
        <h3 class="text-base font-semibold text-default m-0">Pumps</h3>
      </div>
      <div class="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
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
    <div class="flex items-start gap-2 px-4 py-3 rounded-(--radius-card) bg-muted">
      <UIcon name="i-lucide-info" class="text-sm text-dimmed" />
      <span class="text-xs text-dimmed">
        State metadata is read from the SignalK Leopard plugin. Commands are sent server-side over
        the authenticated SignalK device-access path.
      </span>
    </div>
  </div>
</template>
