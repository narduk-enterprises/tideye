<script setup lang="ts">
import '~/assets/css/switching.css'
import {
  switchPlotterIcon,
  switchPlotterIconAccent,
  switchPlotterShortLabel,
} from '~/utils/switchPlotter'

const props = defineProps<{
  id: string
  label: string
  state: 'on' | 'off' | 'unknown'
  writable: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', switchId: string): void
}>()

const plotterIcon = computed(() => switchPlotterIcon(props.id))
const plotterShort = computed(() => switchPlotterShortLabel(props.id, props.label))
const iconAccent = computed(() => switchPlotterIconAccent(props.id))

const stateTitle = computed(() => {
  if (!props.writable) return 'Read-only — reset path not available yet.'
  if (props.loading) return 'Sending command to the boat…'
  if (props.state === 'unknown') return 'Toggle once to learn live state from SignalK.'
  return props.state === 'on' ? 'Output is active.' : 'Output is idle.'
})

const toggleLabel = computed(() => {
  if (!props.writable) return `${props.label} is read-only`
  if (props.loading) return `Sending command for ${props.label}`
  return `${props.state === 'on' ? 'Turn off' : 'Turn on'} ${props.label}`
})

const padLegend = computed(() => {
  if (props.loading) return ''
  if (props.state === 'on') return 'ON'
  if (props.state === 'off') return 'OFF'
  return '· · ·'
})

const pictogramClass = computed(() => {
  if (iconAccent.value === 'red') return 'switch-plotter-pad__pictogram-icon--red'
  return ''
})
</script>

<template>
  <article
    class="switch-control switch-control--plotter"
    :class="{
      'switch-control--on': state === 'on',
      'switch-control--readonly': !writable,
      'switch-control--loading': loading,
      'switch-control--unknown': state === 'unknown',
    }"
    :title="stateTitle"
  >
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      class="switch-plotter-pad"
      :class="{
        'switch-plotter-pad--on': state === 'on',
        'switch-plotter-pad--off': state === 'off',
        'switch-plotter-pad--unknown': state === 'unknown',
      }"
      :disabled="!writable || loading"
      :aria-pressed="state === 'on'"
      :aria-busy="loading"
      :aria-label="toggleLabel"
      @click="emit('toggle', id)"
    >
      <span class="switch-plotter-pad__pictogram">
        <UIcon
          v-if="loading"
          name="i-lucide-loader-2"
          class="switch-plotter-pad__pictogram-icon switch-plotter-pad__pictogram-icon--spin"
        />
        <UIcon
          v-else
          :name="plotterIcon"
          class="switch-plotter-pad__pictogram-icon"
          :class="pictogramClass"
        />
      </span>
      <span class="switch-plotter-pad__led" aria-hidden="true" />
      <span class="switch-plotter-pad__state">{{ padLegend }}</span>
    </UButton>

    <div class="switch-plotter-rail">
      <span class="switch-plotter-rail__label">{{ plotterShort }}</span>
      <span
        v-if="!writable"
        class="switch-plotter-rail__lock"
        title="Read-only"
        aria-label="Read-only"
      >
        <UIcon name="i-lucide-lock" class="switch-plotter-rail__lock-icon" />
      </span>
      <span class="sr-only">{{ label }}</span>
    </div>
  </article>
</template>
