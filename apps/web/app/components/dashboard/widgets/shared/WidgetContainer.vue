<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="widget">
    <div class="widget-header">
      <h2 class="widget-title">{{ title }}</h2>
    </div>
    <div class="widget-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.widget {
  height: 100%;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.widget:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.widget-header {
  padding: 1rem 1rem 0.75rem;
  position: relative;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.widget-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
}

.widget-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
