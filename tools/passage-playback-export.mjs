#!/usr/bin/env node
/**
 * Passage-first playback export from InfluxDB.
 *
 * This replaces the old voyage-first seed approach for playback preparation:
 * - coarse self-track scan in bounded batches
 * - direct start/stop passage detection from movement and meaningful stops
 * - high-resolution self/telemetry export per passage
 * - uncapped traffic export filtered by proximity, not vessel count
 * - optional contextual endpoint labels via Apple Maps Server API
 *
 * Default output:
 *   tools/.generated/passage-playback/
 *     manifest.json
 *     passages/<passage-id>.json
 *
 * Usage:
 *   doppler run --project tideye --config prd -- node tools/passage-playback-export.mjs
 *
 * Key env:
 *   PASSAGE_RANGE_START / PASSAGE_RANGE_STOP
 *   PASSAGE_EXPORT_OUT_DIR
 *   PASSAGE_EXPORT_LIMIT_PASSAGES
 *   PASSAGE_EXPORT_SCAN_BATCH_DAYS
 *   PASSAGE_EXPORT_SELF_WINDOW_* / PASSAGE_EXPORT_TRAFFIC_WINDOW_*
 *   PASSAGE_EXPORT_*_SOURCE
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const OUTPUT_DIR =
  process.env.PASSAGE_EXPORT_OUT_DIR || join(REPO_ROOT, 'tools/.generated/passage-playback')
const OUTPUT_PASSAGES_DIR = join(OUTPUT_DIR, 'passages')

const BUCKET = process.env.INFLUX_BUCKET_MAIN || 'Tideye'
const RANGE_START = process.env.PASSAGE_RANGE_START || '2023-11-01T00:00:00Z'
const RANGE_STOP = process.env.PASSAGE_RANGE_STOP || new Date().toISOString()
const LIMIT_PASSAGES = Number(process.env.PASSAGE_EXPORT_LIMIT_PASSAGES || 0)
const SCAN_BATCH_DAYS = Number(process.env.PASSAGE_EXPORT_SCAN_BATCH_DAYS || 45)
const SCAN_WINDOW = (process.env.PASSAGE_EXPORT_SCAN_WINDOW || '2m').trim()
const QUERY_MAX_BUFFER = 128 * 1024 * 1024
const DEFAULT_LIVE_INFLUX_HOST =
  process.env.PASSAGE_EXPORT_DEFAULT_INFLUX_HOST || 'http://tideye-server.curl-banjo.ts.net:8086'

const MAX_DATA_GAP_HOURS = Number(process.env.PASSAGE_EXPORT_MAX_GAP_HOURS || 8)
const MOVING_SOG_KTS = Number(process.env.PASSAGE_EXPORT_MOVING_SOG_KTS || 1.0)
const MOVING_STEP_KTS = Number(process.env.PASSAGE_EXPORT_MOVING_STEP_KTS || 1.0)
const STOP_MAX_SOG_KTS = Number(process.env.PASSAGE_EXPORT_STOP_MAX_SOG_KTS || 0.6)
const STOP_MAX_RADIUS_NM = Number(process.env.PASSAGE_EXPORT_STOP_MAX_RADIUS_NM || 0.8)
const STOP_MIN_DURATION_HOURS = Number(process.env.PASSAGE_EXPORT_STOP_MIN_DURATION_HOURS || 3)
const MIN_PASSAGE_DISTANCE_NM = Number(process.env.PASSAGE_EXPORT_MIN_PASSAGE_DISTANCE_NM || 5)
const MIN_PASSAGE_DURATION_HOURS = Number(
  process.env.PASSAGE_EXPORT_MIN_PASSAGE_DURATION_HOURS || 0.75,
)
const MAX_SELF_STEP_KTS = Number(process.env.PASSAGE_EXPORT_MAX_SELF_STEP_KTS || 45)
const MAX_TRAFFIC_STEP_KTS = Number(process.env.PASSAGE_EXPORT_MAX_TRAFFIC_STEP_KTS || 70)
const EDGE_BUFFER_MINUTES = Number(process.env.PASSAGE_EXPORT_EDGE_BUFFER_MINUTES || 20)
const OVERVIEW_TRACK_MAX_POINTS = Number(process.env.PASSAGE_EXPORT_OVERVIEW_MAX_POINTS || 2000)
const TRAFFIC_PROXIMITY_NM = Number(process.env.PASSAGE_EXPORT_TRAFFIC_PROXIMITY_NM || 24)
const TRAFFIC_BBOX_BUFFER_NM = Number(process.env.PASSAGE_EXPORT_TRAFFIC_BBOX_BUFFER_NM || 28)
const TRAFFIC_BATCH_HOURS = Number(process.env.PASSAGE_EXPORT_TRAFFIC_BATCH_HOURS || 24)
const MIN_TRAFFIC_SAMPLES = Number(process.env.PASSAGE_EXPORT_MIN_TRAFFIC_SAMPLES || 2)
const TARGET_SELF_SAMPLES = Number(process.env.PASSAGE_EXPORT_TARGET_SELF_SAMPLES || 18_000)
const TARGET_TRAFFIC_SAMPLES_PER_VESSEL = Number(
  process.env.PASSAGE_EXPORT_TARGET_TRAFFIC_SAMPLES_PER_VESSEL || 1_200,
)
const TARGET_TRAFFIC_TOTAL_SAMPLES = Number(
  process.env.PASSAGE_EXPORT_TARGET_TRAFFIC_TOTAL_SAMPLES || 150_000,
)
const TRAFFIC_CONTEXT_BATCH_SIZE = Number(
  process.env.PASSAGE_EXPORT_TRAFFIC_CONTEXT_BATCH_SIZE || 60,
)
const TRAFFIC_METADATA_LOOKBACK_HOURS = Number(
  process.env.PASSAGE_EXPORT_TRAFFIC_METADATA_LOOKBACK_HOURS || 24 * 14,
)
const LABEL_NEIGHBOR_MAX_NM = Number(process.env.PASSAGE_EXPORT_LABEL_NEIGHBOR_MAX_NM || 40)
const LABEL_CLUSTER_RADIUS_NM = Number(process.env.PASSAGE_EXPORT_LABEL_CLUSTER_RADIUS_NM || 0.75)
const LABEL_STRICT_NEIGHBOR_MAX_NM = Number(
  process.env.PASSAGE_EXPORT_LABEL_STRICT_NEIGHBOR_MAX_NM || 8,
)

const SELF_POSITION_SOURCE = process.env.PASSAGE_EXPORT_SELF_POSITION_SOURCE || 'ydg-nmea-2000.2'
const SELF_NAV_SOURCE = process.env.PASSAGE_EXPORT_SELF_NAV_SOURCE || SELF_POSITION_SOURCE
const SELF_HEADING_MAG_SOURCE =
  process.env.PASSAGE_EXPORT_SELF_HEADING_MAG_SOURCE || 'ydg-nmea-2000.204'
const SELF_MAGVAR_SOURCE = process.env.PASSAGE_EXPORT_SELF_MAGVAR_SOURCE || 'ydg-nmea-2000.4'
const SELF_ENV_SOURCE = process.env.PASSAGE_EXPORT_SELF_ENV_SOURCE || 'ydg-nmea-2000.105'
const SELF_TRUE_WIND_SOURCE = process.env.PASSAGE_EXPORT_SELF_TRUE_WIND_SOURCE || 'ydg-nmea-0183.YD'
const SELF_AIR_TEMP_SOURCE = process.env.PASSAGE_EXPORT_SELF_AIR_TEMP_SOURCE || 'ydg-nmea-0183.AI'
const SELF_ENGINE_PORT_SOURCE =
  process.env.PASSAGE_EXPORT_SELF_ENGINE_PORT_SOURCE || 'ydg-nmea-2000.236'
const SELF_ENGINE_STARBOARD_SOURCE =
  process.env.PASSAGE_EXPORT_SELF_ENGINE_STARBOARD_SOURCE || 'ydg-nmea-2000.237'

const TRAFFIC_POSITION_SOURCE =
  process.env.PASSAGE_EXPORT_TRAFFIC_POSITION_SOURCE || 'ydg-nmea-2000.2'
const TRAFFIC_NAME_SOURCE = process.env.PASSAGE_EXPORT_TRAFFIC_NAME_SOURCE || 'ydg-nmea-2000.2'

const APPLE_LANG = 'en-US'
const APPLE_CONTEXT_QUERIES = [
  'marina',
  'harbor',
  'harbour',
  'port',
  'anchorage',
  'bay',
  'inlet',
  'cay',
  'island',
  'settlement',
  'town',
  'village',
  'sound',
  'channel',
  'river',
  'creek',
]
const GENERIC_CONTEXTUAL_LABELS = new Set([
  'the bahamas',
  'bahamas',
  'united states',
  'united states of america',
  'usa',
  'north atlantic ocean',
  'atlantic ocean',
  'caribbean sea',
  'gulf of america',
  'gulf of mexico',
])
const XAI_CONTEXT_MODEL = process.env.XAI_CONTEXT_MODEL || 'grok-4-0709'
const XAI_API_KEY = (process.env.XAI_API_KEY || '').trim()
const CONTEXTUAL_AI_CACHE = new Map()

const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

const INFLUX = resolveInfluxConnection()

async function main() {
  process.stderr.write(
    `Playback export from ${BUCKET} via ${INFLUX.label} (${RANGE_START} .. ${RANGE_STOP})\n`,
  )
  process.stderr.write(
    `Sources: self position=${SELF_POSITION_SOURCE}, self nav=${SELF_NAV_SOURCE}, traffic=${TRAFFIC_POSITION_SOURCE}\n`,
  )

  const scanRows = scanSelfTrack()
  if (!scanRows.length) {
    throw new Error('No self-track scan rows returned for the requested range')
  }

  const passages = detectPassages(scanRows)
  const selected = LIMIT_PASSAGES > 0 ? passages.slice(0, LIMIT_PASSAGES) : passages
  process.stderr.write(`Detected ${passages.length} passage(s); exporting ${selected.length}\n`)

  const appleResolver = await createAppleContextResolver()

  rmSync(OUTPUT_DIR, { recursive: true, force: true })
  mkdirSync(OUTPUT_PASSAGES_DIR, { recursive: true })

  const manifestRows = []
  for (let i = 0; i < selected.length; i++) {
    const coarse = selected[i]
    process.stderr.write(
      `Passage ${i + 1}/${selected.length}: ${coarse.startedAt} .. ${coarse.endedAt}\n`,
    )
    const bundle = exportPassageBundle(i, coarse, appleResolver)
    const relPath = `passages/${bundle.id}.json`
    writeFileSync(join(OUTPUT_DIR, relPath), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
    manifestRows.push({
      id: bundle.id,
      title: bundle.title,
      startedAt: bundle.startedAt,
      endedAt: bundle.endedAt,
      startLat: bundle.startLat,
      startLon: bundle.startLon,
      endLat: bundle.endLat,
      endLon: bundle.endLon,
      distanceNm: bundle.summary.distanceNm,
      durationHours: bundle.summary.durationHours,
      avgSog: bundle.summary.avgSog,
      maxSog: bundle.summary.maxSog,
      startPlaceLabel: bundle.startPlaceLabel,
      endPlaceLabel: bundle.endPlaceLabel,
      file: relPath,
      sampleCount: bundle.self.samples.length,
      trafficVesselCount: bundle.traffic.vessels.length,
      selfWindow: bundle.self.window,
      trafficWindow: bundle.traffic.window,
      sources: bundle.sources,
    })
  }

  await backfillEndpointLabels(manifestRows, appleResolver)

  const manifest = {
    v: 1,
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    connection: {
      label: INFLUX.label,
      host: INFLUX.host,
    },
    range: {
      start: RANGE_START,
      stop: RANGE_STOP,
    },
    thresholds: {
      movingSogKts: MOVING_SOG_KTS,
      movingStepKts: MOVING_STEP_KTS,
      stopMaxSogKts: STOP_MAX_SOG_KTS,
      stopMaxRadiusNm: STOP_MAX_RADIUS_NM,
      stopMinDurationHours: STOP_MIN_DURATION_HOURS,
      minPassageDistanceNm: MIN_PASSAGE_DISTANCE_NM,
      minPassageDurationHours: MIN_PASSAGE_DURATION_HOURS,
      trafficProximityNm: TRAFFIC_PROXIMITY_NM,
    },
    passages: manifestRows,
  }

  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  process.stderr.write(`Wrote ${manifestRows.length} passage bundle(s) to ${OUTPUT_DIR}\n`)
}

async function backfillEndpointLabels(manifestRows, appleResolver) {
  const clusters = buildEndpointClusters(manifestRows)
  const knownPoints = clusters
    .filter((cluster) => cluster.label)
    .map((cluster) => ({
      label: cluster.label,
      lat: cluster.lat,
      lon: cluster.lon,
    }))

  const accessToken = appleResolver?.accessToken || null
  for (const cluster of clusters) {
    if (cluster.label) continue

    const contextualLabel = accessToken
      ? resolveClusterLabelFromRouteContext(accessToken, cluster, clusters, manifestRows)
      : null
    const strictFallback =
      contextualLabel ||
      nearestKnownEndpointLabel(
        cluster.lat,
        cluster.lon,
        knownPoints,
        Array.from(cluster.avoidLabels),
        LABEL_STRICT_NEIGHBOR_MAX_NM,
      )

    if (!strictFallback) continue

    cluster.label = strictFallback
    knownPoints.push({
      label: strictFallback,
      lat: cluster.lat,
      lon: cluster.lon,
    })
  }

  for (const cluster of clusters) {
    if (!cluster.label) continue
    for (const member of cluster.members) {
      if (member.side === 'start') {
        member.row.startPlaceLabel = cluster.label
      } else {
        member.row.endPlaceLabel = cluster.label
      }
    }
  }

  for (const row of manifestRows) {
    const startFallback = row.startPlaceLabel || formatCoordLabel(row.startLat, row.startLon)
    const endFallback = row.endPlaceLabel || formatCoordLabel(row.endLat, row.endLon)
    const nextTitle = `${startFallback} → ${endFallback} · ${row.distanceNm} nm`

    if (
      startFallback === row.startPlaceLabel &&
      endFallback === row.endPlaceLabel &&
      nextTitle === row.title
    ) {
      continue
    }

    row.startPlaceLabel = row.startPlaceLabel || null
    row.endPlaceLabel = row.endPlaceLabel || null
    row.title = nextTitle

    const bundlePath = join(OUTPUT_DIR, row.file)
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
    bundle.startPlaceLabel = row.startPlaceLabel
    bundle.endPlaceLabel = row.endPlaceLabel
    bundle.title = row.title
    writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  }
}

function buildEndpointClusters(manifestRows) {
  const clusters = []

  for (const row of manifestRows) {
    addEndpointToClusters(clusters, row, 'start', row.startLat, row.startLon, row.startPlaceLabel)
    addEndpointToClusters(clusters, row, 'end', row.endLat, row.endLon, row.endPlaceLabel)
  }

  for (const cluster of clusters) {
    cluster.label = pickClusterLabel(cluster.seedLabels)
  }

  return clusters
}

function addEndpointToClusters(clusters, row, side, lat, lon, label) {
  let bestCluster = null
  let bestDistance = Infinity

  for (const cluster of clusters) {
    const distanceNm = haversineNm(lat, lon, cluster.lat, cluster.lon)
    if (distanceNm > LABEL_CLUSTER_RADIUS_NM) continue
    if (distanceNm >= bestDistance) continue
    bestCluster = cluster
    bestDistance = distanceNm
  }

  if (!bestCluster) {
    bestCluster = {
      lat,
      lon,
      members: [],
      seedLabels: [],
      avoidLabels: new Set(),
    }
    clusters.push(bestCluster)
  } else {
    const size = bestCluster.members.length
    bestCluster.lat = (bestCluster.lat * size + lat) / (size + 1)
    bestCluster.lon = (bestCluster.lon * size + lon) / (size + 1)
  }

  bestCluster.members.push({ row, side, lat, lon })
  if (label) {
    bestCluster.seedLabels.push(label)
  }
}

function pickClusterLabel(labels) {
  if (!labels.length) return null

  const counts = new Map()
  for (const label of labels) {
    counts.set(label, (counts.get(label) || 0) + 1)
  }

  let best = null
  let bestCount = -1
  for (const [label, count] of counts.entries()) {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }

  return best
}

function resolveClusterLabelFromRouteContext(accessToken, cluster, clusters, manifestRows) {
  if (!XAI_API_KEY) return null

  const reverse = reverseGeocodeCoordinate(accessToken, cluster.lat, cluster.lon)
  const rawCandidates = []
  const regions = [
    smallSearchRegion(cluster.lat, cluster.lon, 12),
    smallSearchRegion(cluster.lat, cluster.lon, 24),
  ]

  for (const region of regions) {
    for (const query of APPLE_CONTEXT_QUERIES) {
      rawCandidates.push(...searchPlaces(accessToken, query, cluster.lat, cluster.lon, region))
    }
  }

  const nearbyCandidates = collectNearbyContextualCandidates(
    rawCandidates,
    cluster.lat,
    cluster.lon,
  )
  const routeContext = collectClusterRouteContext(cluster, clusters, manifestRows)
  const candidateLabels = new Set(
    nearbyCandidates.map((candidate) => normalizeContextualKey(candidate.label)).filter(Boolean),
  )

  for (const label of routeContext.oppositeLabels) {
    cluster.avoidLabels.add(label)
  }

  if (!nearbyCandidates.length) {
    return null
  }

  const payload = postSyncJson('https://api.x.ai/v1/chat/completions', XAI_API_KEY, {
    model: XAI_CONTEXT_MODEL,
    temperature: 0.15,
    store: false,
    messages: [
      {
        role: 'system',
        content:
          'You label sailing stop locations for cruisers. Return JSON only in the form {"label": string|null}. Use the route context and nearby Apple place candidates to choose a familiar local place name sailors would actually use. Prefer known cays, islands, anchorages, harbors, marinas, settlements, and towns. Avoid obscure cuts, channels, and chart micro-features unless they are clearly the common local name. Do not simply repeat another distinct nearby stop unless the evidence shows it is the same place.',
      },
      {
        role: 'user',
        content: [
          `Coordinate: ${cluster.lat.toFixed(5)}, ${cluster.lon.toFixed(5)}`,
          reverse ? `Apple reverse geocode: ${summarizeAppleResult(reverse)}` : null,
          routeContext.oppositeLabels.length
            ? `Directly connected passage endpoints:\n${routeContext.oppositeLabels.map((label) => `- ${label}`).join('\n')}`
            : null,
          routeContext.nearbyKnown.length
            ? `Nearby already-resolved stops:\n${routeContext.nearbyKnown
                .map((candidate) => `- ${candidate.label} (${candidate.distanceNm.toFixed(1)} nm)`)
                .join('\n')}`
            : null,
          nearbyCandidates.length
            ? `Nearby Apple candidates:\n${nearbyCandidates
                .map((candidate) => {
                  const suffix = candidate.poiCategory
                    ? ` (${candidate.poiCategory}, ${candidate.distanceNm.toFixed(1)} nm)`
                    : ` (${candidate.distanceNm.toFixed(1)} nm)`
                  return `- ${candidate.label}${suffix}`
                })
                .join('\n')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  })

  const label = parseXaiContextualLabel(payload)
  if (!label) return null
  if (!candidateLabels.has(normalizeContextualKey(label))) return null
  if (cluster.avoidLabels.has(label)) return null
  return label
}

function collectClusterRouteContext(cluster, clusters, manifestRows) {
  const oppositeLabels = new Set()
  const nearbyKnown = []

  for (const member of cluster.members) {
    const otherLat = member.side === 'start' ? member.row.endLat : member.row.startLat
    const otherLon = member.side === 'start' ? member.row.endLon : member.row.startLon
    const oppositeLabel =
      member.side === 'start'
        ? member.row.endPlaceLabel || null
        : member.row.startPlaceLabel || null
    if (oppositeLabel) oppositeLabels.add(oppositeLabel)

    const neighborRows = [
      manifestRows[manifestRows.indexOf(member.row) - 1],
      manifestRows[manifestRows.indexOf(member.row) + 1],
    ].filter(Boolean)
    for (const neighbor of neighborRows) {
      if (neighbor.startPlaceLabel) oppositeLabels.add(neighbor.startPlaceLabel)
      if (neighbor.endPlaceLabel) oppositeLabels.add(neighbor.endPlaceLabel)
    }

    cluster.avoidLabels.add(oppositeLabel || '')
    cluster.avoidLabels.add(formatCoordLabel(otherLat, otherLon))
  }

  for (const other of clusters) {
    if (other === cluster || !other.label) continue
    const distanceNm = haversineNm(cluster.lat, cluster.lon, other.lat, other.lon)
    if (distanceNm > LABEL_NEIGHBOR_MAX_NM) continue
    nearbyKnown.push({ label: other.label, distanceNm })
  }

  nearbyKnown.sort((left, right) => left.distanceNm - right.distanceNm)

  return {
    oppositeLabels: Array.from(oppositeLabels).filter(Boolean).slice(0, 8),
    nearbyKnown: nearbyKnown.slice(0, 8),
  }
}

function nearestKnownEndpointLabel(
  lat,
  lon,
  points,
  avoidLabels,
  maxDistanceNm = LABEL_NEIGHBOR_MAX_NM,
) {
  const avoidSet = new Set((avoidLabels || []).filter(Boolean))
  let best = null
  let bestDistance = Infinity

  for (const point of points) {
    if (!point?.label) continue
    if (avoidSet.has(point.label)) continue

    const distanceNm = haversineNm(lat, lon, point.lat, point.lon)
    if (distanceNm > maxDistanceNm) continue
    if (distanceNm >= bestDistance) continue

    best = point.label
    bestDistance = distanceNm
  }

  return best
}

function scanSelfTrack() {
  const rows = []
  const batches = splitRangeByDays(RANGE_START, RANGE_STOP, SCAN_BATCH_DAYS)
  for (let i = 0; i < batches.length; i++) {
    const { start, stop } = batches[i]
    process.stderr.write(
      `Scan batch ${i + 1}/${batches.length}: ${start.slice(0, 10)} .. ${stop.slice(0, 10)}\n`,
    )
    const raw = runInflux(fluxSelfScan(start, stop, SCAN_WINDOW))
    const parsed = parseAnnotatedCsv(raw)
    for (const row of parsed) {
      const t = row._time
      const lat = numberOrNull(row.lat)
      const lon = numberOrNull(row.lon)
      if (!t || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const normalized = normalizeLatLonCaribbeanUS(lat, lon)
      rows.push({
        t,
        lat: normalized.lat,
        lon: normalized.lon,
        sog: msToKnots(numberOrNull(row.sog)),
      })
    }
  }

  rows.sort((a, b) => a.t.localeCompare(b.t))
  return dedupeAndFilterTrack(rows, MAX_SELF_STEP_KTS)
}

function detectPassages(rows) {
  const passages = []
  let inPassage = false
  let passageStartIndex = -1
  let lastMovingIndex = -1
  let stationaryStartIndex = -1
  let stationaryAnchor = null
  let stationaryMaxRadiusNm = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const prev = i > 0 ? rows[i - 1] : null

    if (prev) {
      const gapMs = Date.parse(row.t) - Date.parse(prev.t)
      if (gapMs > MAX_DATA_GAP_HOURS * 3_600_000) {
        if (inPassage && lastMovingIndex > passageStartIndex) {
          maybePushPassage(passages, rows, passageStartIndex, lastMovingIndex)
        }
        inPassage = false
        passageStartIndex = -1
        lastMovingIndex = -1
        stationaryStartIndex = -1
        stationaryAnchor = null
        stationaryMaxRadiusNm = 0
      }
    }

    const moving = isMovingSample(row, prev)
    if (moving) {
      if (!inPassage) {
        inPassage = true
        passageStartIndex = i
      }
      lastMovingIndex = i
      stationaryStartIndex = -1
      stationaryAnchor = null
      stationaryMaxRadiusNm = 0
      continue
    }

    if (!inPassage) continue

    if (stationaryStartIndex === -1) {
      stationaryStartIndex = i
      stationaryAnchor = row
      stationaryMaxRadiusNm = 0
      continue
    }

    stationaryMaxRadiusNm = Math.max(
      stationaryMaxRadiusNm,
      haversineNm(stationaryAnchor.lat, stationaryAnchor.lon, row.lat, row.lon),
    )

    const durationHours = (Date.parse(row.t) - Date.parse(rows[stationaryStartIndex].t)) / 3_600_000
    if (durationHours < STOP_MIN_DURATION_HOURS) continue
    if (stationaryMaxRadiusNm > STOP_MAX_RADIUS_NM) continue

    if (lastMovingIndex > passageStartIndex) {
      maybePushPassage(passages, rows, passageStartIndex, lastMovingIndex)
    }
    inPassage = false
    passageStartIndex = -1
    lastMovingIndex = -1
  }

  if (inPassage && lastMovingIndex > passageStartIndex) {
    maybePushPassage(passages, rows, passageStartIndex, lastMovingIndex)
  }

  return passages
}

function maybePushPassage(passages, rows, startIndex, endIndex) {
  const start = rows[startIndex]
  const end = rows[endIndex]
  if (!start || !end) return

  let distanceNm = 0
  for (let i = startIndex + 1; i <= endIndex; i++) {
    distanceNm += haversineNm(rows[i - 1].lat, rows[i - 1].lon, rows[i].lat, rows[i].lon)
  }
  const durationHours = (Date.parse(end.t) - Date.parse(start.t)) / 3_600_000
  if (distanceNm < MIN_PASSAGE_DISTANCE_NM) return
  if (durationHours < MIN_PASSAGE_DURATION_HOURS) return

  passages.push({
    startedAt: start.t,
    endedAt: end.t,
    startLat: start.lat,
    startLon: start.lon,
    endLat: end.lat,
    endLon: end.lon,
    coarseDistanceNm: round(distanceNm, 1),
  })
}

function exportPassageBundle(index, coarse, appleResolver) {
  const roughDurationHours = (Date.parse(coarse.endedAt) - Date.parse(coarse.startedAt)) / 3_600_000
  const selfWindow = chooseSelfWindow(roughDurationHours)
  const selfRaw = fetchSelfSamples(
    addMinutesIso(coarse.startedAt, -EDGE_BUFFER_MINUTES),
    addMinutesIso(coarse.endedAt, EDGE_BUFFER_MINUTES),
    selfWindow,
  )
  const selfTrimmed = trimIdleEdges(selfRaw)
  if (selfTrimmed.length < 2) {
    throw new Error(`Passage ${coarse.startedAt} returned too few self samples after trimming`)
  }
  const selfSamples = evenDecimateRows(selfTrimmed, TARGET_SELF_SAMPLES)

  const start = selfSamples[0]
  const end = selfSamples[selfSamples.length - 1]
  const summary = summarizeSelfSamples(selfSamples)
  const passageId = stablePassageId(index + 1, start.t, end.t, start.lat, start.lon)
  const trackOverview = buildOverviewTrack(selfSamples, OVERVIEW_TRACK_MAX_POINTS)

  const trafficWindow = chooseTrafficWindow(summary.durationHours)
  const traffic = exportTrafficBundle(start.t, end.t, selfSamples, trafficWindow)

  const labels = resolveEndpointLabels(appleResolver, start, end)
  const title = `${labels.startLabel} → ${labels.endLabel} · ${summary.distanceNm} nm`

  return {
    v: 1,
    id: passageId,
    title,
    startedAt: start.t,
    endedAt: end.t,
    startLat: round(start.lat, 6),
    startLon: round(start.lon, 6),
    endLat: round(end.lat, 6),
    endLon: round(end.lon, 6),
    startPlaceLabel: labels.startStored,
    endPlaceLabel: labels.endStored,
    overviewTrackGeojson: trackOverview,
    summary,
    sources: {
      selfPosition: SELF_POSITION_SOURCE,
      selfNavigation: SELF_NAV_SOURCE,
      selfHeadingMagnetic: SELF_HEADING_MAG_SOURCE,
      selfMagneticVariation: SELF_MAGVAR_SOURCE,
      selfEnvironment: SELF_ENV_SOURCE,
      selfTrueWind: SELF_TRUE_WIND_SOURCE,
      selfAirTemp: SELF_AIR_TEMP_SOURCE,
      selfEnginePort: SELF_ENGINE_PORT_SOURCE,
      selfEngineStarboard: SELF_ENGINE_STARBOARD_SOURCE,
      trafficPosition: TRAFFIC_POSITION_SOURCE,
      trafficName: TRAFFIC_NAME_SOURCE,
    },
    self: {
      window: selfWindow,
      samples: selfSamples.map(toSelfSampleRecord),
    },
    traffic,
  }
}

function fetchSelfSamples(startIso, stopIso, every) {
  const raw = runInflux(fluxSelfExport(startIso, stopIso, every))
  const rows = parseAnnotatedCsv(raw)
  const out = []
  for (const row of rows) {
    const t = row._time
    const lat = numberOrNull(row.lat)
    const lon = numberOrNull(row.lon)
    if (!t || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const normalized = normalizeLatLonCaribbeanUS(lat, lon)
    const headingTrueRaw = numberOrNull(row.headingTrueRaw)
    const headingMagnetic = numberOrNull(row.headingMagnetic)
    const magneticVariation = numberOrNull(row.magneticVariation)
    const headingTrue =
      headingTrueRaw ??
      (Number.isFinite(headingMagnetic) && Number.isFinite(magneticVariation)
        ? normalizeDegrees(headingMagnetic + magneticVariation)
        : null)
    out.push({
      t,
      lat: normalized.lat,
      lon: normalized.lon,
      sog: msToKnots(numberOrNull(row.sog)),
      cog: numberOrNull(row.cog),
      headingTrue,
      headingMagnetic,
      magneticVariation,
      depth: numberOrNull(row.depth),
      waterTemp: kelvinToCelsius(numberOrNull(row.waterTemp)),
      airTemp: kelvinToCelsius(numberOrNull(row.airTemp)),
      windAppSpeed: msToKnots(numberOrNull(row.windAppSpeed)),
      windAppAngle: radiansToDegrees(numberOrNull(row.windAppAngle)),
      windTrueSpeed: msToKnots(numberOrNull(row.windTrueSpeed)),
      windTrueDirection: radiansToDegrees(numberOrNull(row.windTrueDirection)),
      portRpm: revsPerSecondToRpm(numberOrNull(row.portRpm)),
      starboardRpm: revsPerSecondToRpm(numberOrNull(row.starboardRpm)),
      barometer: pascalToHpa(numberOrNull(row.barometer)),
    })
  }

  return dedupeAndFilterTrack(out, MAX_SELF_STEP_KTS)
}

function trimIdleEdges(samples) {
  if (samples.length < 3) return samples

  let startIndex = 0
  for (let i = 0; i < samples.length; i++) {
    const prev = i > 0 ? samples[i - 1] : null
    if (isMovingSample(samples[i], prev)) {
      startIndex = Math.max(0, i - 1)
      break
    }
  }

  let endIndex = samples.length - 1
  for (let i = samples.length - 1; i >= 0; i--) {
    const prev = i > 0 ? samples[i - 1] : null
    if (isMovingSample(samples[i], prev)) {
      endIndex = Math.min(samples.length - 1, i + 1)
      break
    }
  }

  if (startIndex >= endIndex) return samples
  return samples.slice(startIndex, endIndex + 1)
}

function summarizeSelfSamples(samples) {
  let distanceNm = 0
  let maxSog = 0
  let sumSog = 0
  let countSog = 0
  for (let i = 1; i < samples.length; i++) {
    distanceNm += haversineNm(
      samples[i - 1].lat,
      samples[i - 1].lon,
      samples[i].lat,
      samples[i].lon,
    )
    if (Number.isFinite(samples[i].sog)) {
      maxSog = Math.max(maxSog, samples[i].sog)
      sumSog += samples[i].sog
      countSog++
    }
  }
  const durationHours =
    (Date.parse(samples[samples.length - 1].t) - Date.parse(samples[0].t)) / 3_600_000
  return {
    distanceNm: round(distanceNm, 1),
    durationHours: round(durationHours, 2),
    avgSog: countSog ? round(sumSog / countSog, 2) : null,
    maxSog: countSog ? round(maxSog, 2) : null,
    startBearing: samples.length > 1 ? round(trackBearing(samples[0], samples[1]), 1) : null,
    endBearing:
      samples.length > 1
        ? round(trackBearing(samples[samples.length - 2], samples[samples.length - 1]), 1)
        : null,
  }
}

function exportTrafficBundle(startIso, stopIso, ownSamples, windowEvery) {
  const bbox = computeBufferedBbox(ownSamples, TRAFFIC_BBOX_BUFFER_NM)
  const positionRows = fetchTrafficPositions(startIso, stopIso, windowEvery, bbox)
  const byContext = groupTrafficByContext(positionRows)
  const filtered = filterTrafficByProximity(byContext, ownSamples)
  const contexts = [...filtered.keys()]

  if (!contexts.length) {
    return { window: windowEvery, vessels: [] }
  }

  process.stderr.write(`  traffic contexts within ${TRAFFIC_PROXIMITY_NM} nm: ${contexts.length}\n`)

  const sogMap = fetchTrafficScalarMap(
    startIso,
    stopIso,
    windowEvery,
    contexts,
    'navigation.speedOverGround',
  )
  const cogMap = fetchTrafficScalarMap(
    startIso,
    stopIso,
    windowEvery,
    contexts,
    'navigation.courseOverGroundTrue',
  )
  const hdgMap = fetchTrafficScalarMap(
    startIso,
    stopIso,
    windowEvery,
    contexts,
    'navigation.headingTrue',
  )

  const nameMap = fetchTrafficNameMap(startIso, stopIso)
  const typeMap = fetchTrafficMetadataMap(startIso, stopIso, 'design.aisShipType')
  const lengthMap = fetchTrafficMetadataMap(startIso, stopIso, 'design.length')
  const beamMap = fetchTrafficMetadataMap(startIso, stopIso, 'design.beam')
  const draftMap = fetchTrafficMetadataMap(startIso, stopIso, 'design.draft')
  const destinationMap = fetchTrafficMetadataMap(
    startIso,
    stopIso,
    'navigation.destination.commonName',
  )
  const aisClassMap = fetchTrafficMetadataMap(startIso, stopIso, 'sensors.ais.class')
  const maxSamplesPerVessel = Math.max(
    120,
    Math.min(
      TARGET_TRAFFIC_SAMPLES_PER_VESSEL,
      Math.floor(TARGET_TRAFFIC_TOTAL_SAMPLES / contexts.length),
    ),
  )

  const vessels = []
  for (const [context, pts] of filtered) {
    const mmsi = mmsiFromContext(context)
    if (!isValidMmsi(mmsi)) continue
    if (pts.length < MIN_TRAFFIC_SAMPLES) continue

    const shipType = parseShipType(typeMap.get(context))
    const profile = {
      v: 1,
      contextUrn: context,
      mmsi,
      name: parseNameValue(nameMap.get(context)) ?? null,
      shipTypeId: shipType?.id ?? null,
      shipTypeName: shipType?.name ?? null,
      lengthM: parseDesignOverall(lengthMap.get(context)),
      beamM: parseDesignOverall(beamMap.get(context)),
      draftM: parseDesignOverall(draftMap.get(context)),
      destination: parseStringMetadata(destinationMap.get(context)),
      aisClass: parseStringMetadata(aisClassMap.get(context)),
    }

    const samples = pts.map((p) => {
      const ms = Date.parse(p.t)
      return {
        t: p.t,
        lat: round(p.lat, 6),
        lon: round(p.lon, 6),
        sog: msToKnots(
          nearestScalar(sogMap.get(context) ?? [], ms, timeWindowToleranceMs(windowEvery)),
        ),
        cog: radiansToDegrees(
          nearestScalar(cogMap.get(context) ?? [], ms, timeWindowToleranceMs(windowEvery)),
        ),
        hdg: radiansToDegrees(
          nearestScalar(hdgMap.get(context) ?? [], ms, timeWindowToleranceMs(windowEvery)),
        ),
      }
    })

    vessels.push({
      profile,
      samples: evenDecimateRows(samples, maxSamplesPerVessel),
    })
  }

  vessels.sort((a, b) => {
    const left = a.profile.name || a.profile.mmsi
    const right = b.profile.name || b.profile.mmsi
    return left.localeCompare(right)
  })

  return { window: windowEvery, vessels }
}

function fetchTrafficPositions(startIso, stopIso, every, bbox) {
  const out = []
  const chunks = splitRangeByHours(startIso, stopIso, TRAFFIC_BATCH_HOURS)
  for (const chunk of chunks) {
    const raw = runInflux(fluxTrafficPositions(chunk.start, chunk.stop, every, bbox))
    const rows = parseAnnotatedCsv(raw)
    for (const row of rows) {
      const t = row._time
      const context = row.context
      const lat = numberOrNull(row.lat)
      const lon = numberOrNull(row.lon)
      if (!t || !context || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const normalized = normalizeLatLonCaribbeanUS(lat, lon)
      out.push({
        t,
        context,
        lat: normalized.lat,
        lon: normalized.lon,
      })
    }
  }

  out.sort((a, b) => {
    if (a.context === b.context) return a.t.localeCompare(b.t)
    return a.context.localeCompare(b.context)
  })
  return dedupeAndFilterTraffic(out)
}

function groupTrafficByContext(rows) {
  const byContext = new Map()
  for (const row of rows) {
    if (!row.context?.startsWith('vessels.')) continue
    if (!byContext.has(row.context)) byContext.set(row.context, [])
    byContext.get(row.context).push(row)
  }
  return byContext
}

function filterTrafficByProximity(byContext, ownSamples) {
  const filtered = new Map()
  for (const [context, pts] of byContext) {
    let minDistance = Infinity
    const kept = []
    for (const p of pts) {
      const own = nearestTimedSample(ownSamples, Date.parse(p.t))
      if (!own) continue
      const d = haversineNm(own.lat, own.lon, p.lat, p.lon)
      minDistance = Math.min(minDistance, d)
      if (d <= TRAFFIC_PROXIMITY_NM) kept.push(p)
    }
    if (minDistance <= TRAFFIC_PROXIMITY_NM && kept.length) {
      filtered.set(context, kept)
    }
  }
  return filtered
}

function fetchTrafficScalarMap(startIso, stopIso, every, contexts, measurement) {
  if (!contexts.length) return new Map()
  const out = new Map()
  const contextBatches = chunkArray(contexts, TRAFFIC_CONTEXT_BATCH_SIZE)
  for (const batch of contextBatches) {
    const raw = runInflux(fluxTrafficScalar(startIso, stopIso, every, batch, measurement))
    const rows = parseAnnotatedCsv(raw)
    for (const row of rows) {
      const context = row.context
      const t = row._time
      const value = numberOrNull(row._value)
      if (!context || !t || !Number.isFinite(value)) continue
      if (!out.has(context)) out.set(context, [])
      out.get(context).push({ t, v: value })
    }
  }
  for (const values of out.values()) {
    values.sort((a, b) => a.t.localeCompare(b.t))
  }
  return out
}

function fetchTrafficNameMap(startIso, stopIso) {
  const raw = runInflux(
    fluxTrafficNames(addHoursIso(startIso, -TRAFFIC_METADATA_LOOKBACK_HOURS), stopIso),
  )
  const rows = parseAnnotatedCsv(raw)
  const out = new Map()
  for (const row of rows) {
    const context = row.context
    if (!context) continue
    out.set(context, row.encoded || '')
  }
  return out
}

function fetchTrafficMetadataMap(startIso, stopIso, measurement) {
  const raw = runInflux(
    fluxTrafficMetadata(
      addHoursIso(startIso, -TRAFFIC_METADATA_LOOKBACK_HOURS),
      stopIso,
      measurement,
    ),
  )
  const rows = parseAnnotatedCsv(raw)
  const out = new Map()
  for (const row of rows) {
    const context = row.context
    if (!context) continue
    out.set(context, row.encoded || '')
  }
  return out
}

function fluxSelfScan(start, stop, every) {
  return buildUnionPivotFlux(
    start,
    stop,
    every,
    [
      {
        measurement: 'navigation.position',
        field: 'lat',
        source: SELF_POSITION_SOURCE,
        series: 'lat',
      },
      {
        measurement: 'navigation.position',
        field: 'lon',
        source: SELF_POSITION_SOURCE,
        series: 'lon',
      },
      {
        measurement: 'navigation.speedOverGround',
        field: 'value',
        source: SELF_NAV_SOURCE,
        series: 'sog',
      },
    ],
    'true',
    ['_time'],
  )
}

function fluxSelfExport(start, stop, every) {
  return buildUnionPivotFlux(
    start,
    stop,
    every,
    [
      {
        measurement: 'navigation.position',
        field: 'lat',
        source: SELF_POSITION_SOURCE,
        series: 'lat',
      },
      {
        measurement: 'navigation.position',
        field: 'lon',
        source: SELF_POSITION_SOURCE,
        series: 'lon',
      },
      {
        measurement: 'navigation.speedOverGround',
        field: 'value',
        source: SELF_NAV_SOURCE,
        series: 'sog',
      },
      {
        measurement: 'navigation.courseOverGroundTrue',
        field: 'value',
        source: SELF_NAV_SOURCE,
        series: 'cog',
      },
      {
        measurement: 'navigation.headingTrue',
        field: 'value',
        source: SELF_TRUE_WIND_SOURCE,
        series: 'headingTrueRaw',
      },
      {
        measurement: 'navigation.headingMagnetic',
        field: 'value',
        source: SELF_HEADING_MAG_SOURCE,
        series: 'headingMagnetic',
      },
      {
        measurement: 'navigation.magneticVariation',
        field: 'value',
        source: SELF_MAGVAR_SOURCE,
        series: 'magneticVariation',
      },
      {
        measurement: 'environment.depth.belowTransducer',
        field: 'value',
        source: SELF_ENV_SOURCE,
        series: 'depth',
      },
      {
        measurement: 'environment.water.temperature',
        field: 'value',
        source: SELF_ENV_SOURCE,
        series: 'waterTemp',
      },
      {
        measurement: 'environment.outside.temperature',
        field: 'value',
        source: SELF_AIR_TEMP_SOURCE,
        series: 'airTemp',
      },
      {
        measurement: 'environment.wind.speedApparent',
        field: 'value',
        source: SELF_ENV_SOURCE,
        series: 'windAppSpeed',
      },
      {
        measurement: 'environment.wind.angleApparent',
        field: 'value',
        source: SELF_ENV_SOURCE,
        series: 'windAppAngle',
      },
      {
        measurement: 'environment.wind.speedTrue',
        field: 'value',
        source: SELF_TRUE_WIND_SOURCE,
        series: 'windTrueSpeed',
      },
      {
        measurement: 'environment.wind.directionTrue',
        field: 'value',
        source: SELF_TRUE_WIND_SOURCE,
        series: 'windTrueDirection',
      },
      {
        measurement: 'propulsion.port.revolutions',
        field: 'value',
        source: SELF_ENGINE_PORT_SOURCE,
        series: 'portRpm',
      },
      {
        measurement: 'propulsion.starboard.revolutions',
        field: 'value',
        source: SELF_ENGINE_STARBOARD_SOURCE,
        series: 'starboardRpm',
      },
      {
        measurement: 'environment.outside.pressure',
        field: 'value',
        source: SELF_AIR_TEMP_SOURCE,
        series: 'barometer',
      },
    ],
    'true',
    ['_time'],
  )
}

function fluxTrafficPositions(start, stop, every, bbox) {
  const lat = `
lat = from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lat"
    and r.self != "true"
    and r.source == "${TRAFFIC_POSITION_SOURCE}"
    and r.context =~ /^vessels\\./)
  |> aggregateWindow(every: ${every}, fn: last, createEmpty: false)
  |> keep(columns: ["_time", "_value", "context"])
  |> set(key: "series", value: "lat")
`.trim()

  const lon = `
lon = from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lon"
    and r.self != "true"
    and r.source == "${TRAFFIC_POSITION_SOURCE}"
    and r.context =~ /^vessels\\./)
  |> aggregateWindow(every: ${every}, fn: last, createEmpty: false)
  |> keep(columns: ["_time", "_value", "context"])
  |> set(key: "series", value: "lon")
`.trim()

  return `
${lat}

${lon}

union(tables: [lat, lon])
  |> pivot(rowKey: ["_time", "context"], columnKey: ["series"], valueColumn: "_value")
  |> filter(fn: (r) =>
    exists r.lat and exists r.lon
    and r.lat >= ${bbox.south}
    and r.lat <= ${bbox.north}
    and r.lon >= ${bbox.west}
    and r.lon <= ${bbox.east})
  |> sort(columns: ["context", "_time"])
`.trim()
}

function fluxTrafficScalar(start, stop, every, contexts, measurement) {
  return `
from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "${measurement}"
    and r._field == "value"
    and r.self != "true"
    and r.source == "${TRAFFIC_POSITION_SOURCE}"
    and (${fluxContextOrExpr(contexts)}))
  |> aggregateWindow(every: ${every}, fn: last, createEmpty: false)
  |> keep(columns: ["_time", "_value", "context"])
  |> sort(columns: ["context", "_time"])
`.trim()
}

function fluxTrafficNames(start, stop) {
  return `
import "json"

from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r.self != "true"
    and r.context =~ /^vessels\\./
    and r.source == "${TRAFFIC_NAME_SOURCE}")
  |> group(columns: ["context", "source", "_measurement", "_field"])
  |> last()
  |> map(fn: (r) => ({
    context: r.context,
    source: r.source,
    measurement_display: display(v: r._measurement),
    encoded: string(v: json.encode(v: r._value)),
  }))
  |> filter(fn: (r) => r.measurement_display == "<empty>")
  |> keep(columns: ["context", "encoded"])
`.trim()
}

function fluxTrafficMetadata(start, stop, measurement) {
  return `
import "json"

from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r.self != "true"
    and r.context =~ /^vessels\\./
    and r._measurement == "${measurement}")
  |> group(columns: ["context"])
  |> last()
  |> map(fn: (r) => ({
    context: r.context,
    encoded: string(v: json.encode(v: r._value)),
  }))
  |> keep(columns: ["context", "encoded"])
`.trim()
}

function buildUnionPivotFlux(start, stop, every, defs, selfTag, rowKeyColumns) {
  const names = []
  const parts = defs.map((def, index) => {
    const name = `q${index}`
    names.push(name)
    return `
${name} = from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "${def.measurement}"
    and r._field == "${def.field}"
    and r.self == "${selfTag}"
    and r.source == "${def.source}")
  |> aggregateWindow(every: ${every}, fn: last, createEmpty: false)
  |> keep(columns: ["_time", "_value"])
  |> set(key: "series", value: "${def.series}")
`.trim()
  })
  return `
${parts.join('\n\n')}

union(tables: [${names.join(', ')}])
  |> pivot(rowKey: [${rowKeyColumns.map((c) => `"${c}"`).join(', ')}], columnKey: ["series"], valueColumn: "_value")
  |> sort(columns: [${rowKeyColumns.map((c) => `"${c}"`).join(', ')}])
`.trim()
}

function runInflux(flux) {
  const args = ['query', '--host', INFLUX.host, '--token', INFLUX.token]
  if (INFLUX.orgId) {
    args.push('--org-id', INFLUX.orgId)
  } else {
    args.push('--org', INFLUX.orgName)
  }
  args.push('--raw', flux)

  return execFileSync('influx', args, {
    encoding: 'utf8',
    maxBuffer: QUERY_MAX_BUFFER,
  })
}

function resolveInfluxConnection() {
  const envHost = process.env.INFLUX_HOST || process.env.INFLUX_URL || ''
  if (process.env.INFLUX_TOKEN && (process.env.INFLUX_ORG_ID || process.env.INFLUX_ORG_NAME)) {
    return {
      host: envHost || DEFAULT_LIVE_INFLUX_HOST,
      token: process.env.INFLUX_TOKEN,
      orgId: process.env.INFLUX_ORG_ID || '',
      orgName: process.env.INFLUX_ORG_NAME || '',
      label: envHost ? 'env' : 'env-default-host',
    }
  }

  if (process.env.INFLUX_REPLICA_URL && process.env.INFLUX_REPLICA_ADMIN_TOKEN) {
    return {
      host: process.env.INFLUX_REPLICA_URL,
      token: process.env.INFLUX_REPLICA_ADMIN_TOKEN,
      orgId: process.env.INFLUX_REPLICA_ORG_ID || '',
      orgName: process.env.INFLUX_REPLICA_ORG_NAME || 'Tideye',
      label: 'replica-env',
    }
  }

  const cli = readInfluxCliConfig()
  if (cli) {
    return {
      host: cli.url,
      token: cli.token,
      orgId: cli.org && /^[0-9a-f]{16,}$/i.test(cli.org) ? cli.org : '',
      orgName: cli.org && !/^[0-9a-f]{16,}$/i.test(cli.org) ? cli.org : '',
      label: `cli:${cli.name}`,
    }
  }

  throw new Error('Unable to resolve Influx connection from env or ~/.influxdbv2/configs')
}

function readInfluxCliConfig() {
  const path = join(process.env.HOME || '', '.influxdbv2/configs')
  if (!path || !existsSync(path)) return null

  const raw = readFileSync(path, 'utf8')
  const lines = raw.split(/\r?\n/)
  let current = null
  const sections = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const headerMatch = /^\[([^\]]+)\]$/.exec(trimmed)
    if (headerMatch) {
      current = { name: headerMatch[1] }
      sections.push(current)
      continue
    }
    if (!current) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, '')
    current[key] = value
  }
  return sections.find((section) => section.active === 'true') || sections[0] || null
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === ',') {
      out.push(cur)
      cur = ''
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseAnnotatedCsv(raw) {
  const rows = []
  let header = null
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('#')) continue
    if (!header) {
      header = splitCsvLine(line)
      continue
    }
    const cells = splitCsvLine(line)
    const row = {}
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cells[i] ?? ''
    }
    rows.push(row)
  }
  return rows
}

function dedupeAndFilterTrack(rows, maxStepKts) {
  const deduped = []
  const byTime = new Map()
  for (const row of rows) {
    byTime.set(row.t, row)
  }
  const ordered = [...byTime.values()].sort((a, b) => a.t.localeCompare(b.t))
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue
    if (Math.abs(row.lat) > 90 || Math.abs(row.lon) > 180) continue
    const prev = deduped.length ? deduped[deduped.length - 1] : null
    if (prev) {
      const step = derivedStepKts(prev, row)
      if (step != null && step > maxStepKts) continue
    }
    deduped.push(row)
  }
  return deduped
}

function dedupeAndFilterTraffic(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const key = `${row.context}|${row.t}`
    if (seen.has(key)) continue
    seen.add(key)
    const prev = out.length ? out[out.length - 1] : null
    if (prev && prev.context === row.context) {
      const step = derivedStepKts(prev, row)
      if (step != null && step > MAX_TRAFFIC_STEP_KTS) continue
    }
    out.push(row)
  }
  return out
}

function isMovingSample(row, prev) {
  const sog = numberOrNull(row.sog)
  if (Number.isFinite(sog) && sog >= MOVING_SOG_KTS) return true
  const step = derivedStepKts(prev, row)
  return step != null && step >= MOVING_STEP_KTS
}

function derivedStepKts(prev, row) {
  if (!prev || !row) return null
  const dtMs = Date.parse(row.t) - Date.parse(prev.t)
  if (!(dtMs > 0)) return null
  const nm = haversineNm(prev.lat, prev.lon, row.lat, row.lon)
  return nm / (dtMs / 3_600_000)
}

function computeBufferedBbox(rows, bufferNm) {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  let meanLat = 0
  for (const row of rows) {
    north = Math.max(north, row.lat)
    south = Math.min(south, row.lat)
    east = Math.max(east, row.lon)
    west = Math.min(west, row.lon)
    meanLat += row.lat
  }
  meanLat /= Math.max(1, rows.length)
  const latPad = bufferNm / 60
  const lonPad = bufferNm / Math.max(1, 60 * Math.cos((meanLat * Math.PI) / 180))
  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lonPad,
    west: west - lonPad,
  }
}

function nearestTimedSample(rows, targetMs) {
  if (!rows.length) return null
  let lo = 0
  let hi = rows.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const midMs = Date.parse(rows[mid].t)
    if (midMs < targetMs) lo = mid + 1
    else hi = mid
  }
  const candA = rows[lo]
  const candB = lo > 0 ? rows[lo - 1] : null
  if (!candB) return candA
  return Math.abs(Date.parse(candA.t) - targetMs) < Math.abs(Date.parse(candB.t) - targetMs)
    ? candA
    : candB
}

function nearestScalar(points, targetMs, maxDeltaMs) {
  const nearest = nearestTimedSample(points, targetMs)
  if (!nearest) return null
  if (Math.abs(Date.parse(nearest.t) - targetMs) > maxDeltaMs) return null
  return nearest.v
}

function buildOverviewTrack(samples, maxPoints) {
  const coords = evenDecimate(
    samples.map((row) => [round(row.lon, 5), round(row.lat, 5)]),
    maxPoints,
  )
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'passage-track' },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  }
}

function toSelfSampleRecord(row) {
  return {
    t: row.t,
    lat: round(row.lat, 6),
    lon: round(row.lon, 6),
    sog: roundNullable(row.sog, 2),
    cog: roundNullable(radiansToDegrees(row.cog), 1),
    headingTrue: roundNullable(radiansToDegrees(row.headingTrue), 1),
    depth: roundNullable(row.depth, 2),
    waterTempC: roundNullable(row.waterTemp, 1),
    airTempC: roundNullable(row.airTemp, 1),
    windAppSpeedKts: roundNullable(row.windAppSpeed, 2),
    windAppAngleDeg: roundNullable(row.windAppAngle, 1),
    windTrueSpeedKts: roundNullable(row.windTrueSpeed, 2),
    windTrueDirectionDeg: roundNullable(row.windTrueDirection, 1),
    portRpm: roundNullable(row.portRpm, 0),
    starboardRpm: roundNullable(row.starboardRpm, 0),
    barometerHpa: roundNullable(row.barometer, 1),
  }
}

function chooseSelfWindow(durationHours) {
  return chooseAdaptiveWindow(durationHours, TARGET_SELF_SAMPLES, 2, 60)
}

function chooseTrafficWindow(durationHours) {
  return chooseAdaptiveWindow(durationHours, TARGET_TRAFFIC_SAMPLES_PER_VESSEL, 15, 300)
}

function chooseAdaptiveWindow(durationHours, targetSamples, minSeconds, maxSeconds) {
  const durationSeconds = Math.max(1, durationHours * 3_600)
  const rawSeconds = durationSeconds / Math.max(1, targetSamples)
  const boundedSeconds = Math.min(maxSeconds, Math.max(minSeconds, rawSeconds))
  return `${pickFriendlyStepSeconds(boundedSeconds)}s`
}

function pickFriendlyStepSeconds(seconds) {
  const candidates = [2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300]
  for (const candidate of candidates) {
    if (candidate >= seconds) return candidate
  }
  return candidates[candidates.length - 1]
}

function timeWindowToleranceMs(windowEvery) {
  const parsed = parseWindowMs(windowEvery)
  return parsed ? Math.max(parsed * 2, 60_000) : 300_000
}

function parseWindowMs(windowEvery) {
  const m = /^(\d+)(ms|s|m|h)$/.exec(windowEvery)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  if (unit === 'ms') return n
  if (unit === 's') return n * 1000
  if (unit === 'm') return n * 60_000
  if (unit === 'h') return n * 3_600_000
  return null
}

function splitRangeByDays(startIso, stopIso, days) {
  const out = []
  let start = new Date(startIso)
  const stop = new Date(stopIso)
  while (start < stop) {
    const next = new Date(start.getTime() + days * 86_400_000)
    const end = next < stop ? next : stop
    out.push({ start: start.toISOString(), stop: end.toISOString() })
    start = end
  }
  return out
}

function splitRangeByHours(startIso, stopIso, hours) {
  const out = []
  let start = new Date(startIso)
  const stop = new Date(stopIso)
  while (start < stop) {
    const next = new Date(start.getTime() + hours * 3_600_000)
    const end = next < stop ? next : stop
    out.push({ start: start.toISOString(), stop: end.toISOString() })
    start = end
  }
  return out
}

function chunkArray(values, size) {
  const out = []
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size))
  }
  return out
}

function fluxContextOrExpr(contexts) {
  if (!contexts.length) return 'false'
  return contexts.map((context) => `r.context == "${fluxEscape(context)}"`).join(' or ')
}

function fluxEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function stablePassageId(index, startIso, endIso, lat, lon) {
  const date = startIso.replace(/[-:]/g, '').slice(0, 15)
  const hash = createHash('sha1')
    .update(`${index}|${startIso}|${endIso}|${lat}|${lon}`)
    .digest('hex')
    .slice(0, 8)
  return `passage-${date}-${hash}`
}

function normalizeLatLonCaribbeanUS(lat, lon) {
  const looksSwapped =
    lat < -55 && lat > -100 && lon > 15 && lon < 45 && Math.abs(lon) < Math.abs(lat)
  if (looksSwapped) return { lat: lon, lon: lat }
  return { lat, lon }
}

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065
  const toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function trackBearing(a, b) {
  return bearingDegrees(a.lat, a.lon, b.lat, b.lon)
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180
  const y = Math.sin((lon2 - lon1) * toR) * Math.cos(lat2 * toR)
  const x =
    Math.cos(lat1 * toR) * Math.sin(lat2 * toR) -
    Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos((lon2 - lon1) * toR)
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI)
}

function normalizeDegrees(value) {
  if (!Number.isFinite(value)) return null
  let out = value % 360
  if (out < 0) out += 360
  return out
}

function evenDecimate(values, maxPoints) {
  if (values.length <= maxPoints) return values
  const out = []
  const step = Math.ceil(values.length / maxPoints)
  for (let i = 0; i < values.length; i += step) out.push(values[i])
  const last = values[values.length - 1]
  const tail = out[out.length - 1]
  if (JSON.stringify(tail) !== JSON.stringify(last)) out.push(last)
  return out
}

function evenDecimateRows(rows, maxPoints) {
  if (rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  const out = []
  for (let i = 0; i < rows.length; i += step) out.push(rows[i])
  const last = rows[rows.length - 1]
  if (out[out.length - 1]?.t !== last.t) out.push(last)
  return out
}

function numberOrNull(value) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function roundNullable(value, digits) {
  return Number.isFinite(value) ? round(value, digits) : null
}

function radiansToDegrees(value) {
  if (!Number.isFinite(value)) return null
  return normalizeDegrees((value * 180) / Math.PI)
}

function kelvinToCelsius(value) {
  if (!Number.isFinite(value)) return null
  if (value > 170) return value - 273.15
  return value
}

function pascalToHpa(value) {
  if (!Number.isFinite(value)) return null
  if (value > 10_000) return value / 100
  return value
}

function msToKnots(value) {
  if (!Number.isFinite(value)) return null
  return value * 1.9438444924406
}

function revsPerSecondToRpm(value) {
  if (!Number.isFinite(value)) return null
  return value * 60
}

function addMinutesIso(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString()
}

function addHoursIso(iso, hours) {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString()
}

function mmsiFromContext(context) {
  const match = /mmsi:(\d+)/.exec(context || '')
  return match ? match[1] : null
}

function isValidMmsi(mmsi) {
  return Boolean(mmsi && /^\d{9}$/.test(mmsi) && !/^(\d)\1{8}$/.test(mmsi))
}

function decodeEncodedJson(encoded) {
  if (!encoded) return null
  let current = encoded
  for (let i = 0; i < 2; i++) {
    try {
      const parsed = JSON.parse(current)
      if (typeof parsed === 'string') {
        current = parsed
        continue
      }
      return parsed
    } catch {
      break
    }
  }
  return null
}

function parseNameValue(encoded) {
  if (!encoded) return null
  const parsed = decodeEncodedJson(encoded)
  if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
    const name = parsed.name.trim()
    return name || null
  }
  return null
}

function parseShipType(encoded) {
  const parsed = decodeEncodedJson(encoded)
  if (!parsed || typeof parsed !== 'object') return null
  if (typeof parsed.id !== 'number') return null
  return {
    id: parsed.id,
    name: typeof parsed.name === 'string' ? parsed.name.trim() || null : null,
  }
}

function parseDesignOverall(encoded) {
  const parsed = decodeEncodedJson(encoded)
  if (typeof parsed === 'number') return parsed
  if (parsed && typeof parsed === 'object' && typeof parsed.overall === 'number') {
    return parsed.overall
  }
  return null
}

function parseStringMetadata(encoded) {
  const parsed = decodeEncodedJson(encoded)
  if (typeof parsed === 'string') {
    const s = parsed.trim()
    return s || null
  }
  return null
}

function resolveEndpointLabels(appleResolver, start, end) {
  const coordStart = formatCoordLabel(start.lat, start.lon)
  const coordEnd = formatCoordLabel(end.lat, end.lon)
  if (!appleResolver) {
    return {
      startLabel: coordStart,
      endLabel: coordEnd,
      startStored: null,
      endStored: null,
    }
  }

  try {
    const startResolved = appleResolver(start.lat, start.lon)
    const endResolved = appleResolver(end.lat, end.lon)
    const left = startResolved?.label || coordStart
    const right = endResolved?.label || coordEnd
    return {
      startLabel: left,
      endLabel: right,
      startStored: startResolved?.label || null,
      endStored: endResolved?.label || null,
    }
  } catch {
    return {
      startLabel: coordStart,
      endLabel: coordEnd,
      startStored: null,
      endStored: null,
    }
  }
}

function formatCoordLabel(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`
}

async function createAppleContextResolver() {
  const token = await getAppleMapsAccessToken()
  if (!token) return null

  const resolver = (lat, lng) => resolveContextualPlaceLabel(token, lat, lng)
  resolver.accessToken = token
  return resolver
}

async function getAppleMapsAccessToken() {
  const configuredJwt = (process.env.MAPKIT_SERVER_API_KEY || '').trim()
  const developerJwt = configuredJwt || (await maybeBuildAppleDeveloperJwt())
  if (!developerJwt) return null

  const res = await fetch('https://maps-api.apple.com/v1/token', {
    headers: { Authorization: `Bearer ${developerJwt}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.accessToken || null
}

async function maybeBuildAppleDeveloperJwt() {
  const teamId = (process.env.APPLE_TEAM_ID || '').trim()
  const keyId = (process.env.APPLE_KEY_ID || '').trim()
  const secret = (process.env.APPLE_SECRET_KEY || '').trim()
  if (!teamId || !keyId || !secret) return null

  const jose = await loadJose()
  if (!jose) return null

  const privateKey = await jose.importPKCS8(normalizePrivateKey(secret), 'ES256')
  const now = Math.floor(Date.now() / 1000)
  return await new jose.SignJWT({ appid: 'tideye' })
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 30)
    .sign(privateKey)
}

async function loadJose() {
  try {
    return await import('jose')
  } catch {
    // Fall through.
  }

  const candidate = join(
    REPO_ROOT,
    'layers/narduk-nuxt-layer/node_modules/jose/dist/webapi/index.js',
  )
  if (!existsSync(candidate)) return null
  return await import(pathToFileURL(candidate).href)
}

function normalizePrivateKey(value) {
  return value.includes('\\n') ? value.replaceAll('\\n', '\n') : value
}

function resolveContextualPlaceLabel(accessToken, lat, lng) {
  const reverse = reverseGeocodeCoordinate(accessToken, lat, lng)
  if (!reverse) return null

  const direct = pickContextualLabel(reverse)
  if (direct) return { label: direct }

  const region = smallSearchRegion(lat, lng, 10)
  const nearbyCandidates = []
  for (const query of APPLE_CONTEXT_QUERIES) {
    const nearby = searchPlaces(accessToken, query, lat, lng, region)
    nearbyCandidates.push(...nearby)
    const best = rankNearbyContextualResult(nearby, lat, lng)
    if (best) return { label: best }
  }

  const broaderRegion = smallSearchRegion(lat, lng, 24)
  for (const query of APPLE_CONTEXT_QUERIES) {
    const nearby = searchPlaces(accessToken, query, lat, lng, broaderRegion)
    nearbyCandidates.push(...nearby)
  }

  const aiLabel = disambiguateContextualLabelWithXai(lat, lng, reverse, nearbyCandidates)
  if (aiLabel) return { label: aiLabel }

  return null
}

function reverseGeocodeCoordinate(accessToken, lat, lng) {
  const url = new URL('https://maps-api.apple.com/v1/reverseGeocode')
  url.searchParams.set('loc', `${lat},${lng}`)
  url.searchParams.set('lang', APPLE_LANG)
  const res = fetchSyncJson(url.toString(), accessToken)
  return res?.results?.[0] || null
}

function searchPlaces(accessToken, query, lat, lng, region) {
  const url = new URL('https://maps-api.apple.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('lang', APPLE_LANG)
  url.searchParams.set('limit', '8')
  url.searchParams.set('searchLocation', `${lat},${lng}`)
  url.searchParams.set(
    'searchRegion',
    `${region.north},${region.east},${region.south},${region.west}`,
  )
  const res = fetchSyncJson(url.toString(), accessToken)
  return Array.isArray(res?.results) ? res.results : []
}

function fetchSyncJson(url, accessToken) {
  const buffer = execFileSync('curl', ['-sS', '-H', `Authorization: Bearer ${accessToken}`, url], {
    encoding: 'utf8',
    maxBuffer: QUERY_MAX_BUFFER,
  })
  try {
    return JSON.parse(buffer)
  } catch {
    return null
  }
}

function postSyncJson(url, apiKey, payload) {
  let buffer = ''
  try {
    buffer = execFileSync(
      'curl',
      [
        '-sS',
        '--max-time',
        '20',
        '-X',
        'POST',
        '-H',
        `Authorization: Bearer ${apiKey}`,
        '-H',
        'Content-Type: application/json',
        '--data-raw',
        JSON.stringify(payload),
        url,
      ],
      {
        encoding: 'utf8',
        maxBuffer: QUERY_MAX_BUFFER,
      },
    )
  } catch {
    return null
  }

  try {
    return JSON.parse(buffer)
  } catch {
    return null
  }
}

function summarizeAppleResult(result) {
  if (!result || typeof result !== 'object') return null
  const structured = result.structuredAddress || {}
  const bits = [
    result.name || result.displayName || null,
    structured.areasOfInterest?.[0] || null,
    structured.subLocality || null,
    structured.locality || null,
    structured.administrativeArea || null,
    result.country || null,
  ].filter((value) => typeof value === 'string' && value.trim())
  return bits.length ? bits.join(' | ') : null
}

function collectNearbyContextualCandidates(results, lat, lng) {
  const seen = new Set()
  const candidates = []

  for (const result of results) {
    const label = cleanContextualLabel(result?.name || result?.displayName)
    if (!label || isGenericContextualLabel(label, result)) continue

    const resLat = numberOrNull(result?.coordinate?.latitude)
    const resLon = numberOrNull(result?.coordinate?.longitude)
    if (!Number.isFinite(resLat) || !Number.isFinite(resLon)) continue

    const key = normalizeContextualKey(label)
    if (seen.has(key)) continue
    seen.add(key)

    candidates.push({
      label,
      distanceNm: haversineNm(lat, lng, resLat, resLon),
      poiCategory: typeof result?.poiCategory === 'string' ? result.poiCategory : null,
    })
  }

  candidates.sort((left, right) => left.distanceNm - right.distanceNm)
  return candidates.slice(0, 12)
}

function parseXaiContextualLabel(payload) {
  const content = payload?.choices?.[0]?.message?.content?.trim() || ''
  if (!content) return null

  const match = content.match(/\{[\s\S]*\}/)
  const candidatePayload = match ? match[0] : content

  try {
    const parsed = JSON.parse(candidatePayload)
    const cleaned = cleanContextualLabel(parsed?.label)
    return cleaned && !GENERIC_CONTEXTUAL_LABELS.has(normalizeContextualKey(cleaned))
      ? cleaned
      : null
  } catch {
    const cleaned = cleanContextualLabel(content.replace(/^label\s*:\s*/i, '').trim())
    return cleaned && !GENERIC_CONTEXTUAL_LABELS.has(normalizeContextualKey(cleaned))
      ? cleaned
      : null
  }
}

