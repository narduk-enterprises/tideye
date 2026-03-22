<script setup lang="ts">
const { lights, pumps, error, fetchStates, toggleSwitch, isLoading } = useSwitching()
let refreshInterval: ReturnType<typeof setInterval> | null = null

const summarize = (items: Array<{ state: 'on' | 'off' | 'unknown' }>) => {
  const active = items.filter((item) => item.state === 'on').length
  const unknown = items.filter((item) => item.state === 'unknown').length
  return { total: items.length, active, unknown }
}

const sections = computed(() => [
  {
    key: 'lights',
    title: 'Lights',
    icon: 'i-lucide-lightbulb',
    iconColor: 'text-primary',
    activeIcon: 'i-lucide-zap',
    activeLabel: 'on',
    items: lights.value,
    summary: summarize(lights.value),
    gridClass: 'switch-grid--lights',
  },
  {
    key: 'pumps',
    title: 'Pumps',
    icon: 'i-lucide-droplets',
    iconColor: 'text-info',
    activeIcon: 'i-lucide-waves',
    activeLabel: 'running',
    items: pumps.value,
    summary: summarize(pumps.value),
    gridClass: 'switch-grid--pumps',
  },
])

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

    <section
      v-for="section in sections"
      :key="section.key"
      class="switch-section switch-section--mfd"
    >
      <div class="section-header">
        <div class="section-title-wrap">
          <UIcon :name="section.icon" :class="['text-lg', section.iconColor]" aria-hidden="true" />
          <h3 class="section-title">{{ section.title }}</h3>
        </div>
        <div class="section-summary" role="group" :aria-label="`${section.title} summary`">
          <span class="section-stat" :title="`${section.summary.total} circuits`">
            <UIcon name="i-lucide-layout-grid" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ section.summary.total }}</span>
            <span class="sr-only">circuits</span>
          </span>
          <span
            class="section-stat section-stat--active"
            :title="`${section.summary.active} ${section.activeLabel}`"
          >
            <UIcon :name="section.activeIcon" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ section.summary.active }}</span>
            <span class="sr-only">{{ section.activeLabel }}</span>
          </span>
          <span
            v-if="section.summary.unknown"
            class="section-stat section-stat--unknown"
            :title="`${section.summary.unknown} unknown state`"
          >
            <UIcon name="i-lucide-help-circle" class="section-stat__icon" aria-hidden="true" />
            <span class="section-stat__n">{{ section.summary.unknown }}</span>
            <span class="sr-only">unknown state</span>
          </span>
        </div>
      </div>
      <div :class="['switch-grid', section.gridClass]">
        <SwitchingSwitchControl
          v-for="sw in section.items"
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
