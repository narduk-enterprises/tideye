<script setup lang="ts">
import type { View } from '~/composables/useViewManager'

const props = defineProps<{
  views: View[]
  currentViewId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create'): void
  (e: 'duplicate', viewId: string): void
  (e: 'rename', viewId: string, newName: string): void
  (e: 'delete', viewId: string): void
  (e: 'setDefault', viewId: string): void
}>()

const editingViewId = ref<string | null>(null)
const editingName = ref('')

const handleClose = () => {
  editingViewId.value = null
  emit('close')
}

const startRename = (view: View) => {
  editingViewId.value = view.id
  editingName.value = view.name
}

const saveRename = () => {
  if (editingViewId.value && editingName.value.trim()) {
    emit('rename', editingViewId.value, editingName.value.trim())
    editingViewId.value = null
  }
}

const cancelRename = () => {
  editingViewId.value = null
}
</script>

<template>
  <Transition name="fade">
    <div class="manager-overlay" @click.self="handleClose">
      <div class="manager-panel" @click.stop>
        <div class="manager-header">
          <h3>Manage Views</h3>
          <button @click="handleClose" class="close-button">✕</button>
        </div>
        <div class="manager-content">
          <div class="actions-bar">
            <button @click="emit('create')" class="action-button">+ Create New View</button>
          </div>
          <div class="views-list">
            <div
              v-for="view in views"
              :key="view.id"
              class="view-item"
              :class="{ active: view.id === currentViewId }"
            >
              <div v-if="editingViewId === view.id" class="view-edit">
                <input
                  v-model="editingName"
                  @keyup.enter="saveRename"
                  @keyup.esc="cancelRename"
                  class="edit-input"
                  type="text"
                  autofocus
                />
                <div class="edit-actions">
                  <button @click="saveRename" class="edit-save">✓</button>
                  <button @click="cancelRename" class="edit-cancel">✕</button>
                </div>
              </div>
              <div v-else class="view-display">
                <div class="view-info">
                  <span class="view-name">{{ view.name }}</span>
                  <span v-if="view.isDefault" class="view-badge">Default</span>
                  <span v-if="view.id === currentViewId" class="view-badge current">Current</span>
                </div>
                <div class="view-actions">
                  <button @click="startRename(view)" class="icon-button" title="Rename">✏️</button>
                  <button @click="emit('duplicate', view.id)" class="icon-button" title="Duplicate">
                    📋
                  </button>
                  <button
                    v-if="!view.isDefault"
                    @click="emit('setDefault', view.id)"
                    class="icon-button"
                    title="Set as Default"
                  >
                    ⭐
                  </button>
                  <button
                    v-if="views.length > 1"
                    @click="emit('delete', view.id)"
                    class="icon-button delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.manager-overlay {
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

.manager-panel {
  background: rgba(28, 28, 30, 0.98);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.manager-header h3 {
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

.manager-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.actions-bar {
  margin-bottom: 20px;
}

.action-button {
  width: 100%;
  padding: 12px 24px;
  background: rgba(33, 150, 243, 0.2);
  border: 1px solid rgba(33, 150, 243, 0.4);
  border-radius: 8px;
  color: rgba(33, 150, 243, 1);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: rgba(33, 150, 243, 0.3);
}

.views-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.view-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.view-item.active {
  border-color: rgba(33, 150, 243, 0.5);
  background: rgba(33, 150, 243, 0.1);
}

.view-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.view-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.view-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
}

.view-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(33, 150, 243, 0.2);
  border-radius: 4px;
  color: rgba(33, 150, 243, 1);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.view-badge.current {
  background: rgba(76, 175, 80, 0.2);
  color: rgba(76, 175, 80, 1);
}

.view-actions {
  display: flex;
  gap: 4px;
}

.icon-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.icon-button.delete:hover {
  background: rgba(244, 67, 54, 0.2);
  border-color: rgba(244, 67, 54, 0.4);
}

.view-edit {
  display: flex;
  gap: 8px;
  align-items: center;
}

.edit-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
}

.edit-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.edit-actions {
  display: flex;
  gap: 4px;
}

.edit-save,
.edit-cancel {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-save {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  color: rgba(76, 175, 80, 1);
}

.edit-cancel {
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.4);
  color: rgba(244, 67, 54, 1);
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
