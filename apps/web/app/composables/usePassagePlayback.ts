import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { formatDuration, formatMediaTime } from '~/utils/timeFormatting'
import type {
  PassagePlaybackBundle,
  PassagePlaybackSelfSample,
  PassagePlaybackTrafficVessel,
} from '~/types/passagePlayback'

dayjs.extend(utc)

export type PlaybackTimeMode = 'local' | 'utc' | 'elapsed'
export type PlaybackCameraMode = 'fit' | 'follow' | 'lead'
export type PlaybackTrafficMode = 'closest' | 'all' | 'large' | 'hide'

export interface PlaybackSpeedOption {
  id: string
  label: string
  kind: 'rate' | 'fit'
  multiplier?: number
  targetSeconds?: number
}

export interface PlaybackEventMarker {
  id: string
  kind: 'departure' | 'arrival' | 'peak-speed' | 'course-change' | 'overnight' | 'traffic'
  label: string
  shortLabel: string
  t: string
  ms: number
}

export interface PlaybackMapVessel {
  id: string
  kind: 'self' | 'traffic'
  label: string | null
  lat: number
  lng: number
  heading: number | null
  sog: number | null
  shipTypeId?: number | null
  shipTypeName?: string | null
  lengthM?: number | null
  mmsi?: string | null
}

interface PreparedSelfSample extends PassagePlaybackSelfSample {
  ms: number
  cumulativeDistanceNm: number
  prefixMaxSog: number | null
  prefixSogSum: number
  prefixSogCount: number
}

interface PreparedTrafficSample {
  t: string
  ms: number
  lat: number
  lon: number
  sog: number | null
  cog: number | null
  hdg: number | null
}

interface PreparedTrafficVessel extends PassagePlaybackTrafficVessel {
  samples: PreparedTrafficSample[]
}

const PLAYBACK_SPEED_OPTIONS: PlaybackSpeedOption[] = [
  { id: '1x', label: '1x', kind: 'rate', multiplier: 1 },
  { id: '2x', label: '2x', kind: 'rate', multiplier: 2 },
  { id: '5x', label: '5x', kind: 'rate', multiplier: 5 },
  { id: '10x', label: '10x', kind: 'rate', multiplier: 10 },
  { id: '30x', label: '30x', kind: 'rate', multiplier: 30 },
  { id: '60x', label: '60x', kind: 'rate', multiplier: 60 },
  { id: '300x', label: '300x', kind: 'rate', multiplier: 300 },
  { id: '1000x', label: '1000x', kind: 'rate', multiplier: 1000 },
  { id: 'fit-30s', label: '30s', kind: 'fit', targetSeconds: 30 },
  { id: 'fit-60s', label: '60s', kind: 'fit', targetSeconds: 60 },
  { id: 'fit-5m', label: '5m', kind: 'fit', targetSeconds: 60 * 5 },
]

const FRAME_COMMIT_MS = 1000 / 24

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065
  const toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function shortestAngleDelta(start: number, end: number) {
  const delta = ((end - start + 540) % 360) - 180
  return delta
}

function interpolateHeading(start: number | null, end: number | null, amount: number) {
  if (start == null && end == null) return null
  if (start == null) return end
  if (end == null) return start
  return normalizeDegrees(start + shortestAngleDelta(start, end) * amount)
}

function formatCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`
}

function differenceDegrees(left: number | null, right: number | null) {
  if (left == null || right == null) return 0
  return Math.abs(shortestAngleDelta(left, right))
}

function parseWindowMs(windowValue: string | null | undefined, fallbackMs: number) {
  if (!windowValue) return fallbackMs
  const match = windowValue.trim().match(/^(\d+)(ms|[smh])$/i)
  if (!match) return fallbackMs
  const count = Number(match[1])
  const unit = match[2]?.toLowerCase()
  if (!unit) return fallbackMs
  if (!Number.isFinite(count)) return fallbackMs
  if (unit === 'ms') return count
  if (unit === 's') return count * 1000
  if (unit === 'm') return count * 60_000
  if (unit === 'h') return count * 3_600_000
  return fallbackMs
}

function findFloorIndexByMs<T extends { ms: number }>(rows: T[], ms: number) {
  let low = 0
  let high = rows.length - 1
  let best = 0

  while (low <= high) {
    const mid = (low + high) >> 1
    if (rows[mid]!.ms <= ms) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return best
}

function findNearestIndexByMs<T extends { ms: number }>(rows: T[], ms: number) {
  if (!rows.length) return -1
  const floor = findFloorIndexByMs(rows, ms)
  const current = rows[floor]!
  const next = rows[floor + 1]
  if (!next) return floor
  return Math.abs(current.ms - ms) <= Math.abs(next.ms - ms) ? floor : floor + 1
}

function findWindowStartIndexByMs<T extends { ms: number }>(rows: T[], minMs: number) {
  let low = 0
  let high = rows.length - 1
  let best = rows.length

  while (low <= high) {
    const mid = (low + high) >> 1
    if (rows[mid]!.ms >= minMs) {
      best = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return best === rows.length ? Math.max(0, rows.length - 1) : best
}

function evenDecimate<T>(rows: T[], maxPoints: number) {
  if (rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  const out: T[] = []
  for (let index = 0; index < rows.length; index += step) {
    out.push(rows[index]!)
  }
  const last = rows.at(-1)
  if (last !== undefined && out.at(-1) !== last) out.push(last)
  return out
}

function prepareSelfSamples(samples: PassagePlaybackSelfSample[]) {
  const prepared: PreparedSelfSample[] = []
  let cumulativeDistanceNm = 0
  let prefixMaxSog: number | null = null
  let prefixSogSum = 0
  let prefixSogCount = 0

  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index]!
    const ms = Date.parse(sample.t)
    if (!Number.isFinite(ms)) continue

    if (prepared.length) {
      const previous = prepared[prepared.length - 1]!
      cumulativeDistanceNm += haversineNm(previous.lat, previous.lon, sample.lat, sample.lon)
    }

    if (sample.sog != null) {
      prefixSogSum += sample.sog
      prefixSogCount += 1
      prefixMaxSog = prefixMaxSog == null ? sample.sog : Math.max(prefixMaxSog, sample.sog)
    }

    prepared.push({
      ...sample,
      ms,
      cumulativeDistanceNm,
      prefixMaxSog,
      prefixSogSum,
      prefixSogCount,
    })
  }

  return prepared
}

function prepareTrafficVessels(vessels: PassagePlaybackTrafficVessel[]) {
  return vessels
    .map<PreparedTrafficVessel>((vessel) => ({
      ...vessel,
      samples: vessel.samples
        .map((sample) => ({
          ...sample,
          ms: Date.parse(sample.t),
        }))
        .filter((sample) => Number.isFinite(sample.ms))
        .sort((left, right) => left.ms - right.ms),
    }))
    .filter((vessel) => vessel.samples.length > 0)
}

function buildPlaybackEvents(
  samples: PreparedSelfSample[],
  traffic: PreparedTrafficVessel[],
): PlaybackEventMarker[] {
  if (!samples.length) return []

  const events: PlaybackEventMarker[] = [
    {
      id: 'departure',
      kind: 'departure',
      label: 'Departure',
      shortLabel: 'Cast off',
      t: samples[0]!.t,
      ms: samples[0]!.ms,
    },
  ]

  let peak = samples[0]!
  for (const sample of samples) {
    if ((sample.sog ?? -1) > (peak.sog ?? -1)) {
      peak = sample
    }
  }

  if (peak !== samples[0] && peak !== samples[samples.length - 1]) {
    events.push({
      id: 'peak-speed',
      kind: 'peak-speed',
      label: peak.sog != null ? `Peak speed ${peak.sog.toFixed(1)} kts` : 'Peak speed',
      shortLabel: 'Peak speed',
      t: peak.t,
      ms: peak.ms,
    })
  }

  let courseEventMs = -Infinity
  for (let index = 10; index < samples.length; index += 6) {
    const current = samples[index]!
    const previous = samples[Math.max(0, index - 8)]!
    if ((current.sog ?? 0) < 2 || (previous.sog ?? 0) < 2) continue
    if (current.ms - courseEventMs < 90 * 60_000) continue
    const currentHeading = current.headingTrue ?? current.cog ?? null
    const previousHeading = previous.headingTrue ?? previous.cog ?? null
    if (differenceDegrees(currentHeading, previousHeading) < 38) continue

    events.push({
      id: `course-${current.ms}`,
      kind: 'course-change',
      label: 'Major course change',
      shortLabel: 'Turn',
      t: current.t,
      ms: current.ms,
    })
    courseEventMs = current.ms
  }

  let nightCount = 0
  let lastDateKey = new Date(samples[0]!.ms).toISOString().slice(0, 10)
  for (const sample of samples) {
    const dateKey = new Date(sample.ms).toISOString().slice(0, 10)
    if (dateKey === lastDateKey) continue
    lastDateKey = dateKey
    nightCount += 1
    events.push({
      id: `overnight-${sample.ms}`,
      kind: 'overnight',
      label: `Night ${nightCount} underway`,
      shortLabel: `Night ${nightCount}`,
      t: sample.t,
      ms: sample.ms,
    })
  }

  let closestTraffic: {
    vessel: PreparedTrafficVessel
    sample: PreparedTrafficSample
    distanceNm: number
  } | null = null

  for (const vessel of traffic) {
    for (let index = 0; index < vessel.samples.length; index += 3) {
      const sample = vessel.samples[index]!
      const ownIndex = findNearestIndexByMs(samples, sample.ms)
      if (ownIndex < 0) continue
      const own = samples[ownIndex]!
      const distanceNm = haversineNm(own.lat, own.lon, sample.lat, sample.lon)
      if (!closestTraffic || distanceNm < closestTraffic.distanceNm) {
        closestTraffic = { vessel, sample, distanceNm }
      }
    }
  }

  if (closestTraffic && closestTraffic.distanceNm <= 8) {
    const vesselName =
      closestTraffic.vessel.profile.name ||
      closestTraffic.vessel.profile.shipTypeName ||
      `MMSI ${closestTraffic.vessel.profile.mmsi}`

    events.push({
      id: 'closest-traffic',
      kind: 'traffic',
      label: `Closest traffic: ${vesselName}`,
      shortLabel: `${closestTraffic.distanceNm.toFixed(1)} nm`,
      t: closestTraffic.sample.t,
      ms: closestTraffic.sample.ms,
    })
  }

  events.push({
    id: 'arrival',
    kind: 'arrival',
    label: 'Arrival',
    shortLabel: 'Landfall',
    t: samples[samples.length - 1]!.t,
    ms: samples[samples.length - 1]!.ms,
  })

  return events.sort((left, right) => left.ms - right.ms)
}

function interpolateSelfPosition(samples: PreparedSelfSample[], ms: number) {
  if (!samples.length) return null
  const floor = findFloorIndexByMs(samples, ms)
  const start = samples[floor]!
  const end = samples[Math.min(samples.length - 1, floor + 1)]!
  if (start.ms === end.ms) {
    return {
      lat: start.lat,
      lng: start.lon,
      heading: start.headingTrue ?? start.cog ?? null,
      sog: start.sog,
      progressDistanceNm: start.cumulativeDistanceNm,
    }
  }

  const amount = clamp((ms - start.ms) / (end.ms - start.ms), 0, 1)
  return {
    lat: lerp(start.lat, end.lat, amount),
    lng: lerp(start.lon, end.lon, amount),
    heading: interpolateHeading(
      start.headingTrue ?? start.cog ?? null,
      end.headingTrue ?? end.cog ?? null,
      amount,
    ),
    sog:
      start.sog == null && end.sog == null
        ? null
        : lerp(start.sog ?? end.sog ?? 0, end.sog ?? start.sog ?? 0, amount),
    progressDistanceNm: lerp(start.cumulativeDistanceNm, end.cumulativeDistanceNm, amount),
  }
}

function interpolateTrafficPosition(
  vessel: PreparedTrafficVessel,
  ms: number,
  toleranceMs: number,
): PlaybackMapVessel | null {
  if (!vessel.samples.length) return null
  const nearestIndex = findNearestIndexByMs(vessel.samples, ms)
  if (nearestIndex < 0) return null
  const nearest = vessel.samples[nearestIndex]!
  if (Math.abs(nearest.ms - ms) > toleranceMs) return null

  const floor = findFloorIndexByMs(vessel.samples, ms)
  const start = vessel.samples[floor]!
  const end = vessel.samples[Math.min(vessel.samples.length - 1, floor + 1)]!
  const amount = start.ms === end.ms ? 0 : clamp((ms - start.ms) / (end.ms - start.ms), 0, 1)

  return {
    id: vessel.profile.mmsi,
    kind: 'traffic',
    label: vessel.profile.name || vessel.profile.shipTypeName || `MMSI ${vessel.profile.mmsi}`,
    lat: lerp(start.lat, end.lat, amount),
    lng: lerp(start.lon, end.lon, amount),
    heading: interpolateHeading(start.hdg ?? start.cog ?? null, end.hdg ?? end.cog ?? null, amount),
    sog:
      start.sog == null && end.sog == null
        ? null
        : lerp(start.sog ?? end.sog ?? 0, end.sog ?? start.sog ?? 0, amount),
    shipTypeId: vessel.profile.shipTypeId,
    shipTypeName: vessel.profile.shipTypeName,
    lengthM: vessel.profile.lengthM,
    mmsi: vessel.profile.mmsi,
  }
}

function formatAbsoluteTime(
  ms: number,
  mode: Exclude<PlaybackTimeMode, 'elapsed'>,
  allowBrowserLocalTime: boolean,
) {
  if (mode === 'utc') {
    return dayjs.utc(ms).format('MMM D [at] h:mm A [UTC]')
  }

  if (!allowBrowserLocalTime) {
    return dayjs.utc(ms).format('MMM D [at] h:mm A')
  }

  return dayjs(ms).format('MMM D [at] h:mm A')
}

export function usePassagePlaybackBundle(passageId: Ref<string | null | undefined>) {
  const appFetch = useAppFetch()

  return useAsyncData(
    () => {
      const id = toValue(passageId)
      return `passage-playback-${id || 'none'}`
    },
    async () => {
      const id = toValue(passageId)
      if (!id) return null
      return await appFetch<PassagePlaybackBundle>(
        `/api/passages/${encodeURIComponent(id)}/playback`,
      )
    },
    { watch: [passageId] },
  )
}

export function usePassagePlaybackController(
  bundle: Ref<PassagePlaybackBundle | null | undefined>,
) {
  const timeMode = ref<PlaybackTimeMode>('local')
  const cameraMode = ref<PlaybackCameraMode>('follow')
  const trafficMode = ref<PlaybackTrafficMode>('closest')
  const speedId = ref('fit-60s')
  const isPlaying = ref(false)
  const hasMounted = ref(false)
  const selectedTrafficId = ref<string | null>(null)
  const playheadMs = ref(0)

  const preparedSelf = shallowRef<PreparedSelfSample[]>([])
  const preparedTraffic = shallowRef<PreparedTrafficVessel[]>([])
  const eventMarkers = shallowRef<PlaybackEventMarker[]>([])
  const visualTrack = shallowRef<PreparedSelfSample[]>([])

  let frameHandle = 0
  let lastRafTime = 0
  let lastCommitTime = 0

  const speedOptions = PLAYBACK_SPEED_OPTIONS

  const startedMs = computed(() => preparedSelf.value[0]?.ms ?? 0)
  const endedMs = computed(
    () => preparedSelf.value[preparedSelf.value.length - 1]?.ms ?? preparedSelf.value[0]?.ms ?? 0,
  )
  const durationMs = computed(() => Math.max(0, endedMs.value - startedMs.value))

  const activeSpeedOption = computed(
    () => speedOptions.find((option) => option.id === speedId.value) ?? speedOptions[0]!,
  )

  const speedMultiplier = computed(() => {
    if (!durationMs.value) return 1
    const option = activeSpeedOption.value
    if (option.kind === 'fit') {
      return durationMs.value / Math.max(1, (option.targetSeconds ?? 60) * 1000)
    }
    return option.multiplier ?? 1
  })

  const currentNearestIndex = computed(() =>
    findNearestIndexByMs(preparedSelf.value, playheadMs.value),
  )
  const currentNearestSample = computed(() =>
    currentNearestIndex.value >= 0 ? (preparedSelf.value[currentNearestIndex.value] ?? null) : null,
  )

  const currentPosition = computed(() =>
    interpolateSelfPosition(preparedSelf.value, playheadMs.value),
  )
  const canRenderLocalTime = computed(() => hasMounted.value)

  const visibleProgress = computed(() => {
    if (!durationMs.value) return 0
    return clamp((playheadMs.value - startedMs.value) / durationMs.value, 0, 1)
  })

  const currentMetrics = computed(() => {
    const nearest = currentNearestSample.value
    const position = currentPosition.value
    if (!nearest || !position) return null

    const distanceSoFarNm = position.progressDistanceNm
    const avgSoFar =
      nearest.prefixSogCount > 0 ? nearest.prefixSogSum / Math.max(1, nearest.prefixSogCount) : null

    return {
      timestampLabel:
        timeMode.value === 'elapsed'
          ? formatMediaTime((playheadMs.value - startedMs.value) / 1000)
          : formatAbsoluteTime(playheadMs.value, timeMode.value, canRenderLocalTime.value),
      actualTimestampLabel: formatAbsoluteTime(playheadMs.value, 'utc', canRenderLocalTime.value),
      elapsedLabel: formatDuration((playheadMs.value - startedMs.value) / 1000),
      elapsedShortLabel: formatMediaTime((playheadMs.value - startedMs.value) / 1000),
      progressPercent: visibleProgress.value * 100,
      lat: position.lat,
      lon: position.lng,
      coordLabel: formatCoord(position.lat, position.lng),
      sog: nearest.sog,
      cog: nearest.cog,
      heading: nearest.headingTrue ?? nearest.cog ?? null,
      depth: nearest.depth ?? null,
      waterTempC: nearest.waterTempC ?? null,
      airTempC: nearest.airTempC ?? null,
      windAppSpeedKts: nearest.windAppSpeedKts ?? null,
      windAppAngleDeg: nearest.windAppAngleDeg ?? null,
      windTrueSpeedKts: nearest.windTrueSpeedKts ?? null,
      windTrueDirectionDeg: nearest.windTrueDirectionDeg ?? null,
      portRpm: nearest.portRpm ?? null,
      starboardRpm: nearest.starboardRpm ?? null,
      barometerHpa: nearest.barometerHpa ?? null,
      distanceSoFarNm,
      distanceRemainingNm: Math.max(0, (bundle.value?.summary.distanceNm ?? 0) - distanceSoFarNm),
      avgSogSoFar: avgSoFar,
      maxSogSoFar: nearest.prefixMaxSog,
    }
  })

  const selfMarker = computed<PlaybackMapVessel | null>(() => {
    const position = currentPosition.value
    const nearest = currentNearestSample.value
    if (!position || !nearest) return null
    return {
      id: 'self',
      kind: 'self',
      label: 'Tideye',
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      sog: position.sog,
    }
  })

  const allTrafficPositions = computed<PlaybackMapVessel[]>(() => {
    const current = selfMarker.value
    const toleranceMs = parseWindowMs(bundle.value?.traffic.window, 8 * 60_000) * 2

    const active = preparedTraffic.value
      .map((vessel) => interpolateTrafficPosition(vessel, playheadMs.value, toleranceMs))
      .filter((vessel): vessel is PlaybackMapVessel => Boolean(vessel))

    if (!current) return active

    return active
      .map((vessel) => ({
        ...vessel,
        _distanceNm: haversineNm(current.lat, current.lng, vessel.lat, vessel.lng),
      }))
      .sort((left, right) => (left._distanceNm as number) - (right._distanceNm as number))
      .map(({ _distanceNm: _ignored, ...vessel }) => vessel)
  })

  const visibleTraffic = computed(() => {
    if (trafficMode.value === 'hide') return []
    const active = allTrafficPositions.value
    if (trafficMode.value === 'all') return active
    if (trafficMode.value === 'large') {
      return active.filter(
        (vessel) =>
          (vessel.lengthM ?? 0) >= 80 ||
          (vessel.shipTypeName ? /cargo|tanker|passenger/i.test(vessel.shipTypeName) : false),
      )
    }
    return active.slice(0, 12)
  })

  const selectedTraffic = computed(() => {
    if (!selectedTrafficId.value) return null
    return (
      allTrafficPositions.value.find((vessel) => vessel.id === selectedTrafficId.value) ??
      visibleTraffic.value.find((vessel) => vessel.id === selectedTrafficId.value) ??
      null
    )
  })

  const selectedTrafficProfile = computed(() => {
    if (!selectedTrafficId.value) return null
    return (
      preparedTraffic.value.find((vessel) => vessel.profile.mmsi === selectedTrafficId.value)
        ?.profile ?? null
    )
  })

  const localTrackWindow = computed(() => {
    if (!visualTrack.value.length) return []

    const endIndex = findFloorIndexByMs(visualTrack.value, playheadMs.value)

    if (cameraMode.value === 'fit') {
      return visualTrack.value.slice(0, Math.max(1, endIndex + 1))
    }

    const startIndex = findWindowStartIndexByMs(
      visualTrack.value,
      playheadMs.value - 4 * 60 * 60_000,
    )
    return visualTrack.value.slice(startIndex, Math.max(startIndex + 1, endIndex + 1))
  })

  const completedTrackCoordinates = computed(() => {
    if (!localTrackWindow.value.length) return []
    const coords = localTrackWindow.value.map(
      (sample) => [sample.lon, sample.lat] as [number, number],
    )

    const position = currentPosition.value
    if (position) {
      coords.push([position.lng, position.lat])
    }
    return coords
  })

  const fullTrackCoordinates = computed(() => {
    if (cameraMode.value !== 'fit') return []
    return visualTrack.value.map((sample) => [sample.lon, sample.lat] as [number, number])
  })

  const wakeTrailCoordinates = computed(() => {
    if (!visualTrack.value.length) return []
    const floor = findFloorIndexByMs(visualTrack.value, playheadMs.value)
    const coords = visualTrack.value
      .slice(Math.max(0, floor - 20), Math.max(1, floor + 1))
      .map((sample) => [sample.lon, sample.lat] as [number, number])
    const position = currentPosition.value
    if (position) {
      coords.push([position.lng, position.lat])
    }
    return coords
  })

  const previewAtMs = (ms: number) => {
    const boundedMs = clamp(ms, startedMs.value, endedMs.value)
    const index = findNearestIndexByMs(preparedSelf.value, boundedMs)
    const nearest = index >= 0 ? (preparedSelf.value[index] ?? null) : null
    const position = interpolateSelfPosition(preparedSelf.value, boundedMs)
    const event = eventMarkers.value.find(
      (marker) => Math.abs(marker.ms - boundedMs) <= 20 * 60_000,
    )

    return {
      timestamp:
        timeMode.value === 'elapsed'
          ? formatMediaTime((boundedMs - startedMs.value) / 1000)
          : formatAbsoluteTime(boundedMs, timeMode.value, canRenderLocalTime.value),
      speed: nearest?.sog != null ? `${nearest.sog.toFixed(1)} kts` : '—',
      coords: position ? formatCoord(position.lat, position.lng) : '—',
      event: event?.label ?? null,
    }
  }

  const activeEvent = computed(() => {
    const thresholdMs = 15 * 60_000
    const eligible = eventMarkers.value.filter(
      (marker) => marker.ms <= playheadMs.value && playheadMs.value - marker.ms <= thresholdMs,
    )
    return eligible.at(-1) ?? null
  })

  function seekToMs(ms: number) {
    playheadMs.value = clamp(ms, startedMs.value, endedMs.value)
  }

  function seekToFraction(fraction: number) {
    seekToMs(startedMs.value + clamp(fraction, 0, 1) * durationMs.value)
  }

  function seekBySeconds(seconds: number) {
    seekToMs(playheadMs.value + seconds * 1000)
  }

  function pause() {
    isPlaying.value = false
    lastRafTime = 0
  }

  function play() {
    if (!preparedSelf.value.length) return
    if (playheadMs.value >= endedMs.value) {
      playheadMs.value = startedMs.value
    }
    isPlaying.value = true
    ensurePlaybackLoop()
  }

  function togglePlayback() {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  function resetPlayback() {
    pause()
    seekToMs(startedMs.value)
  }

  function skipToEnd() {
    pause()
    seekToMs(endedMs.value)
  }

  function ensurePlaybackLoop() {
    if (!import.meta.client || frameHandle) return

    const loop = (rafTime: number) => {
      if (!isPlaying.value) {
        frameHandle = 0
        return
      }

      if (!lastRafTime) {
        lastRafTime = rafTime
      }

      const deltaMs = rafTime - lastRafTime
      lastRafTime = rafTime

      if (rafTime - lastCommitTime >= FRAME_COMMIT_MS) {
        lastCommitTime = rafTime
        const nextMs = playheadMs.value + deltaMs * speedMultiplier.value
        if (nextMs >= endedMs.value) {
          playheadMs.value = endedMs.value
          pause()
          frameHandle = 0
          return
        }
        playheadMs.value = nextMs
      }

      frameHandle = window.requestAnimationFrame(loop)
    }

    frameHandle = window.requestAnimationFrame(loop)
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    if (event.code === 'Space') {
      event.preventDefault()
      togglePlayback()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekBySeconds(-10)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekBySeconds(10)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      resetPlayback()
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      skipToEnd()
    }
  }

  watch(
    bundle,
    (value) => {
      const self = prepareSelfSamples(value?.self.samples ?? [])
      preparedSelf.value = self
      preparedTraffic.value = prepareTrafficVessels(value?.traffic.vessels ?? [])
      visualTrack.value = evenDecimate(self, 1400)
      eventMarkers.value = buildPlaybackEvents(self, preparedTraffic.value)
      selectedTrafficId.value = null
      isPlaying.value = false
      lastRafTime = 0
      lastCommitTime = 0
      playheadMs.value = self[0]?.ms ?? 0
      cameraMode.value = 'follow'
    },
    { immediate: true },
  )

  watch(
    visibleTraffic,
    (rows) => {
      if (selectedTrafficId.value && !rows.some((row) => row.id === selectedTrafficId.value)) {
        selectedTrafficId.value = null
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    if (!import.meta.client) return
    hasMounted.value = true
    window.addEventListener('keydown', onKeyDown)
  })

  onBeforeUnmount(() => {
    if (frameHandle && import.meta.client) {
      window.cancelAnimationFrame(frameHandle)
      frameHandle = 0
    }
    if (import.meta.client) {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  return {
    speedOptions,
    timeMode,
    cameraMode,
    trafficMode,
    speedId,
    isPlaying,
    playheadMs,
    startedMs,
    endedMs,
    durationMs,
    speedMultiplier,
    eventMarkers,
    activeEvent,
    canRenderLocalTime,
    currentMetrics,
    currentNearestSample,
    selfMarker,
    visibleTraffic,
    allTrafficPositions,
    selectedTraffic,
    selectedTrafficId,
    selectedTrafficProfile,
    completedTrackCoordinates,
    fullTrackCoordinates,
    wakeTrailCoordinates,
    previewAtMs,
    seekToMs,
    seekToFraction,
    seekBySeconds,
    play,
    pause,
    togglePlayback,
    resetPlayback,
    skipToEnd,
    skipToStart: resetPlayback,
  }
}
