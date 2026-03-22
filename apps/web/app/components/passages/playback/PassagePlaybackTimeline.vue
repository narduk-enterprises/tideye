<!-- eslint-disable narduk/no-raw-tailwind-colors, narduk/no-native-button, narduk/no-tailwind-v3-deprecated -->
<script setup lang="ts">
import dayjs from 'dayjs'
import type { PlaybackEventMarker } from '~/composables/usePassagePlayback'

const props = defineProps<{
  startedMs: number
  endedMs: number
  currentMs: number
  timeMode: 'local' | 'utc' | 'elapsed'
  canRenderLocalTime?: boolean
  events: PlaybackEventMarker[]
  previewAt: (ms: number) => {
    timestamp: string
    speed: string
    coords: string
    event: string | null
  }
}>()

const emit = defineEmits<{
  seek: [ms: number]
}>()

const railRef = ref<HTMLElement | null>(null)
const hoverRatio = ref<number | null>(null)
const isDragging = ref(false)

const durationMs = computed(() => Math.max(1, props.endedMs - props.startedMs))
const currentRatio = computed(() =>
  Math.min(1, Math.max(0, (props.currentMs - props.startedMs) / durationMs.value)),
)
const positionedEvents = computed(() =>
  props.events.map((event) => ({
    ...event,
    ratio: Math.min(1, Math.max(0, (event.ms - props.startedMs) / durationMs.value)),
  })),
)

const hoverMs = computed(() => {
  if (hoverRatio.value == null) return null
  return props.startedMs + hoverRatio.value * durationMs.value
})

const hoverPreview = computed(() => {
  const ms = hoverMs.value
  return ms == null ? null : props.previewAt(ms)
})

function updateRatioFromPointer(clientX: number) {
  const rail = railRef.value
  if (!rail) return null
  const rect = rail.getBoundingClientRect()
  if (!rect.width) return null
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function seekFromClientX(clientX: number) {
  const ratio = updateRatioFromPointer(clientX)
  if (ratio == null) return
  hoverRatio.value = ratio
  emit('seek', props.startedMs + ratio * durationMs.value)
}

function onPointerDown(event: PointerEvent) {
  if (!import.meta.client) return
  isDragging.value = true
  seekFromClientX(event.clientX)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
}

function onWindowPointerMove(event: PointerEvent) {
  if (!isDragging.value) return
  seekFromClientX(event.clientX)
}

function onWindowPointerUp() {
  if (!import.meta.client) return
  isDragging.value = false
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
}

function onRailMove(event: PointerEvent) {
  const ratio = updateRatioFromPointer(event.clientX)
  hoverRatio.value = ratio
}

function clearHover() {
  if (isDragging.value) return
  hoverRatio.value = null
}

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
})

function formatBoundary(ms: number) {
  if (props.timeMode === 'elapsed') {
    return `${Math.max(0, Math.round((ms - props.startedMs) / 1000))}s`
  }
  if (props.timeMode === 'utc') {
    return dayjs.utc(ms).format('M/D/YYYY, h:mm:ss A [UTC]')
  }
  if (!props.canRenderLocalTime) {
    return dayjs.utc(ms).format('M/D/YYYY, h:mm:ss A')
  }
  return dayjs(ms).format('M/D/YYYY, h:mm:ss A')
}

function railPositionStyle(ratio: number) {
  return {
    left: `calc(12px + (100% - 24px) * ${ratio.toFixed(6)})`,
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
      <div class="flex items-center gap-2">
        <span class="font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline</span>
        <span>{{ formatBoundary(startedMs) }}</span>
      </div>
      <span>{{ formatBoundary(endedMs) }}</span>
    </div>

    <div class="relative">
      <div
        ref="railRef"
        class="relative h-14 cursor-pointer rounded-2xl border border-white/10 bg-slate-950/70 px-3"
        @pointerdown.prevent="onPointerDown"
        @pointermove="onRailMove"
        @pointerleave="clearHover"
      >
        <div class="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          class="absolute left-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-white"
          :style="{ width: `calc((100% - 24px) * ${currentRatio.toFixed(6)})` }"
        />

        <button
          v-for="event in positionedEvents"
          :key="event.id"
          type="button"
          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition hover:scale-110"
          :style="railPositionStyle(event.ratio)"
          :title="event.label"
          @click.stop="emit('seek', event.ms)"
        >
          <span
            class="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-amber-200/80"
          />
          <span
            class="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950 bg-amber-300 shadow-[0_0_0_4px_rgba(15,23,42,0.55)]"
          />
        </button>

        <div
          class="absolute top-1/2 size-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_0_6px_rgba(14,165,233,0.18)]"
          :style="railPositionStyle(currentRatio)"
        />

        <div
          v-if="hoverPreview && hoverRatio != null"
          class="pointer-events-none absolute bottom-full z-20 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/96 p-3 text-left text-xs text-slate-200 shadow-2xl backdrop-blur"
          :style="railPositionStyle(hoverRatio)"
        >
          <p class="font-semibold text-white">{{ hoverPreview.timestamp }}</p>
          <p class="mt-1 text-slate-300">{{ hoverPreview.speed }} · {{ hoverPreview.coords }}</p>
          <p v-if="hoverPreview.event" class="mt-2 text-amber-300">{{ hoverPreview.event }}</p>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
      <span
        v-for="event in events"
        :key="`${event.id}-chip`"
        class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1"
      >
        {{ event.shortLabel }}
      </span>
    </div>
  </div>
</template>
