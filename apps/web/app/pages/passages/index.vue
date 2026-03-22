<script setup lang="ts">
import type { PassageDto } from '~/types/passage'
import { usePassageFormat } from '~/composables/usePassageFormat'
import PassagePlaybackWorkspace from '~/components/passages/playback/PassagePlaybackWorkspace.vue'

defineOptions({ inheritAttrs: false })
definePageMeta({ keepalive: true })

usePageSeo('Voyages', 'Sailing voyages from your vessel track history with maps and polylines.')

const {
  formatRange,
  durationDays,
  formatCoord,
  appleMapsUrl,
  passageRouteHeadline,
  passageCoordSubtext,
} = usePassageFormat()
const { selectedPassageId } = usePassageQuerySelection()

const { data: passages, error, pending, refresh } = await usePassagesList()
const appFetch = useAppFetch()

const selectedKey = computed(() => selectedPassageId.value ?? '')
const { data: selectedPassage } = await usePassageById(selectedKey)
const { places, placesPending, placesError } = usePassagePlaces(selectedPassageId)

const query = ref('')
const showStats = ref(false)

const filtered = computed(() => {
  const list = passages.value
  if (!list?.length) return []
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((p) => {
    const placesForRow = selectedPassageId.value === p.id ? places.value : null
    const hay = [
      p.title,
      p.positionSource,
      p.startPlaceLabel,
      p.endPlaceLabel,
      passageCoordSubtext(p),
      passageRouteHeadline(p, placesForRow),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const stats = computed(() => {
  const list = passages.value
  if (!list?.length) {
    return { count: 0, totalNm: 0, longest: null as PassageDto | null }
  }
  const totalNm = list.reduce((s, p) => s + p.distanceNm, 0)
  const longest = list.reduce((a, b) => (a.distanceNm >= b.distanceNm ? a : b))
  return { count: list.length, totalNm, longest }
})

function hoursBetween(startedAt: string, endedAt: string) {
  const startMs = Date.parse(startedAt)
  const endMs = Date.parse(endedAt)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0
  return (endMs - startMs) / 3_600_000
}

function normalizeStatPlaceLabel(label: string | null | undefined) {
  if (!label?.trim()) return null
  if (/\d+\.\d+°[NS]\s+\d+\.\d+°[EW]/.test(label)) return null
  return label.trim()
}

const passageStats = computed(() => {
  const list = passages.value ?? []
  if (!list.length) {
    return {
      totalHours: 0,
      averageNm: 0,
      shortest: null as PassageDto | null,
      topStarts: [] as Array<{ label: string; count: number }>,
      topEnds: [] as Array<{ label: string; count: number }>,
      byYear: [] as Array<{ year: string; count: number; nm: number }>,
    }
  }

  const shortest = list.reduce((a, b) => (a.distanceNm <= b.distanceNm ? a : b))
  const totalHours = list.reduce(
    (sum, passage) => sum + hoursBetween(passage.startedAt, passage.endedAt),
    0,
  )
  const averageNm = stats.value.totalNm / list.length

  const startCounts = new Map<string, number>()
  const endCounts = new Map<string, number>()
  const yearMap = new Map<string, { year: string; count: number; nm: number }>()

  for (const passage of list) {
    const startLabel = normalizeStatPlaceLabel(passage.startPlaceLabel)
    const endLabel = normalizeStatPlaceLabel(passage.endPlaceLabel)
    if (startLabel) startCounts.set(startLabel, (startCounts.get(startLabel) || 0) + 1)
    if (endLabel) endCounts.set(endLabel, (endCounts.get(endLabel) || 0) + 1)

    const year = passage.startedAt.slice(0, 4)
    const entry = yearMap.get(year) || { year, count: 0, nm: 0 }
    entry.count += 1
    entry.nm += passage.distanceNm
    yearMap.set(year, entry)
  }

  return {
    totalHours,
    averageNm,
    shortest,
    topStarts: Array.from(startCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 5),
    topEnds: Array.from(endCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 5),
    byYear: Array.from(yearMap.values())
      .sort((left, right) => right.year.localeCompare(left.year))
      .slice(0, 6),
  }
})

/** Latest voyage end date in the DB (seed file), for “how fresh is this data?” */
const seedNewestEndedLabel = computed(() => {
  const list = passages.value
  if (!list?.length) return null
  const newest = list.reduce((a, b) => (a.endedAt > b.endedAt ? a : b))
  return formatRange(newest.endedAt, newest.endedAt)
})

function sortByDistance(list: PassageDto[]) {
  return [...list].sort((a, b) => b.distanceNm - a.distanceNm)
}

const sortMode = ref<'date' | 'distance'>('date')

const displayed = computed(() => {
  const list = filtered.value
  return sortMode.value === 'distance' ? sortByDistance(list) : list
})

const mapPassages = computed(() => passages.value ?? [])

function rowRouteHeadline(p: PassageDto) {
  return passageRouteHeadline(p, selectedPassageId.value === p.id ? places.value : null)
}

function passageHasStoredLabels(p: PassageDto) {
  return Boolean(p.startPlaceLabel?.trim() && p.endPlaceLabel?.trim())
}

/**
 * Persist Apple place names for rows missing label columns (one batch per visit; re-open page to continue).
 */
async function runBackfillPassageLabels() {
  const list = passages.value
  if (!list?.length) return
  if (!list.some((p) => !passageHasStoredLabels(p))) return
  try {
    await appFetch('/api/passages/backfill-labels', { method: 'POST' })
    await refresh()
    if ((passages.value ?? []).some((p) => !passageHasStoredLabels(p))) {
      await appFetch('/api/passages/backfill-labels', { method: 'POST' })
      await refresh()
    }
  } catch {
    /* Missing MapKit creds or rate limit — list still shows coordinates */
  }
}

onMounted(() => {
  void runBackfillPassageLabels()
})

const toast = useToast()

function selectPassage(id: string | null) {
  selectedPassageId.value = id
}

function togglePassageList(id: string) {
  selectedPassageId.value = selectedPassageId.value === id ? null : id
}

async function copyEndpoint(label: string, lat: number, lon: number) {
  const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: 'Copied',
      description: `${label} coordinates on clipboard`,
      color: 'success',
    })
  } catch {
    toast.add({ title: 'Copy failed', description: 'Clipboard not available', color: 'error' })
  }
}

function placeLines(place: { formattedAddressLines: string[]; name: string | null } | null) {
  if (!place) return '—'
  if (place.formattedAddressLines?.length) return place.formattedAddressLines.join(', ')
  return place.name ?? '—'
}

function selectPassageFromStats(id: string) {
  selectPassage(id)
  showStats.value = false
}
</script>

<template>
  <div
    class="passages-page flex min-h-0 flex-1 flex-col pb-16 md:pb-0 h-[calc(100dvh-7rem)] md:h-[calc(100dvh-3.5rem)] md:min-h-[28rem]"
  >
    <div class="shrink-0 border-b border-default bg-default/95 px-3 py-2 sm:px-4">
      <div class="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <UIcon name="i-lucide-route" class="size-4" />
          </span>
          <h1
            class="font-display text-lg font-semibold leading-none tracking-tight text-default sm:text-xl"
          >
            Voyages
          </h1>
        </div>

        <div
          v-if="passages?.length"
          class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted sm:text-sm"
        >
          <span class="font-medium tabular-nums text-default">{{ stats.count }} trips</span>
          <span class="text-dimmed" aria-hidden="true">·</span>
          <span class="tabular-nums">
            <span class="font-medium text-default">{{ stats.totalNm.toFixed(0) }}</span>
            nm total
          </span>
          <template v-if="stats.longest">
            <span class="text-dimmed" aria-hidden="true">·</span>
            <UButton
              variant="link"
              color="primary"
              class="h-auto max-w-[10rem] truncate p-0 text-xs sm:max-w-none sm:text-sm"
              @click="selectPassage(stats.longest!.id)"
            >
              Longest {{ stats.longest.distanceNm.toFixed(0) }} nm
            </UButton>
          </template>
          <template v-if="seedNewestEndedLabel">
            <span class="text-dimmed" aria-hidden="true">·</span>
            <span class="text-dimmed" title="Latest ended_at in passages table (from seed)">
              Data through {{ seedNewestEndedLabel }}
            </span>
          </template>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-0.5">
          <UTooltip
            text="Tap the map or a trip row to open it; the row expands with departure and arrival. A blue line shows the track on the map."
            :delay-duration="0"
          >
            <UButton
              icon="i-lucide-info"
              variant="ghost"
              color="neutral"
              size="xs"
              class="hidden sm:inline-flex"
              aria-label="How voyages work"
            />
          </UTooltip>
          <UButton
            icon="i-lucide-chart-column-big"
            variant="soft"
            color="neutral"
            size="xs"
            @click="showStats = true"
          >
            <span class="hidden sm:inline">Stats</span>
          </UButton>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="soft"
            color="neutral"
            size="xs"
            :loading="pending"
            @click="() => refresh()"
          >
            <span class="hidden sm:inline">Refresh</span>
          </UButton>
        </div>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      title="Could not load voyages"
      :description="error.message || 'Unknown error'"
      class="mx-3 mt-2 shrink-0 sm:mx-4"
      icon="i-lucide-cloud-off"
    />

    <div v-else-if="pending" class="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:p-3">
      <USkeleton class="min-h-[200px] w-full rounded-xl md:min-h-0 md:flex-1" />
      <USkeleton class="h-36 w-full rounded-lg md:hidden" />
    </div>

    <div
      v-else-if="!passages?.length"
      class="mx-auto max-w-screen-xl flex-1 px-4 py-12 text-center sm:px-6"
    >
      <div class="rounded-2xl border border-dashed border-default bg-elevated/50 px-6 py-16">
        <UIcon name="i-lucide-inbox" class="mx-auto mb-4 size-14 text-dimmed" />
        <p class="font-medium text-default">No voyages yet</p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted">
          Run
          <UBadge color="neutral" variant="outline" class="mx-1 font-mono text-xs"
            >pnpm run db:ready</UBadge
          >
          locally, or regenerate from Influx with
          <UBadge color="neutral" variant="outline" class="mx-1 font-mono text-xs">
            pnpm run db:seed:passages-from-influx
          </UBadge>
          .
        </p>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-0 md:flex-row md:gap-0">
      <div
        class="order-2 flex min-h-0 w-full flex-col border-t border-default md:order-1 md:w-[min(18rem,31vw)] md:shrink-0 md:border-t-0 md:border-r"
      >
        <div class="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2 sm:p-2.5 md:pr-2">
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">Your trips</p>
            <p class="text-xs leading-snug text-muted">
              Tap a trip to expand departure and arrival; the map shows the track for the open row.
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <UInput
              v-model="query"
              icon="i-lucide-search"
              placeholder="Search title or source…"
              class="w-full sm:max-w-full"
              size="sm"
            />
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wide text-dimmed">Sort</span>
              <div
                class="inline-flex rounded-lg border border-default bg-muted/30 p-0.5"
                role="group"
                aria-label="Sort voyages"
              >
                <UButton
                  :color="sortMode === 'date' ? 'primary' : 'neutral'"
                  :variant="sortMode === 'date' ? 'solid' : 'ghost'"
                  size="xs"
                  @click="sortMode = 'date'"
                >
                  Newest
                </UButton>
                <UButton
                  :color="sortMode === 'distance' ? 'primary' : 'neutral'"
                  :variant="sortMode === 'distance' ? 'solid' : 'ghost'"
                  size="xs"
                  @click="sortMode = 'distance'"
                >
                  Distance
                </UButton>
              </div>
            </div>
          </div>

          <p v-if="query && !displayed.length" class="py-8 text-center text-sm text-muted">
            No voyages match “{{ query }}”.
          </p>

          <ul v-else class="flex flex-col gap-2.5">
            <li
              v-for="p in displayed"
              :key="p.id"
              class="overflow-hidden rounded-xl border border-default bg-default transition-shadow"
              :class="
                selectedPassageId === p.id
                  ? 'shadow-elevated ring-1 ring-primary/30'
                  : 'hover:bg-elevated/40'
              "
            >
              <UButton
                :color="selectedPassageId === p.id ? 'primary' : 'neutral'"
                :variant="selectedPassageId === p.id ? 'soft' : 'ghost'"
                :class="[
                  'h-auto w-full justify-start gap-3 border-0 px-3 py-3 text-left sm:px-3.5 sm:py-3.5',
                  selectedPassageId === p.id ? 'rounded-b-none rounded-t-xl' : 'rounded-xl',
                ]"
                @click="togglePassageList(p.id)"
              >
                <div class="min-w-0 flex-1 text-left">
                  <p
                    class="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-default sm:text-base"
                  >
                    {{ rowRouteHeadline(p) }}
                  </p>
                  <p
                    class="mt-1 break-all font-mono text-[10px] leading-relaxed text-dimmed sm:text-[11px]"
                  >
                    {{ passageCoordSubtext(p) }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>{{ formatRange(p.startedAt, p.endedAt) }}</span>
                    <span class="hidden text-dimmed sm:inline" aria-hidden="true">·</span>
                    <div class="flex flex-wrap gap-1.5">
                      <UBadge color="neutral" variant="subtle" size="xs" class="tabular-nums">
                        {{ durationDays(p.startedAt, p.endedAt) }} d
                      </UBadge>
                      <UBadge color="primary" variant="subtle" size="xs" class="tabular-nums">
                        {{ p.distanceNm.toFixed(0) }} nm
                      </UBadge>
                    </div>
                  </div>
                </div>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-5 shrink-0 text-dimmed transition-transform duration-200"
                  :class="selectedPassageId === p.id ? 'rotate-180 text-primary' : ''"
                />
              </UButton>

              <div
                v-if="selectedPassageId === p.id"
                class="space-y-2.5 border-t border-default bg-muted/25 px-3 py-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">Details</p>
                  <UButton size="xs" variant="ghost" color="neutral" @click="selectPassage(null)">
                    Collapse
                  </UButton>
                </div>

                <UAlert
                  v-if="placesError"
                  color="error"
                  variant="soft"
                  :title="placesError"
                  class="text-sm"
                  icon="i-lucide-map-pin-off"
                />

                <div v-if="placesPending" class="space-y-2">
                  <USkeleton class="h-4 w-full rounded-md" />
                  <USkeleton class="h-4 w-3/4 rounded-md" />
                </div>

                <template v-else-if="places">
                  <UAlert
                    v-if="places.error"
                    color="warning"
                    variant="soft"
                    title="Place names unavailable"
                    :description="places.error"
                    icon="i-lucide-info"
                  />

                  <div class="space-y-2.5">
                    <div class="rounded-lg border border-default bg-default/80 p-2.5">
                      <div class="flex items-center gap-2 text-dimmed">
                        <UIcon name="i-lucide-anchor" class="size-3.5 shrink-0" />
                        <p class="text-[11px] font-semibold uppercase tracking-wide">Departure</p>
                      </div>
                      <p class="mt-1.5 text-sm leading-snug text-default">
                        {{ placeLines(places.start) }}
                      </p>
                      <p class="mt-1 font-mono text-[11px] text-muted">
                        {{ formatCoord(p.startLat, p.startLon) }}
                      </p>
                      <div class="mt-2.5 flex flex-wrap gap-1.5">
                        <UButton
                          size="xs"
                          variant="soft"
                          color="neutral"
                          icon="i-lucide-copy"
                          @click="copyEndpoint('Start', p.startLat, p.startLon)"
                        >
                          Copy
                        </UButton>
                        <UButton
                          size="xs"
                          variant="soft"
                          color="neutral"
                          icon="i-lucide-external-link"
                          :to="appleMapsUrl(p.startLat, p.startLon, 'Start')"
                          target="_blank"
                        >
                          Maps
                        </UButton>
                      </div>
                    </div>

                    <div class="rounded-lg border border-default bg-default/80 p-2.5">
                      <div class="flex items-center gap-2 text-dimmed">
                        <UIcon name="i-lucide-flag" class="size-3.5 shrink-0" />
                        <p class="text-[11px] font-semibold uppercase tracking-wide">Arrival</p>
                      </div>
                      <p class="mt-1.5 text-sm leading-snug text-default">
                        {{ placeLines(places.end) }}
                      </p>
                      <p class="mt-1 font-mono text-[11px] text-muted">
                        {{ formatCoord(p.endLat, p.endLon) }}
                      </p>
                      <div class="mt-2.5 flex flex-wrap gap-1.5">
                        <UButton
                          size="xs"
                          variant="soft"
                          color="neutral"
                          icon="i-lucide-copy"
                          @click="copyEndpoint('End', p.endLat, p.endLon)"
                        >
                          Copy
                        </UButton>
                        <UButton
                          size="xs"
                          variant="soft"
                          color="neutral"
                          icon="i-lucide-external-link"
                          :to="appleMapsUrl(p.endLat, p.endLon, 'End')"
                          target="_blank"
                        >
                          Maps
                        </UButton>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="order-1 min-h-[min(52vh,420px)] shrink-0 md:order-2 md:min-h-0 md:flex-1 md:p-2 md:pl-1"
      >
        <PassagePlaybackWorkspace
          v-if="selectedPassageId"
          :passage-id="selectedPassageId"
          :passage="selectedPassage"
          :places="places"
          :places-pending="placesPending"
        />
        <PassagesMapExplorer
          v-else
          v-model:selected-id="selectedPassageId"
          :passages="mapPassages"
        />
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="showStats"
      class="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-4 py-10 backdrop-blur-sm"
      @click.self="showStats = false"
    >
      <div class="w-full max-w-3xl rounded-2xl border border-default bg-default shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-default px-5 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.28em] text-dimmed">
              Voyage Stats
            </p>
            <h2 class="mt-1 font-display text-2xl font-semibold text-default">
              The stuff everybody asks about
            </h2>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            aria-label="Close stats"
            @click="showStats = false"
          />
        </div>

        <div class="grid gap-4 px-5 py-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-xl border border-default bg-elevated/70 p-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                  Total Trips
                </p>
                <p class="mt-2 text-2xl font-semibold tabular-nums text-default">
                  {{ stats.count }}
                </p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/70 p-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                  Miles Sailed
                </p>
                <p class="mt-2 text-2xl font-semibold tabular-nums text-default">
                  {{ stats.totalNm.toFixed(0) }}
                </p>
                <p class="text-xs text-muted">nautical miles</p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/70 p-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                  Days Underway
                </p>
                <p class="mt-2 text-2xl font-semibold tabular-nums text-default">
                  {{ (passageStats.totalHours / 24).toFixed(1) }}
                </p>
              </div>
              <div class="rounded-xl border border-default bg-elevated/70 p-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                  Avg Passage
                </p>
                <p class="mt-2 text-2xl font-semibold tabular-nums text-default">
                  {{ passageStats.averageNm.toFixed(0) }}
                </p>
                <p class="text-xs text-muted">nm per trip</p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <UButton
                v-if="stats.longest"
                color="neutral"
                variant="ghost"
                class="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left transition hover:bg-primary/10"
                @click="selectPassageFromStats(stats.longest.id)"
              >
                <div class="min-w-0 text-left">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                    Longest Passage
                  </p>
                  <p class="mt-2 line-clamp-2 font-display text-xl font-semibold text-default">
                    {{ rowRouteHeadline(stats.longest) }}
                  </p>
                  <p class="mt-2 text-sm text-muted">
                    {{ stats.longest.distanceNm.toFixed(1) }} nm ·
                    {{ durationDays(stats.longest.startedAt, stats.longest.endedAt) }} days
                  </p>
                </div>
              </UButton>

              <UButton
                v-if="passageStats.shortest"
                color="neutral"
                variant="ghost"
                class="rounded-xl border border-default bg-elevated/70 p-4 text-left transition hover:bg-elevated"
                @click="selectPassageFromStats(passageStats.shortest.id)"
              >
                <div class="min-w-0 text-left">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                    Shortest Passage
                  </p>
                  <p class="mt-2 line-clamp-2 font-display text-xl font-semibold text-default">
                    {{ rowRouteHeadline(passageStats.shortest) }}
                  </p>
                  <p class="mt-2 text-sm text-muted">
                    {{ passageStats.shortest.distanceNm.toFixed(1) }} nm ·
                    {{
                      hoursBetween(
                        passageStats.shortest.startedAt,
                        passageStats.shortest.endedAt,
                      ).toFixed(1)
                    }}
                    hours
                  </p>
                </div>
              </UButton>
            </div>

            <div class="rounded-xl border border-default bg-elevated/40 p-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                By Year
              </p>
              <div class="mt-3 grid gap-2 sm:grid-cols-3">
                <div
                  v-for="year in passageStats.byYear"
                  :key="year.year"
                  class="rounded-lg border border-default bg-default/80 px-3 py-2"
                >
                  <p class="text-sm font-semibold text-default">{{ year.year }}</p>
                  <p class="mt-1 text-xs text-muted">
                    {{ year.count }} trips · {{ year.nm.toFixed(0) }} nm
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="rounded-xl border border-default bg-elevated/40 p-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                Frequent Departures
              </p>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="place in passageStats.topStarts"
                  :key="`start-${place.label}`"
                  class="flex items-center justify-between gap-3 rounded-lg border border-default bg-default/80 px-3 py-2"
                >
                  <span class="min-w-0 truncate text-sm text-default">{{ place.label }}</span>
                  <UBadge size="xs" variant="subtle" color="primary" class="tabular-nums">
                    {{ place.count }}
                  </UBadge>
                </li>
              </ul>
            </div>

            <div class="rounded-xl border border-default bg-elevated/40 p-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-dimmed">
                Frequent Arrivals
              </p>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="place in passageStats.topEnds"
                  :key="`end-${place.label}`"
                  class="flex items-center justify-between gap-3 rounded-lg border border-default bg-default/80 px-3 py-2"
                >
                  <span class="min-w-0 truncate text-sm text-default">{{ place.label }}</span>
                  <UBadge size="xs" variant="subtle" color="primary" class="tabular-nums">
                    {{ place.count }}
                  </UBadge>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
