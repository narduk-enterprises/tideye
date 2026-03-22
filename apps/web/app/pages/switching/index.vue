<script setup lang="ts">
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
  <div class="switching-page">
    <div class="page-header">
      <h1 class="page-title">
        <UIcon name="i-lucide-toggle-right" class="text-primary" />
        Switching
      </h1>
      <p class="page-subtitle">EmpirBus digital switch control</p>
    </div>

    <SwitchingSwitchPanel />
  </div>
</template>

<style scoped>
.switching-page {
  min-height: calc(100vh - 4rem);
  padding: 1.5rem;
  padding-bottom: calc(env(safe-area-inset-bottom) + 120px);
}

.page-header {
  max-width: 48rem;
  margin: 0 auto 2rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-default);
  margin: 0 0 0.25rem;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
