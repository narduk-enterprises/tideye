<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { useDraggable } from 'vue-draggable-plus'
import { useToggle, useDebounceFn } from '@vueuse/core'
import { WIDGET_REGISTRY, DEFAULT_LAYOUT } from '~/config/widgets'
import { DEFAULT_VIEWS } from '~/config/views'
import { useWidgetManager } from '~/composables/useWidgetManager'
import { useViewManager } from '~/composables/useViewManager'
import { useMobileFeatures } from '~/composables/useMobileFeatures'
import { useSignalKBundle } from '~/composables/useSignalKBundle'
import type { BaseWidget } from '~/types/widgets'

useSignalKBundle('dashboard')

// View manager
const viewManager = useViewManager(WIDGET_REGISTRY, DEFAULT_VIEWS)

// Widget manager
const { activeWidgets, widgetCycleStates, saveLayout, addWidget, removeWidget, handleWidgetCycle } =
  useWidgetManager(WIDGET_REGISTRY, DEFAULT_LAYOUT)

// Load current view on mount
const loadCurrentView = () => {
  const currentId = viewManager.currentViewId.value
  const viewsList = viewManager.views.value
  if (currentId) {
    const widgets = viewManager.loadView(currentId)
    activeWidgets.value = widgets
  } else if (viewsList && viewsList.length > 0) {
    const widgets = viewManager.loadView(viewsList[0].id)
    activeWidgets.value = widgets
  }
}

loadCurrentView()

// Mobile features
const mobileFeatures = useMobileFeatures()

const [isEditMode, toggleEditMode] = useToggle(false)
const [isToolbarVisible, toggleToolbarVisible] = useToggle(false)
const inspectorRef = ref<InstanceType<
  typeof import('~/components/dashboard/SignalKInspector.vue').default
> | null>(null)
const widgetSearchQuery = ref('')
const selectedCategory = ref('All')

const widgetCategories = computed(() => {
  const categories = new Set<string>(['All'])
  for (const widget of WIDGET_REGISTRY) {
    if (widget.id.includes('wind')) categories.add('Wind')
    else if (widget.id.includes('tank')) categories.add('Tanks')
    else if (widget.id.includes('temp')) categories.add('Environment')
    else if (
      widget.id.includes('battery') ||
      widget.id.includes('solar') ||
      widget.id.includes('inverter') ||
      widget.id.includes('charger')
    )
      categories.add('Electrical')
    else if (widget.id === 'navigation' || widget.id === 'steering' || widget.id === 'propulsion')
      categories.add('Navigation')
    else if (widget.id === 'notifications' || widget.id === 'entertainment')
      categories.add('System')
    else categories.add('Other')
  }
  return Array.from(categories).sort()
})

const filteredWidgets = computed(() => {
  let widgets = WIDGET_REGISTRY as BaseWidget[]

  if (selectedCategory.value !== 'All') {
    widgets = widgets.filter((widget) => {
      if (selectedCategory.value === 'Wind') return widget.id.includes('wind')
      if (selectedCategory.value === 'Tanks') return widget.id.includes('tank')
      if (selectedCategory.value === 'Environment')
        return (
          widget.id.includes('temp') ||
          widget.id.includes('depth') ||
          widget.id.includes('air') ||
          widget.id.includes('pressure') ||
          widget.id.includes('current') ||
          widget.id.includes('tide')
        )
      if (selectedCategory.value === 'Electrical')
        return (
          widget.id.includes('battery') ||
          widget.id.includes('solar') ||
          widget.id.includes('inverter') ||
          widget.id.includes('charger')
        )
      if (selectedCategory.value === 'Navigation')
        return widget.id === 'navigation' || widget.id === 'steering' || widget.id === 'propulsion'
      if (selectedCategory.value === 'System')
        return widget.id === 'notifications' || widget.id === 'entertainment'
      return true
    })
  }

  if (widgetSearchQuery.value) {
    const query = widgetSearchQuery.value.toLowerCase()
    widgets = widgets.filter(
      (widget) =>
        widget.name.toLowerCase().includes(query) || widget.id.toLowerCase().includes(query),
    )
  }

  return widgets
})

const debouncedSaveLayout = useDebounceFn(() => {
  saveLayout()
  viewManager.saveCurrentView(activeWidgets.value)
}, 300)

// Drag-and-drop — composable form avoids Options API defineComponent (fixes mounted$ warning)
const dragContainer = ref<HTMLElement | null>(null)
const drag = useDraggable(dragContainer, activeWidgets, {
  immediate: false,
  animation: 200,
  ghostClass: 'ghost-widget',
  dragClass: 'dragging-widget',
  disabled: true,
  handle: '.drag-handle',
  delay: 200,
  delayOnTouchOnly: true,
  touchStartThreshold: 5,
  onEnd: () => debouncedSaveLayout(),
})

