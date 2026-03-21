<script setup lang="ts">
// @ts-nocheck -- Ported from tideye-dashboard
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getNotificationsData } = useSignalKData()
const notificationsData = getNotificationsData()

const notifications = computed(() => {
  if (!notificationsData.value) return []

  const notifs: Array<{
    path: string
    message: string
    state: string
    method: string[]
  }> = []

  for (const [path, notification] of Object.entries(notificationsData.value)) {
    if (notification?.value) {
      notifs.push({
        path,
        message: notification.value.message ?? 'Unknown',
        state: notification.value.state ?? 'unknown',
        method: notification.value.method ?? [],
      })
    }
  }

  return notifs.sort((a, b) => {
    const stateOrder: Record<string, number> = { alarm: 0, alert: 1, warn: 2, normal: 3 }
    return (stateOrder[a.state] ?? 99) - (stateOrder[b.state] ?? 99)
  })
})

const getStateColor = (state: string): string => {
  const stateLower = state.toLowerCase()
  if (stateLower === 'alarm') return 'var(--color-danger)'
  if (stateLower === 'alert') return 'var(--color-warning)'
  if (stateLower === 'warn') return 'var(--color-warning)'
  return 'var(--color-text-secondary)'
}

const getStateIcon = (state: string): string => {
  const stateLower = state.toLowerCase()
  if (stateLower === 'alarm') return '🚨'
  if (stateLower === 'alert') return '⚠️'
  if (stateLower === 'warn') return '⚠️'
  return 'ℹ️'
}
</script>

<template>
  <WidgetContainer title="Notifications">
    <div class="notifications-display">
      <div v-if="notifications.length === 0" class="no-notifications">
        <span class="no-data-text">No notifications</span>
      </div>

      <div v-else class="notifications-list">
        <div
          v-for="(notif, index) in notifications"
          :key="notif.path"
          class="notification-item"
          :style="{ borderLeftColor: getStateColor(notif.state) }"
        >
          <div class="notification-header">
            <span class="notification-icon">{{ getStateIcon(notif.state) }}</span>
            <span class="notification-state" :style="{ color: getStateColor(notif.state) }">
              {{ notif.state.toUpperCase() }}
            </span>
          </div>

          <div class="notification-message">
            {{ notif.message }}
          </div>

          <div v-if="notif.method.length > 0" class="notification-methods">
            <span class="methods-label">Methods:</span>
            <span class="methods-value">{{ notif.method.join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.notifications-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}

.no-notifications {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.no-data-text {
  color: var(--color-text-tertiary);
  font-size: 0.875rem;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.notification-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-left: 4px solid;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-icon {
  font-size: 1.25rem;
}

.notification-state {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.notification-message {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.notification-methods {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.methods-label {
  font-weight: 600;
}

.methods-value {
  font-family: var(--font-mono, monospace);
}
</style>
