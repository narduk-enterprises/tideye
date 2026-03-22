<script setup lang="ts">
const { lights, pumps, error, fetchStates, toggleSwitch, isLoading } = useSwitching()
let refreshInterval: ReturnType<typeof setInterval> | null = null

const summarize = (items: Array<{ state: 'on' | 'off' | 'unknown' }>) => {
  const active = items.filter((item) => item.state === 'on').length
  const unknown = items.filter((item) => item.state === 'unknown').length
  return {
    total: items.length,
    active,
    unknown,
  }
}

const lightSummary = computed(() => summarize(lights.value))
const pumpSummary = computed(() => summarize(pumps.value))

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
    <div v-if="error" class="panel-inline-status panel-inline-status--error">
      <UIcon name="i-lucide-alert-triangle" class="text-sm" />
      <span>{{ error }}</span>
    </div>

    <section class="switch-section switch-section--mfd">
      <div class="section-header">
        <div class="section-title-wrap">
          <UIcon name="i-lucide-lightbulb" class="text-lg text-primary" aria-hidden="true" />
          <h3 class="section-title">Lights</h3>
        </div>
        <div class="section-summary" role="group" aria-label="Lights summary">
          <span class="section-stat" :title="`${lightSummary.total} circuits`">
            <UIcon name="i-lucide-layout-grid" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ lightSummary.total }}</span>
            <span class="sr-only">circuits</span>
          </span>
          <span class="section-stat section-stat--active" :title="`${lightSummary.active} on`">
            <UIcon name="i-lucide-zap" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ lightSummary.active }}</span>
            <span class="sr-only">on</span>
          </span>
          <span
            v-if="lightSummary.unknown"
            class="section-stat section-stat--unknown"
            :title="`${lightSummary.unknown} unknown state`"
          >
            <UIcon name="i-lucide-help-circle" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ lightSummary.unknown }}</span>
            <span class="sr-only">unknown state</span>
          </span>
        </div>
      </div>
      <div class="switch-grid switch-grid--lights">
        <SwitchingSwitchControl
          v-for="sw in lights"
          :key="sw.id"
          :id="sw.id"
          :label="sw.label"
          :state="sw.state"
          :writable="sw.writable"
          :loading="isLoading(sw.id).value"
          @toggle="toggleSwitch"
        />
      </div>
    </section>

    <section class="switch-section switch-section--mfd">
      <div class="section-header">
        <div class="section-title-wrap">
          <UIcon name="i-lucide-droplets" class="text-lg text-info" aria-hidden="true" />
          <h3 class="section-title">Pumps</h3>
        </div>
        <div class="section-summary" role="group" aria-label="Pumps summary">
          <span class="section-stat" :title="`${pumpSummary.total} circuits`">
            <UIcon name="i-lucide-layout-grid" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ pumpSummary.total }}</span>
            <span class="sr-only">circuits</span>
          </span>
          <span class="section-stat section-stat--active" :title="`${pumpSummary.active} running`">
            <UIcon name="i-lucide-waves" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ pumpSummary.active }}</span>
            <span class="sr-only">running</span>
          </span>
          <span
            v-if="pumpSummary.unknown"
            class="section-stat section-stat--unknown"
            :title="`${pumpSummary.unknown} unknown state`"
          >
            <UIcon name="i-lucide-help-circle" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ pumpSummary.unknown }}</span>
            <span class="sr-only">unknown state</span>
          </span>
        </div>
      </div>
      <div class="switch-grid switch-grid--pumps">
        <SwitchingSwitchControl
          v-for="sw in pumps"
          :key="sw.id"
          :id="sw.id"
          :label="sw.label"
          :state="sw.state"
          :writable="sw.writable"
          :loading="isLoading(sw.id).value"
          @toggle="toggleSwitch"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Panel layout lives in ~/assets/css/switching.css — empty block so Tailwind/Vue style pipeline gets valid CSS. */
</style>