// Initialize draggable when the container DOM element becomes available
// (.client.vue lifecycle means refs aren't populated in onMounted)
watch(
  dragContainer,
  (el) => {
    if (el) drag.start()
  },
  { once: true },
)

// Reactively toggle drag based on edit mode
watch(isEditMode, (editing) => {
  if (editing) drag.resume()
  else drag.pause()
})

const handleViewSelect = (viewId: string) => {
  const widgets = viewManager.loadView(viewId)
  activeWidgets.value = widgets
}

const [isViewManagerVisible, toggleViewManager] = useToggle(false)

const handleViewEdit = () => {
  toggleViewManager(true)
}

const handleViewManagerAction = (action: string, ...args: any[]) => {
  switch (action) {
    case 'create': {
      const newView = viewManager.createView('New View', activeWidgets.value)
      viewManager.loadView(newView.id)
      activeWidgets.value = viewManager.loadView(newView.id)
      break
    }
    case 'duplicate':
      if (args[0]) {
        const duplicated = viewManager.duplicateView(args[0])
        if (duplicated) {
          viewManager.loadView(duplicated.id)
          activeWidgets.value = viewManager.loadView(duplicated.id)
        }
      }
      break
    case 'rename':
      if (args[0] && args[1]) {
        viewManager.renameView(args[0], args[1])
      }
      break
    case 'delete':
      if (args[0]) {
        viewManager.deleteView(args[0])
        loadCurrentView()
      }
      break
    case 'setDefault':
      if (args[0]) {
        viewManager.setDefaultView(args[0])
      }
      break
  }
}

const handleWidgetAdd = async (baseWidget: BaseWidget) => {
  addWidget(baseWidget)
  await nextTick()
  widgetSearchQuery.value = ''
  selectedCategory.value = 'All'
  toggleToolbarVisible(false)
}

const getWidgetIcon = (widgetId: string): string => {
  const icons: Record<string, string> = {
    battery: '🔋',
    solar: '☀️',
    wind: '💨',
    'apparent-wind': '💨',
    'water-tanks': '💧',
    'fuel-tanks': '⛽',
    'water-temp': '🌡️',
    depth: '📏',
    inverter: '⚡',
    charger: '🔌',
    entertainment: '🎵',
    navigation: '🧭',
    steering: '⚓',
    propulsion: '🚤',
    'air-temp': '🌡️',
    'barometric-pressure': '📊',
    current: '🌊',
    tide: '🌊',
    notifications: '🔔',
    spacer: '⬜',
  }
  return icons[widgetId] || '📦'
}

const getWidgetMeta = (widget: BaseWidget): string => {
  if (widget.maxStates && widget.maxStates > 1) {
    return `${widget.maxStates} views`
  }
  return ''
}

