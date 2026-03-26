<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { useToggle } from '@vueuse/core'
import type { View } from '~/composables/useViewManager'

const props = defineProps<{
  views: View[]
  currentViewId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', viewId: string): void
  (e: 'edit'): void
}>()

const [isOpen, toggleOpen] = useToggle(false)

const currentView = computed(() => {
  return props.views.find((v) => v.id === props.currentViewId) || props.views[0]
})

// Track touch start position to distinguish taps from scrolls
const touchStartY = ref(0)
const touchStartTime = ref(0)

const handleSelect = (viewId: string) => {
  emit('select', viewId)
  toggleOpen(false)
}

const handleEdit = () => {
  emit('edit')
  toggleOpen(false)
}

const handleBackdropTouch = (e: TouchEvent) => {
  // Only close if touching the backdrop itself, not the dropdown
  if (e.target === e.currentTarget) {
    toggleOpen(false)
  }
}

const handleItemTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches[0].clientY
  touchStartTime.value = Date.now()
}

const handleItemTouchEnd = (e: TouchEvent, viewId: string) => {
  const touchEndY = e.changedTouches[0].clientY
  const touchDuration = Date.now() - touchStartTime.value
  const deltaY = Math.abs(touchEndY - touchStartY.value)

  // Only trigger select if it was a tap (not a scroll)
  // If movement was less than 10px and duration less than 300ms, treat as tap
  if (deltaY < 10 && touchDuration < 300) {
    handleSelect(viewId)
  }
}
</script>

<template>
  <div class="view-switcher">
    <button
      class="switcher-button"
      @click="toggleOpen()"
      @touchend.stop="toggleOpen()"
      type="button"
    >
      <span class="switcher-label">{{ currentView?.name || 'Select View' }}</span>
      <span class="switcher-icon">{{ isOpen ? '▲' : '▼' }}</span>
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="dropdown-backdrop"
        @click.self="toggleOpen(false)"
        @touchstart.self="handleBackdropTouch"
        @touchend.self="handleBackdropTouch"
      >
        <div class="switcher-dropdown" @click.stop @touchstart.stop @touchend.stop>
          <div class="dropdown-header">
            <span class="dropdown-title">Views</span>
            <button
              class="edit-button"
              @click.stop="handleEdit"
              @touchend.stop="handleEdit"
              type="button"
            >
              Edit
            </button>
          </div>
          <div class="dropdown-list">
            <button
              v-for="view in views"
              :key="view.id"
              class="dropdown-item"
              :class="{ active: view.id === currentViewId }"
              @click.stop="handleSelect(view.id)"
              @touchstart.stop="handleItemTouchStart"
              @touchend.stop="(e) => handleItemTouchEnd(e, view.id)"
              type="button"
            >
              <span class="item-name">{{ view.name }}</span>
              <span v-if="view.isDefault" class="item-badge">Default</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.view-switcher {
  position: relative;
  z-index: 100000;
  isolation: isolate;
}

.switcher-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 150px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  position: relative;
  z-index: 1;
}

.switcher-button:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
}

.switcher-button:active {
  transform: scale(0.98);
}

.switcher-label {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switcher-icon {
  font-size: 10px;
  opacity: 0.7;
  transition: transform 0.2s ease;
}

.switcher-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(28, 28, 30, 1);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  max-height: 300px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  z-index: 100001;
  isolation: isolate;
  contain: layout style paint;
  /* Smooth scrolling on iOS */
  scroll-behavior: smooth;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(28, 28, 30, 1);
  position: relative;
  z-index: 1;
}

.dropdown-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.edit-button {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.edit-button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  /* Ensure smooth scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(28, 28, 30, 1);
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  position: relative;
  z-index: 1;
  isolation: isolate;
  overflow: hidden;
  contain: layout style paint;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dropdown-item.active {
  background: rgba(33, 150, 243, 0.3);
  color: rgba(255, 255, 255, 0.95);
}

.dropdown-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.item-name {
  flex: 1;
  position: relative;
  z-index: 1;
  isolation: isolate;
}

.item-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(33, 150, 243, 0.2);
  border-radius: 4px;
  color: rgba(33, 150, 243, 1);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  z-index: 1;
  isolation: isolate;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from .switcher-dropdown,
.dropdown-leave-to .switcher-dropdown {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-enter-from .dropdown-backdrop,
.dropdown-leave-to .dropdown-backdrop {
  opacity: 0;
}

.dropdown-backdrop {
  display: none;
  pointer-events: none;
}

@media (min-width: 769px) {
  .dropdown-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
    pointer-events: auto;
    z-index: 100000;
  }

  .switcher-dropdown {
    pointer-events: auto;
  }
}

@media (max-width: 768px) {
  .dropdown-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 100000;
    /* Allow touch events to work properly */
    touch-action: pan-y pinch-zoom;
  }

  .switcher-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    bottom: auto;
    left: 0;
    right: 0;
    border-radius: 12px;
    max-height: 60vh;
    max-height: min(60vh, calc(100vh - env(safe-area-inset-top) - 200px));
    z-index: 100001;
    /* Smooth momentum scrolling on iOS */
    -webkit-overflow-scrolling: touch;
    /* Prevent bounce at top/bottom */
    overscroll-behavior-y: contain;
    /* Better touch handling - allow scrolling */
    touch-action: pan-y;
    /* Add padding for safe area */
    padding-bottom: env(safe-area-inset-bottom);
    /* Ensure it's interactive */
    pointer-events: auto;
  }

  .dropdown-list {
    /* Allow vertical scrolling */
    touch-action: pan-y;
    /* Ensure scrolling works */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .dropdown-item {
    /* Better touch targets on mobile */
    min-height: 48px;
    padding: 14px 16px;
    /* Prevent text selection during scroll */
    -webkit-user-select: none;
    user-select: none;
    /* Better tap response */
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
    /* Ensure buttons are tappable */
    pointer-events: auto;
    /* Prevent double-tap zoom */
    touch-action: manipulation;
  }

  .switcher-button {
    /* Better touch target */
    min-height: 44px;
    padding: 12px 16px;
  }

  .edit-button {
    /* Better touch target */
    min-height: 36px;
    padding: 6px 14px;
  }
}

/* iOS-specific improvements */
@supports (-webkit-touch-callout: none) {
  .switcher-dropdown {
    /* Better momentum scrolling */
    -webkit-overflow-scrolling: touch;
    /* Prevent rubber band effect */
    overscroll-behavior-y: contain;
    /* Smooth animations */
    will-change: transform;
  }

  .dropdown-item {
    /* Prevent iOS text selection */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    /* Better tap feedback */
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.15);
  }

  /* Smooth transitions */
  .dropdown-enter-active .switcher-dropdown,
  .dropdown-leave-active .switcher-dropdown {
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }

  .dropdown-enter-active .dropdown-backdrop,
  .dropdown-leave-active .dropdown-backdrop {
    transition: opacity 0.2s ease;
  }

  .dropdown-enter-from .switcher-dropdown,
  .dropdown-leave-to .switcher-dropdown {
    transform: translateY(-8px);
    opacity: 0;
  }

  .dropdown-enter-from .dropdown-backdrop,
  .dropdown-leave-to .dropdown-backdrop {
    opacity: 0;
  }
}
</style>
