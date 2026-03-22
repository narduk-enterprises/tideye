<script setup lang="ts">
import WidgetContainer from '../shared/WidgetContainer.vue'
</script>

<template>
  <WidgetContainer title="">
    <div class="spacer-content">
      <div class="spacer-hint" />
    </div>
  </WidgetContainer>
</template>

<style scoped>
.spacer-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--te-widget-bg);
  border: 1px solid var(--te-metric-border);
  border-radius: 8px;
  margin: 1px;
}

.spacer-hint {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 50%,
    transparent 100%
  );
}

.spacer-content:hover .spacer-hint {
  opacity: 1;
}
</style>