watch(isEditMode, (value) => {
  if (!value) {
    toggleToolbarVisible(false)
  }
})

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isToolbarVisible.value) toggleToolbarVisible(false)
    if (isViewManagerVisible.value) toggleViewManager(false)
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault()
    toggleEditMode()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k' && isEditMode.value) {
    e.preventDefault()
    toggleToolbarVisible(true)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <DashboardSignalKStatus />
      <div class="header-actions">
        <DashboardViewSwitcher
          :views="viewManager.views.value"
          :current-view-id="viewManager.currentViewId.value"
          @select="handleViewSelect"
          @edit="handleViewEdit"
        />
        <div v-if="isEditMode" class="edit-mode-actions">
          <UButton
            icon="i-lucide-plus"
            label="Add Widget"
            variant="soft"
            color="primary"
            size="sm"
            @click.stop="toggleToolbarVisible(true)"
          />
          <UButton
            icon="i-lucide-search"
            label="Inspector"
            variant="soft"
            color="neutral"
            size="sm"
            @click.stop="inspectorRef?.toggle()"
          />
        </div>
        <UButton
          :icon="isEditMode ? 'i-lucide-check' : 'i-lucide-pencil'"
          :label="isEditMode ? 'Done' : 'Edit'"
          :variant="isEditMode ? 'solid' : 'soft'"
          :color="isEditMode ? 'primary' : 'neutral'"
          size="sm"
          @click="() => toggleEditMode()"
        />
      </div>
    </div>

    <div class="dashboard-content">
      <div ref="dragContainer" class="dashboard-grid">
        <div
          v-for="element in activeWidgets"
          :key="element.instanceId"
          class="widget-wrapper"
          :class="[
            { 'edit-mode': isEditMode },
            `widget-wrapper--${element.tileSize ?? 'standard'}`,
          ]"
          :data-widget-name="element.name"
          @touchstart.prevent="!isEditMode && handleWidgetCycle(element)"
        >
          <UButton
            v-if="isEditMode"
            icon="i-lucide-x"
            class="remove-widget"
            variant="soft"
            color="error"
            size="xs"
            @click.stop="removeWidget(element.instanceId)"
          />
          <div v-if="isEditMode" class="drag-handle">⋮⋮</div>
          <div class="widget-tap-area" @click.stop="!isEditMode && handleWidgetCycle(element)">
            <component
              :is="element.component"
              :current-view="widgetCycleStates[element.instanceId] || 0"
              :max-states="element.maxStates"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Widget Selection Modal -->
    <Transition name="sheet">
      <div v-if="isToolbarVisible" class="widget-toolbar-container">
        <div class="widget-toolbar-backdrop" @click="toggleToolbarVisible(false)">
          <div class="widget-toolbar" @click.stop>
            <div class="widget-toolbar-header">
              <div class="toolbar-handle" />
              <h2 class="widget-toolbar-title">Add Widget</h2>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="xs"
                class="absolute right-4"
                @click="toggleToolbarVisible(false)"
              />
            </div>
            <div class="widget-toolbar-search">
              <UIcon name="i-lucide-search" class="text-lg opacity-50" />
              <UInput
                v-model="widgetSearchQuery"
                placeholder="Search widgets..."
                class="w-full"
                autofocus
                @keyup.esc="toggleToolbarVisible(false)"
              />
            </div>
            <div class="widget-categories">
              <UButton
                v-for="category in widgetCategories"
                :key="category"
                :label="category"
                :variant="selectedCategory === category ? 'solid' : 'soft'"
                :color="selectedCategory === category ? 'primary' : 'neutral'"
                size="xs"
                @click="selectedCategory = category"
              />
            </div>
            <div class="widget-list-container">
              <div v-if="filteredWidgets.length === 0" class="no-widgets">
                <div class="no-widgets-icon">🔍</div>
                <div class="no-widgets-text">No widgets found</div>
                <div class="no-widgets-hint">Try a different search term or category</div>
              </div>
              <div v-else class="widget-buttons">
                <div
                  v-for="widget in filteredWidgets"
                  :key="widget.id"
                  class="widget-button"
                  role="button"
                  tabindex="0"
                  @click.prevent.stop="handleWidgetAdd(widget)"
                  @keydown.enter="handleWidgetAdd(widget)"
                >
                  <div class="widget-button-content">
                    <div class="widget-button-icon">{{ getWidgetIcon(widget.id) }}</div>
                    <div class="widget-button-info">
                      <div class="widget-button-name">{{ widget.name }}</div>
                      <div class="widget-button-meta">{{ getWidgetMeta(widget) }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- SignalK Inspector -->
    <DashboardSignalKInspector ref="inspectorRef" />

    <!-- View Manager Panel -->
    <DashboardViewManagerPanel
      v-if="isViewManagerVisible"
      :views="viewManager.views.value"
      :current-view-id="viewManager.currentViewId.value"
      @close="toggleViewManager(false)"
      @create="handleViewManagerAction('create')"
      @duplicate="(id: string) => handleViewManagerAction('duplicate', id)"
      @rename="(id: string, name: string) => handleViewManagerAction('rename', id, name)"
      @delete="(id: string) => handleViewManagerAction('delete', id)"
      @set-default="(id: string) => handleViewManagerAction('setDefault', id)"
    />
  </div>
</template>

<style scoped>
.dashboard {
  min-height: calc(100vh - 4rem);
  width: 100%;
  padding: 1.25rem;
  padding-bottom: calc(env(safe-area-inset-bottom) + 120px);
  background: var(--color-default);
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
  position: relative;
  z-index: 1000;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  justify-content: flex-end;
}

.edit-mode-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .edit-mode-actions {
    width: 100%;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
}

.dashboard-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 50vh;
  position: relative;
}

@media (min-width: 768px) {
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    grid-auto-rows: var(--te-dashboard-row-unit);
    grid-auto-flow: row dense;
    gap: 0.75rem;
    align-items: stretch;
    align-content: start;
  }
}

.widget-wrapper {
  position: relative;
  border-radius: var(--radius-card);
  overflow: visible;
  background: transparent;
  transition: all var(--transition-base) ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  z-index: 1;
  isolation: isolate;
  display: flex;
  flex-direction: column;
}

