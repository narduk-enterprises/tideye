<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSignalK } from '~/composables/useSignalK'
import type { SignalKDelta } from '~/types/signalk/signalk-types'

const { subscribeDelta, selfState } = useSignalK()

let unsubscribeDelta: (() => void) | null = null

function attachDeltaListener() {
  if (unsubscribeDelta) return
  unsubscribeDelta = subscribeDelta(handleDelta)
}

function detachDeltaListener() {
  unsubscribeDelta?.()
  unsubscribeDelta = null
}

interface PathData {
  path: string
  value: any
  timestamp: number
  updateCount: number
  meta?: any
  source?: string
}

const isVisible = ref(false)
const searchQuery = ref('')
const pathData = ref<Map<string, PathData>>(new Map())
const selectedPath = ref<string | null>(null)
const updateTimes = ref<Map<string, number>>(new Map())

const filteredPaths = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) {
    return Array.from(pathData.value.entries()).sort(([a], [b]) => a.localeCompare(b))
  }
  return Array.from(pathData.value.entries())
    .filter(([path]) => path.toLowerCase().includes(query))
    .sort(([a], [b]) => a.localeCompare(b))
})

const getValueDisplay = (value: any): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') {
    if (value.value !== undefined) {
      return String(value.value)
    }
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

const getValueType = (value: any): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') {
    if (value.value !== undefined) {
      return typeof value.value
    }
    return 'object'
  }
  return typeof value
}

