<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="te-widget-card">
    <div class="widget-header">
      <h2 class="te-widget-title">{{ title }}</h2>
    </div>
    <div class="widget-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.te-widget-card {
  min-height: 0;
}

.widget-header {
  padding: 0.75rem 1rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid var(--te-metric-border);
}

.widget-content {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
