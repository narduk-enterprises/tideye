<!-- eslint-disable narduk/no-raw-tailwind-colors, narduk/no-native-button -->
<script setup lang="ts">
import {
  type PlaybackCameraMode,
  type PlaybackTimeMode,
  type PlaybackTrafficMode,
  usePassagePlaybackBundle,
  usePassagePlaybackController,
} from '~/composables/usePassagePlayback'
import { usePassageFormat } from '~/composables/usePassageFormat'
import type { PassageDto, PassagePlacesResponse } from '~/types/passage'
import PassagePlaybackMap from '~/components/passages/playback/PassagePlaybackMap.client.vue'
import PassagePlaybackTimeline from '~/components/passages/playback/PassagePlaybackTimeline.vue'

const props = defineProps<{
  passageId: string | null
  passage: PassageDto | null | undefined
  places: PassagePlacesResponse | null | undefined
  placesPending?: boolean
}>()

defineOptions({ inheritAttrs: false })

const { formatRange } = usePassageFormat()
const passageIdRef = toRef(props, 'passageId')
const { data: bundle, pending, error } = await usePassagePlaybackBundle(passageIdRef)

const controller = usePassagePlaybackController(bundle)
const cameraModes: PlaybackCameraMode[] = ['fit', 'follow', 'lead']
const timeModes: PlaybackTimeMode[] = ['local', 'utc', 'elapsed']
const trafficModes: PlaybackTrafficMode[] = ['closest', 'all', 'large', 'hide']

const routeHeadline = computed(() => {
  const passage = props.passage
  if (!passage) return 'Voyage playback'
  const left = props.places?.start?.name || passage.startPlaceLabel || 'Departure'
  const right = props.places?.end?.name || passage.endPlaceLabel || 'Arrival'
  return `${left} → ${right}`
})

const environmentCards = computed(() => {
  const metrics = controller.currentMetrics.value
  if (!metrics) return []

  const cards: Array<{ label: string; value: string } | null> = [
    metrics.depth != null ? { label: 'Depth', value: `${metrics.depth.toFixed(1)} m` } : null,
    metrics.waterTempC != null
      ? { label: 'Water', value: `${metrics.waterTempC.toFixed(1)}°C` }
      : null,
    metrics.airTempC != null ? { label: 'Air', value: `${metrics.airTempC.toFixed(1)}°C` } : null,
    metrics.windAppSpeedKts != null
      ? {
          label: 'AWS / AWA',
          value: `${metrics.windAppSpeedKts.toFixed(1)} kts · ${metrics.windAppAngleDeg?.toFixed(0) ?? '—'}°`,
        }
      : null,
    metrics.windTrueSpeedKts != null
      ? {
          label: 'TWS / TWD',
          value: `${metrics.windTrueSpeedKts.toFixed(1)} kts · ${metrics.windTrueDirectionDeg?.toFixed(0) ?? '—'}°`,
        }
      : null,
    metrics.portRpm != null || metrics.starboardRpm != null
      ? {
          label: 'Engines',
          value: `${metrics.portRpm?.toFixed(0) ?? '—'} / ${metrics.starboardRpm?.toFixed(0) ?? '—'} rpm`,
        }
      : null,
    metrics.barometerHpa != null
      ? { label: 'Barometer', value: `${metrics.barometerHpa.toFixed(0)} hPa` }
      : null,
  ]

  return cards.filter((card): card is { label: string; value: string } => Boolean(card))
})

const selectedTrafficTitle = computed(() => {
  const traffic = controller.selectedTraffic.value
  if (!traffic) return null
  return traffic.label || `MMSI ${traffic.mmsi ?? traffic.id}`
})

