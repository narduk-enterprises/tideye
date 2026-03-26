<script setup lang="ts">
import type { Widget } from '~/types/widgets'

const props = defineProps<{
  widget: Widget | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', config: any): void
}>()

const currentView = ref(0)

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="widget" class="config-overlay" @click.self="handleClose">
      <div class="config-panel" @click.stop>
        <div class="config-header">
          <h3>Configure {{ widget.name }}</h3>
          <button @click="handleClose" class="close-button">✕</button>
        </div>
        <div class="config-content">
          <div class="config-section">
            <label class="config-label">View Variant</label>
            <select v-model="currentView" class="config-select">
              <option v-for="(_, index) in Array(widget.maxStates)" :key="index" :value="index">
                View {{ index + 1 }}
              </option>
            </select>
          </div>
        </div>
        <div class="config-footer">
          <button @click="handleClose" class="cancel-button">Cancel</button>
          <button @click="emit('update', { currentView })" class="save-button">Save</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.config-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.config-panel {
  background: rgba(28, 28, 30, 0.98);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.config-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.close-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.4);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(244, 67, 54, 0.3);
}

.config-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.config-section {
  margin-bottom: 20px;
}

.config-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 8px;
}

.config-select {
  width: 100%;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  cursor: pointer;
}

.config-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.config-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-button,
.save-button {
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.cancel-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.cancel-button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.save-button {
  background: rgba(33, 150, 243, 0.2);
  border: 1px solid rgba(33, 150, 243, 0.4);
  color: rgba(33, 150, 243, 1);
}

.save-button:hover {
  background: rgba(33, 150, 243, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