/* Shorter tiers: ~8.8 / ~11.5 / ~14.1 rem at default row unit (was ~15 / ~19.5 / ~25 rem) */
.widget-wrapper--compact {
  min-height: calc(11 * var(--te-dashboard-row-unit));
}

.widget-wrapper--standard {
  min-height: calc(14 * var(--te-dashboard-row-unit));
}

.widget-wrapper--expanded {
  min-height: calc(17 * var(--te-dashboard-row-unit));
}

@media (min-width: 768px) {
  .widget-wrapper--compact {
    grid-row: span 11;
  }

  .widget-wrapper--standard {
    grid-row: span 14;
  }

  .widget-wrapper--expanded {
    grid-row: span 17;
  }
}

.widget-wrapper :deep(.te-widget-card) {
  min-height: 0;
  flex: 1;
}

.widget-wrapper.edit-mode {
  transform: scale(0.98);
  opacity: 0.9;
  border: 2px dashed var(--color-border-default);
  border-radius: var(--radius-card);
  position: relative;
}

.widget-wrapper.edit-mode::after {
  content: attr(data-widget-name);
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--color-text-dimmed);
  background: var(--color-bg-default);
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 1;
}

.drag-handle {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  border-radius: 10px;
  border: 1px solid var(--color-border-default);
  color: var(--color-text-default);
  font-size: 16px;
  z-index: 10;
  backdrop-filter: blur(12px);
  cursor: move;
  touch-action: none;
  box-shadow: var(--shadow-card);
  transition: all var(--transition-fast) ease;
}

.drag-handle:active {
  transform: scale(0.95);
}

.ghost-widget {
  opacity: 0.4;
  background: var(--color-bg-muted);
  border: 2px dashed var(--color-border-default);
  border-radius: var(--radius-card);
  height: 100%;
}

.dragging-widget {
  opacity: 0.9;
  transform: scale(1.03) rotate(1deg);
  box-shadow: var(--shadow-overlay);
  z-index: 1000;
}

.remove-widget {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.widget-wrapper.edit-mode .widget-tap-area {
  pointer-events: none;
}

.widget-tap-area {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Widget toolbar modal */
.widget-toolbar-container {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 9999;
}

.widget-toolbar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.widget-toolbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-elevated);
  backdrop-filter: blur(30px);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  overflow: hidden;
  border-top: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-overlay);
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.widget-toolbar-header {
  padding: 12px 20px 16px;
  position: relative;
  border-bottom: 1px solid var(--color-border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toolbar-handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background: var(--color-text-dimmed);
  border-radius: 2px;
  opacity: 0.5;
}

.widget-toolbar-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-default);
  margin: 0;
}

.widget-toolbar-search {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-default);
  display: flex;
  align-items: center;
  gap: 12px;
}

.widget-categories {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-default);
  overflow-x: auto;
  scrollbar-width: none;
}

.widget-categories::-webkit-scrollbar {
  display: none;
}

.widget-list-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding-bottom: env(safe-area-inset-bottom);
}

.widget-buttons {
  padding: 8px 0;
}

.widget-button {
  width: 100%;
  padding: 16px 20px;
  background: none;
  border: none;
  color: var(--color-text-default);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  min-height: 64px;
  display: flex;
  align-items: center;
}

.widget-button:hover {
  background: var(--color-bg-muted);
}

.widget-button:not(:last-child) {
  border-bottom: 1px solid var(--color-border-default);
}

.widget-button-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.widget-button-icon {
  font-size: 28px;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-muted);
  border-radius: 10px;
}

.widget-button-info {
  flex: 1;
  min-width: 0;
}

.widget-button-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-default);
  margin-bottom: 4px;
}

.widget-button-meta {
  font-size: 12px;
  color: var(--color-text-dimmed);
}

.no-widgets {
  padding: 60px 20px;
  text-align: center;
}

.no-widgets-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-widgets-text {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.no-widgets-hint {
  font-size: 14px;
  color: var(--color-text-dimmed);
}

/* Sheet animation */
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease-out;
}

.sheet-enter-from .widget-toolbar,
.sheet-leave-to .widget-toolbar {
  transform: translateY(100%);
}

.sheet-enter-from .widget-toolbar-backdrop,
.sheet-leave-to .widget-toolbar-backdrop {
  opacity: 0;
}

/* Desktop enhancements */
@media (min-width: 769px) {
  .widget-toolbar {
    max-height: 70vh;
    border-radius: 16px;
    margin: 20px;
    max-width: 600px;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: var(--shadow-overlay);
  }

  .widget-button {
    padding: 20px 24px;
    min-height: 72px;
  }

  .widget-button:hover {
    transform: translateX(4px);
  }
}
</style>
