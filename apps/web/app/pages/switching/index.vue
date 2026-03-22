<script setup lang="ts">
import '~/assets/css/switching.css'

useSeo({
  title: 'Switching — TideEye',
  description: 'Control Leopard/EmpirBus digital switches: lights, pumps, and onboard systems.',
})
useWebPageSchema({
  name: 'Switching — TideEye',
  description: 'Control Leopard/EmpirBus digital switches: lights, pumps, and onboard systems.',
})
</script>

<template>
  <div class="switching-page switching-page--mfd">
    <div class="page-header">
      <div class="page-eyebrow-row">
        <span class="page-eyebrow">
          <UIcon name="i-lucide-ship" class="page-eyebrow__icon" aria-hidden="true" />
          Leopard B6
        </span>
        <span class="page-eyebrow page-eyebrow--signal" title="Live data from SignalK">
          <span class="page-live-dot" aria-hidden="true" />
          <UIcon
            name="i-lucide-activity"
            class="page-eyebrow__icon page-eyebrow__icon--pulse"
            aria-hidden="true"
          />
          <span class="sr-only">Live</span>
          SignalK
        </span>
      </div>
      <h1 class="page-title">
        <UIcon name="i-lucide-toggle-right" class="text-primary" aria-hidden="true" />
        Switching
      </h1>
      <p class="sr-only">
        Digital outputs for lights and water pumps. Live state from SignalK; use each row's switch
        to toggle when writable.
      </p>
      <div class="page-legend" aria-hidden="true">
        <span class="page-legend__item">
          <UIcon name="i-lucide-sailboat" class="page-legend__icon text-primary" />
        </span>
        <UIcon name="i-lucide-plus" class="page-legend__sep text-dimmed" />
        <span class="page-legend__item">
          <UIcon name="i-lucide-droplets" class="page-legend__icon text-info" />
        </span>
      </div>
    </div>

    <SwitchingSwitchPanel />
  </div>
</template>