const selectedTrafficMeta = computed(() => {
  const traffic = controller.selectedTraffic.value
  const profile = controller.selectedTrafficProfile.value
  if (!traffic) return null

  const details = [
    traffic.sog != null ? `${traffic.sog.toFixed(1)} kts` : null,
    traffic.heading != null ? `${traffic.heading.toFixed(0)}°` : null,
    profile?.lengthM != null ? `${profile.lengthM.toFixed(0)} m` : null,
  ].filter((value): value is string => Boolean(value))

  return {
    shipType: profile?.shipTypeName || 'Traffic contact',
    details: details.join(' · '),
    mmsi: profile?.mmsi || traffic.mmsi || null,
  }
})

const playbackMetrics = computed(() => controller.currentMetrics.value)

const mapHudCards = computed(() => {
  const metrics = playbackMetrics.value
  if (!metrics) return []

  return [
    { label: 'SOG', value: metrics.sog != null ? `${metrics.sog.toFixed(1)} kts` : '—' },
    { label: 'COG', value: metrics.cog != null ? `${metrics.cog.toFixed(0)}°` : '—' },
    { label: 'Heading', value: metrics.heading != null ? `${metrics.heading.toFixed(0)}°` : '—' },
    { label: 'Remain', value: `${metrics.distanceRemainingNm.toFixed(1)} nm` },
  ]
})
</script>

