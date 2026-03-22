<script setup lang="ts">
import '~/assets/css/switching.css'

/**
 * Individual switch toggle control.
 * Shows icon, label, state indicator, and toggle button.
 * Read-only switches get a disabled toggle and "Read Only" badge.
 */
defineProps<{
  id: string
  label: string
  state: 'on' | 'off' | 'unknown'
  writable: boolean
  loading: boolean
  category: string
}>()

const emit = defineEmits<{
  (e: 'toggle', switchId: string): void
}>()
</script>

<template>
  <div
    class="switch-control"
    :class="{ 'switch-control--on': state === 'on', 'switch-control--readonly': !writable }"
  >
    <div class="switch-icon">
      <UIcon
        :name="category === 'pump' ? 'i-lucide-droplets' : 'i-lucide-lightbulb'"
        class="text-xl"
        :class="{
          'text-success': state === 'on',
          'text-dimmed': state === 'off',
          'text-warning': state === 'unknown',
        }"
      />
    </div>

    <div class="switch-info">
      <span class="switch-label">{{ label }}</span>
      <span
        class="switch-status"
        :class="{
          'text-success': state === 'on',
          'text-dimmed': state === 'off',
          'text-warning': state === 'unknown',
        }"
      >
        {{ state === 'on' ? 'ON' : state === 'off' ? 'OFF' : 'Unknown' }}
      </span>
    </div>

    <div class="switch-action">
      <UBadge v-if="!writable" label="Read Only" size="xs" color="warning" variant="subtle" />
      <UButton
        v-else
        :icon="loading ? 'i-lucide-loader-2' : 'i-lucide-toggle-right'"
        :label="loading ? '' : 'Toggle'"
        :variant="state === 'on' ? 'solid' : 'soft'"
        :color="state === 'on' ? 'primary' : 'neutral'"
        size="sm"
        :loading="loading"
        :disabled="loading"
        @click="emit('toggle', id)"
      />
    </div>
  </div>
</template>