function disambiguateContextualLabelWithXai(lat, lng, reverse, nearbyResults) {
  if (!XAI_API_KEY) return null

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (CONTEXTUAL_AI_CACHE.has(cacheKey)) {
    return CONTEXTUAL_AI_CACHE.get(cacheKey) || null
  }

  const reverseSummary = summarizeAppleResult(reverse)
  const nearbyCandidates = collectNearbyContextualCandidates(nearbyResults, lat, lng)
  if (!nearbyCandidates.length) {
    CONTEXTUAL_AI_CACHE.set(cacheKey, null)
    return null
  }

  const payload = postSyncJson('https://api.x.ai/v1/chat/completions', XAI_API_KEY, {
    model: XAI_CONTEXT_MODEL,
    temperature: 0.2,
    store: false,
    messages: [
      {
        role: 'system',
        content:
          'You label sailing legs for cruisers. Return JSON only in the form {"label": string|null}. If the coordinate is offshore, choose the nearest familiar local place name sailors would actually use to describe that area. Prefer well-known cays, islands, anchorages, harbors, bays, marinas, settlements, or towns over obscure cuts, channels, or chart-only micro-features. Only use a cut or channel name when it is clearly the common cruising reference. Never return a country, state, address, or broad water body. Only return {"label": null} if no nearby specific place is available.',
      },
      {
        role: 'user',
        content: [
          `Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          reverseSummary ? `Apple reverse geocode: ${reverseSummary}` : null,
          nearbyCandidates.length
            ? `Nearby Apple candidates:\n${nearbyCandidates
                .map((candidate) => {
                  const suffix = candidate.poiCategory
                    ? ` (${candidate.poiCategory}, ${candidate.distanceNm.toFixed(1)} nm)`
                    : ` (${candidate.distanceNm.toFixed(1)} nm)`
                  return `- ${candidate.label}${suffix}`
                })
                .join('\n')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  })

  const label = parseXaiContextualLabel(payload)
  CONTEXTUAL_AI_CACHE.set(cacheKey, label || null)
  return label || null
}

function pickContextualLabel(result) {
  if (!result || typeof result !== 'object') return null
  const structured = result.structuredAddress || {}
  const candidates = [
    result.name,
    structured.areasOfInterest?.[0],
    structured.subLocality,
    structured.locality,
    structured.dependentLocalities?.[0],
  ]
  for (const candidate of candidates) {
    const cleaned = cleanContextualLabel(candidate)
    if (cleaned && !isGenericContextualLabel(cleaned, result)) return cleaned
  }
  return null
}

function rankNearbyContextualResult(results, lat, lng) {
  let best = null
  let bestScore = -Infinity
  for (const result of results) {
    const cleaned = cleanContextualLabel(result?.name || result?.displayName)
    if (!cleaned || isGenericContextualLabel(cleaned, result)) continue
    const resLat = numberOrNull(result?.coordinate?.latitude)
    const resLon = numberOrNull(result?.coordinate?.longitude)
    if (!Number.isFinite(resLat) || !Number.isFinite(resLon)) continue
    const distanceNm = haversineNm(lat, lng, resLat, resLon)
    const marineBoost = isSpecificMarinePlaceLabel(cleaned) ? 4 : 0
    const score = marineBoost - distanceNm
    if (score > bestScore) {
      bestScore = score
      best = cleaned
    }
  }
  return best
}

function cleanContextualLabel(value) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  if (isAddressLike(cleaned)) return null
  return cleaned
}

function normalizeContextualKey(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isSpecificMarinePlaceLabel(value) {
  return /\b(?:marina|harbor|harbour|port|anchorage|bay|inlet|cay|island|sound|channel|river|creek|point|shoal)\b/i.test(
    value,
  )
}

function isGenericContextualLabel(value, result) {
  const key = normalizeContextualKey(value)
  if (!key) return true
  if (GENERIC_CONTEXTUAL_LABELS.has(key)) return true
  if (isSpecificMarinePlaceLabel(value)) return false

  const structured = result?.structuredAddress || {}
  return [
    result?.country,
    structured.administrativeArea,
    structured.locality,
    structured.subLocality,
  ].some((candidate) => normalizeContextualKey(candidate) === key)
}

function isAddressLike(value) {
  return (
    /^\d/.test(value) ||
    /\b(st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court)\b/i.test(value)
  )
}

function smallSearchRegion(lat, lng, radiusNm) {
  const latDelta = radiusNm / 60
  const lonDelta = radiusNm / Math.max(1, 60 * Math.cos((lat * Math.PI) / 180))
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lonDelta,
    west: lng - lonDelta,
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