<template>
  <div class="min-h-0">
    <div
      v-if="!passageId"
      class="flex h-full min-h-[24rem] items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,248,251,0.92))] px-6 text-center"
    >
      <div class="max-w-md space-y-3">
        <UIcon name="i-lucide-waves" class="mx-auto size-12 text-cyan-500/75" />
        <p class="font-display text-2xl font-semibold text-slate-950">Voyage playback</p>
        <p class="text-sm leading-6 text-slate-600">
          Select a passage from the rail to load its track, telemetry, and nearby traffic into the
          playback engine.
        </p>
      </div>
    </div>

    <div
      v-else-if="pending"
      class="grid h-full min-h-[24rem] gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <USkeleton class="h-[46dvh] min-h-[24rem] rounded-[1.75rem]" />
      <div class="space-y-3">
        <USkeleton class="h-28 rounded-[1.5rem]" />
        <USkeleton class="h-80 rounded-[1.5rem]" />
      </div>
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Playback bundle unavailable"
      :description="error.message || 'Could not load passage playback data.'"
      icon="i-lucide-cloud-off"
      class="rounded-[1.5rem]"
    />

    <div v-else-if="bundle" class="flex min-h-0 flex-1 flex-col gap-2">
      <div
        class="rounded-[1rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.08),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(145deg,_rgba(255,255,255,0.98),_rgba(239,248,251,0.96))] px-4 py-2.5 text-slate-950 shadow-[0_8px_24px_rgba(148,163,184,0.12)]"
      >
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="min-w-0">
            <div
              class="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-sky-700/80"
            >
              <span>Voyage Playback</span>
              <UBadge
                :label="bundle.source === 'generated-bundle' ? 'Full export' : 'Compact preview'"
                color="neutral"
                variant="subtle"
                size="xs"
              />
              <UBadge
                v-if="placesPending"
                label="Resolving places"
                color="warning"
                variant="subtle"
                size="xs"
              />
            </div>
            <div class="min-w-0">
              <h2
                class="truncate font-display text-[1.5rem] font-semibold leading-none tracking-tight sm:text-[1.7rem]"
              >
                {{ routeHeadline }}
              </h2>
              <p class="mt-0.5 text-sm text-slate-600 sm:text-[0.95rem]">
                {{ formatRange(bundle.startedAt, bundle.endedAt) }}
                <span class="mx-2 text-slate-400">·</span>
                {{ bundle.summary.distanceNm.toFixed(1) }} nm
                <span class="mx-2 text-slate-400">·</span>
                {{ bundle.summary.durationHours.toFixed(1) }} h
              </p>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-1.5">
            <div class="rounded-full border border-slate-200 bg-white/80 p-0.5 shadow-sm">
              <UButton
                v-for="option in cameraModes"
                :key="option"
                :color="controller.cameraMode.value === option ? 'primary' : 'neutral'"
                :variant="controller.cameraMode.value === option ? 'solid' : 'ghost'"
                size="xs"
                class="capitalize"
                @click="controller.cameraMode.value = option"
              >
                {{ option }}
              </UButton>
            </div>
            <div class="rounded-full border border-slate-200 bg-white/80 p-0.5 shadow-sm">
              <UButton
                v-for="mode in timeModes"
                :key="mode"
                :color="controller.timeMode.value === mode ? 'primary' : 'neutral'"
                :variant="controller.timeMode.value === mode ? 'solid' : 'ghost'"
                size="xs"
                class="uppercase"
                @click="controller.timeMode.value = mode"
              >
                {{ mode }}
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="relative min-h-0">
          <PassagePlaybackMap
            :route-coordinates="controller.fullTrackCoordinates.value"
            :completed-coordinates="controller.completedTrackCoordinates.value"
            :wake-coordinates="controller.wakeTrailCoordinates.value"
            :self-vessel="controller.selfMarker.value"
            :traffic-vessels="controller.visibleTraffic.value"
            :selected-traffic-id="controller.selectedTrafficId.value"
            :camera-mode="controller.cameraMode.value"
            :current-event="controller.activeEvent.value"
            @traffic-select="controller.selectedTrafficId.value = $event"
          />

          <div
            class="pointer-events-none absolute right-4 top-4 z-30 hidden w-[16.75rem] max-w-[calc(100%-2rem)] xl:block"
          >
            <div
              class="rounded-[1.2rem] border border-white/80 bg-white/86 px-3.5 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.1)] backdrop-blur"
            >
              <div class="flex items-start justify-between gap-2.5">
                <div class="min-w-0">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700/80">
                    Playback clock
                  </p>
                  <p class="mt-1 truncate font-display text-[1.05rem] font-semibold text-slate-950">
                    {{ playbackMetrics?.timestampLabel || '—' }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Elapsed
                  </p>
                  <p class="mt-1 text-sm font-medium text-slate-800">
                    {{ playbackMetrics?.elapsedLabel || '—' }}
                  </p>
                  <p class="text-[11px] text-sky-600">
                    {{ controller.speedMultiplier.value.toFixed(1) }}x data time
                  </p>
                </div>
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2">
                <div
                  v-for="card in mapHudCards"
                  :key="card.label"
                  class="rounded-xl border border-white/80 bg-white/74 px-3 py-2.5 shadow-sm"
                >
                  <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {{ card.label }}
                  </p>
                  <p class="mt-1 text-[0.95rem] font-semibold text-slate-950">{{ card.value }}</p>
                </div>
              </div>

              <div class="mt-3 border-t border-slate-200/70 pt-3">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-semibold uppercase tracking-[0.18em] text-slate-500">Avg</span>
                  <span class="font-medium text-slate-900">
                    {{
                      playbackMetrics?.avgSogSoFar != null
                        ? `${playbackMetrics.avgSogSoFar.toFixed(1)} kts`
                        : '—'
                    }}
                  </span>
                  <span class="font-semibold uppercase tracking-[0.18em] text-slate-500">Max</span>
                  <span class="font-medium text-slate-900">
                    {{
                      playbackMetrics?.maxSogSoFar != null
                        ? `${playbackMetrics.maxSogSoFar.toFixed(1)} kts`
                        : '—'
                    }}
                  </span>
                </div>
              </div>

              <div class="mt-3 space-y-2.5 border-t border-slate-200/70 pt-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Traffic
                    </p>
                    <p class="mt-1 text-sm text-slate-800">
                      {{ controller.visibleTraffic.value.length }} visible ·
                      {{ controller.allTrafficPositions.value.length }} active
                    </p>
                  </div>
                  <div
                    class="pointer-events-auto rounded-full border border-white/80 bg-white/78 p-0.5 shadow-sm"
                  >
                    <UButton
                      v-for="mode in trafficModes"
                      :key="mode"
                      :color="controller.trafficMode.value === mode ? 'primary' : 'neutral'"
                      :variant="controller.trafficMode.value === mode ? 'solid' : 'ghost'"
                      size="xs"
                      class="capitalize"
                      @click="controller.trafficMode.value = mode"
                    >
                      {{ mode }}
                    </UButton>
                  </div>
                </div>

                <div
                  v-if="selectedTrafficTitle && selectedTrafficMeta"
                  class="rounded-xl border border-white/80 bg-white/72 px-3 py-2.5"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-slate-950">
                        {{ selectedTrafficTitle }}
                      </p>
                      <p class="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {{ selectedTrafficMeta.shipType }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="pointer-events-auto rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      @click="controller.selectedTrafficId.value = null"
                    >
                      <UIcon name="i-lucide-x" class="size-3.5" />
                    </button>
                  </div>
                  <p v-if="selectedTrafficMeta.details" class="mt-1 text-xs text-slate-700">
                    {{ selectedTrafficMeta.details }}
                  </p>
                  <p v-if="selectedTrafficMeta.mmsi" class="mt-0.5 text-[11px] text-slate-500">
                    MMSI {{ selectedTrafficMeta.mmsi }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="environmentCards.length || playbackMetrics?.coordLabel"
            class="pointer-events-none absolute bottom-4 left-4 z-30 hidden max-w-[32rem] xl:block"
          >
            <div class="flex max-w-[30rem] flex-wrap gap-2">
              <div
                v-for="card in environmentCards.slice(0, 4)"
                :key="card.label"
                class="flex w-[12.25rem] items-center justify-between rounded-full border border-white/78 bg-white/80 px-3 py-1.5 text-[11px] shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                <span class="truncate pr-2 font-medium text-slate-500">{{ card.label }}</span>
                <span class="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-950">
                  {{ card.value }}
                </span>
              </div>
              <div
                v-if="playbackMetrics?.coordLabel"
                class="w-[14rem] rounded-full border border-white/78 bg-white/80 px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                {{ playbackMetrics.coordLabel }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="rounded-[1rem] border border-slate-200/80 bg-white/92 p-2.5 text-slate-950 shadow-sm"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              icon="i-lucide-skip-back"
              variant="soft"
              color="neutral"
              @click="controller.skipToStart()"
            />
            <UButton
              icon="i-lucide-rewind"
              variant="soft"
              color="neutral"
              @click="controller.seekBySeconds(-10)"
            />
            <UButton
              :icon="controller.isPlaying.value ? 'i-lucide-pause' : 'i-lucide-play'"
              color="primary"
              @click="controller.togglePlayback()"
            >
              {{ controller.isPlaying.value ? 'Pause' : 'Play' }}
            </UButton>
            <UButton
              icon="i-lucide-fast-forward"
              variant="soft"
              color="neutral"
              @click="controller.seekBySeconds(10)"
            />
            <UButton
              icon="i-lucide-skip-forward"
              variant="soft"
              color="neutral"
              @click="controller.skipToEnd()"
            />
            <UButton
              icon="i-lucide-rotate-ccw"
              variant="ghost"
              color="neutral"
              @click="controller.resetPlayback()"
            >
              Reset
            </UButton>

            <div class="ml-auto flex flex-wrap gap-0.5">
              <UButton
                v-for="option in controller.speedOptions"
                :key="option.id"
                :color="controller.speedId.value === option.id ? 'primary' : 'neutral'"
                :variant="controller.speedId.value === option.id ? 'solid' : 'ghost'"
                size="xs"
                @click="controller.speedId.value = option.id"
              >
                {{ option.label }}
              </UButton>
            </div>
          </div>

          <div class="mt-2.5">
            <PassagePlaybackTimeline
              :started-ms="controller.startedMs.value"
              :ended-ms="controller.endedMs.value"
              :current-ms="controller.playheadMs.value"
              :time-mode="controller.timeMode.value"
              :can-render-local-time="controller.canRenderLocalTime.value"
              :events="controller.eventMarkers.value"
              :preview-at="controller.previewAtMs"
              @seek="controller.seekToMs($event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