const formatTimestamp = (timestamp: number): string => {
  const age = Date.now() - timestamp
  if (age < 1000) return 'just now'
  if (age < 60000) return `${Math.floor(age / 1000)}s ago`
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`
  return `${Math.floor(age / 3600000)}h ago`
}

const exportPaths = () => {
  const paths = Array.from(pathData.value.keys()).sort()
  const content = paths.join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `signalk-paths-${new Date().toISOString().split('T')[0]}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const exportJSON = () => {
  const data = Object.fromEntries(
    Array.from(pathData.value.entries()).map(([path, data]) => [
      path,
      {
        value: data.value,
        updateCount: data.updateCount,
        lastUpdate: new Date(data.timestamp).toISOString(),
        meta: data.meta,
        source: data.source,
      },
    ]),
  )
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `signalk-data-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleDelta = (delta: SignalKDelta) => {
  if (delta.updates)
    for (const update of delta.updates) {
      if (update.values)
        for (const { path, value } of update.values) {
          const now = Date.now()
          const existing = pathData.value.get(path)

          pathData.value.set(path, {
            path,
            value,
            timestamp: now,
            updateCount: (existing?.updateCount || 0) + 1,
            meta: existing?.meta,
            source: (update as any).$source || update.source?.label,
          })

          updateTimes.value.set(path, now)
        }

      if (update.meta)
        for (const { path, value } of update.meta) {
          const existing = pathData.value.get(path)
          if (existing) {
            existing.meta = value
            pathData.value.set(path, existing)
          }
        }
    }
}

const extractAllPaths = (obj: any, prefix = ''): string[] => {
  const paths: string[] = []
  if (obj === null || obj === undefined) return paths

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key

      if (value && typeof value === 'object' && 'value' in value) {
        paths.push(currentPath)
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...extractAllPaths(value, currentPath))
      } else {
        paths.push(currentPath)
      }
    }
  }

  return paths
}

const scanVesselData = () => {
  if (!selfState.value) return

  const paths = extractAllPaths(selfState.value)
  const now = Date.now()

  for (const path of paths) {
    const pathParts = path.split('.')
    let current: any = selfState.value

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        current = null
        break
      }
    }

    if (current !== null && current !== undefined) {
      const existing = pathData.value.get(path)
      pathData.value.set(path, {
        path,
        value: current,
        timestamp: existing?.timestamp || now,
        updateCount: existing?.updateCount || 0,
        meta: existing?.meta,
      })
    }
  }
}

watch(
  () => selfState.value,
  () => {
    if (isVisible.value) {
      scanVesselData()
    }
  },
  { deep: true },
)

watch(isVisible, (visible) => {
  if (visible) {
    scanVesselData()
    attachDeltaListener()
  } else {
    detachDeltaListener()
  }
})

onMounted(() => {
  if (isVisible.value) {
    attachDeltaListener()
  }
})

onUnmounted(() => {
  detachDeltaListener()
})

const toggle = () => {
  isVisible.value = !isVisible.value
}

defineExpose({
  toggle,
  isVisible: computed(() => isVisible.value),
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isVisible" class="inspector-overlay" @click.self="isVisible = false">
      <div class="inspector-panel" @click.stop>
        <div class="inspector-header">
          <h2>SignalK Data Inspector</h2>
          <div class="header-actions">
            <button @click="exportPaths" class="action-button" title="Export paths list">
              Export Paths
            </button>
            <button @click="exportJSON" class="action-button" title="Export JSON data">
              Export JSON
            </button>
            <button @click="isVisible = false" class="close-button" title="Close">✕</button>
          </div>
        </div>

        <div class="inspector-search">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search paths..."
            class="search-input"
          />
          <span class="path-count">{{ filteredPaths.length }} paths</span>
        </div>

        <div class="inspector-content">
          <div class="paths-list">
            <div
              v-for="[path, data] in filteredPaths"
              :key="path"
              class="path-item"
              :class="{ active: selectedPath === path }"
              @click="selectedPath = selectedPath === path ? null : path"
            >
              <div class="path-header">
                <span class="path-name">{{ path }}</span>
                <span class="path-badge">{{ data.updateCount }} updates</span>
              </div>
              <div class="path-preview">
                <span class="value-type">{{ getValueType(data.value) }}</span>
                <span class="value-preview">{{
                  getValueDisplay(data.value).substring(0, 50)
                }}</span>
                <span class="timestamp">{{ formatTimestamp(data.timestamp) }}</span>
              </div>

              <Transition name="expand">
                <div v-if="selectedPath === path" class="path-details">
                  <div class="detail-section">
                    <h4>Value</h4>
                    <pre class="value-display">{{ JSON.stringify(data.value, null, 2) }}</pre>
                  </div>
                  <div v-if="data.meta" class="detail-section">
                    <h4>Metadata</h4>
                    <pre class="meta-display">{{ JSON.stringify(data.meta, null, 2) }}</pre>
                  </div>
                  <div class="detail-section">
                    <h4>Info</h4>
                    <div class="info-grid">
                      <div class="info-item">
                        <span class="info-label">Type:</span>
                        <span class="info-value">{{ getValueType(data.value) }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">Updates:</span>
                        <span class="info-value">{{ data.updateCount }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">Last Update:</span>
                        <span class="info-value">{{ formatTimestamp(data.timestamp) }}</span>
                      </div>
                      <div v-if="data.source" class="info-item">
                        <span class="info-label">Source:</span>
                        <span class="info-value">{{ data.source }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.inspector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.inspector-panel {
  background: rgba(20, 20, 25, 0.98);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.inspector-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: rgba(255, 255, 255, 0.12);
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

.inspector-search {
  padding: 16px 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.path-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: var(--font-mono, monospace);
}

.inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.paths-list {
  padding: 8px;
}

.path-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.path-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.path-item.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(33, 150, 243, 0.5);
}

.path-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.path-name {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-all;
}

.path-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(33, 150, 243, 0.2);
  border-radius: 12px;
  color: rgba(33, 150, 243, 1);
  font-family: var(--font-mono, monospace);
}

.path-preview {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.value-type {
  font-family: var(--font-mono, monospace);
  color: rgba(76, 175, 80, 0.8);
  font-weight: 500;
}

.value-preview {
  flex: 1;
  font-family: var(--font-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.path-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value-display,
.meta-display {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 12px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  overflow-x: auto;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.info-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-mono, monospace);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

@media (max-width: 768px) {
  .inspector-panel {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .inspector-header {
    padding: 16px;
  }

  .inspector-header h2 {
    font-size: 18px;
  }

  .action-button {
    padding: 6px 12px;
    font-size: 12px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
