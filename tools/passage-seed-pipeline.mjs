#!/usr/bin/env node
/**
 * Two-phase passage (voyage) export from InfluxDB:
 *
 * Phase A — 6-month batches, 1h mean positions (merged across S2 cells):
 *   Tag "moving" UTC days from hourly track length + displacement.
 *
 * Phase A2 — For those moving days only, re-query Influx with 10m windows (batched
 *   ranges of consecutive moving days) and replace each day's first/last fix and path
 *   metrics so short same-day hops are not washed out by hourly smoothing.
 *
 * Then cluster moving days into voyages. Stored distance is great-circle start→end
 *   (not sum of daily hops) to avoid inflated nm from zig-zag / noise.
 *
 * Phase B — Per voyage, mean positions for the time range (+ buffer) to build a GeoJSON
 *   LineString for map polylines (decimated for SQL size). Window via PASSAGE_TRACK_WINDOW
 *   (default 5m for smoother tracks; use 10m to match older seeds).
 *
 * Phase C — Sub-daily segmentation (optional): long voyages (see env) are split on
 *   multi-hour low-speed + tight-radius “anchor” runs in the 10 m track (Charleston→Bahamas → legs).
 *
 * Phase D — Playback JSON (optional): aligned track-window means for SOG, COG, STW, true wind
 *   (batched Influx scalar queries, capped samples). `vessels[]` reserved for future AIS summaries.
 *
 * Output: apps/web/drizzle/seed-passages.sql
 *
 * Usage (from repo root):
 *   doppler run --project tideye --config prd -- node tools/passage-seed-pipeline.mjs
 *
 * Env: INFLUX_TOKEN, INFLUX_ORG_ID, INFLUX_BUCKET_MAIN,
 *      INFLUX_HOST (optional)
 * Sources (one canonical tag per family — do not mix):
 *   INFLUX_SOURCE_POSITION or INFLUX_POSITION_SOURCE — self lat/lon, tracks, proximity (default ydg-nmea-2000.2)
 *   INFLUX_SOURCE_NAVIGATION — SOG, COG, STW, heading (defaults to position source)
 *   INFLUX_SOURCE_ENVIRONMENT — wind (defaults to position source)
 *   INFLUX_SOURCE_AIS — other-vessel positions/scalars in Flux (defaults to position source)
 *
 * Tuning (optional):
 *   PASSAGE_RANGE_START, PASSAGE_RANGE_STOP (ISO)
 *   PASSAGE_MOVING_PATH_NM — min within-day path length (hourly legs) to count as moving (default 4)
 *   PASSAGE_MOVING_DISP_NM — or min same-day displacement first→last hour (default 3)
 *   PASSAGE_MAX_GAP_DAYS — max calendar gap between moving days in one voyage (default 3)
 *   PASSAGE_MIN_MOVING_DAYS — min moving days per voyage (default 1; use 2 to merge only multi-day)
 *   PASSAGE_MIN_GC_NM — min GC nm first-hour→last-hour across voyage (default 10)
 *   PASSAGE_STATIONARY_PATH_NM — within-day path below this counts as “anchored” for break detection (default 2.5)
 *   PASSAGE_STATIONARY_DISP_NM — within-day first→last displacement below this = anchored (default 2)
 *   PASSAGE_MIN_STATIONARY_BREAK_DAYS — split voyages when this many full anchored UTC days fall between
 *     two moving days (even if calendar gap ≤ MAX_GAP_DAYS). Cuts Charleston→FL from a later ICW leg when you
 *     truly stopped reporting movement (default 2)
 *   MAPKIT_SERVER_API_KEY — optional; if set, titles use Apple reverse geocode (start→end)
 *   PASSAGE_TITLE_COORDS_ONLY=1 — skip Apple; titles are lat/lon labels only
 *   PASSAGE_TRACK_BUFFER_H — hours padded before/after voyage for track query (default 12)
 *   PASSAGE_TRACK_WINDOW — Influx aggregateWindow for Phase B + playback (default: 5m)
 *   PASSAGE_TRACK_MAX_POINTS — decimation cap per voyage LineString (default 1000; D1 INSERT ≤100KB)
 *   PASSAGE_SKIP_TRACKS=1 — skip phase B (faster)
 *   PASSAGE_SKIP_MOVING_DAY_10M=1 — skip phase A2; use 1h-only day endpoints
 *   PASSAGE_SUBDAILY_SPLIT=0 — disable stop-based splitting of long voyages (default: on)
 *   PASSAGE_SUBDAILY_MAX_RANK — only first N voyages chronologically eligible for stop-split (default: 999 ≈ all)
 *   PASSAGE_SUBDAILY_MIN_VOYAGE_NM — min GC nm to attempt split (default: 150)
 *   PASSAGE_SUBDAILY_SLOW_KT — median speed below this = “slow” sample (default: 1.35)
 *   PASSAGE_SUBDAILY_MIN_STOP_H — min duration of a slow run to count as a stop (default: 3)
 *   PASSAGE_SUBDAILY_SLOW_RUNS — min consecutive slow 10 m samples (default: 6 ≈ 1 h)
 *   PASSAGE_SUBDAILY_MIN_SEGMENT_NM — merge shorter legs (default: 10)
 *   PASSAGE_SUBDAILY_MAX_TRACK_POINTS — cap Influx rows for split analysis (default: 10000)
 *   PASSAGE_PLAYBACK_ENRICH=0 — skip SOG/COG/STW/wind merge into playback_json (default: on)
 *   PASSAGE_PLAYBACK_MAX_PASSAGES — only enrich first N rows after expansion (default: 8; raises Influx load)
 *   PASSAGE_PLAYBACK_MAX_SAMPLES — cap playback samples per passage (default: 380; keeps INSERT <100KB)
 *   PASSAGE_INFLUX_SOG / _COG / _STW / _WIND_SPD / _WIND_DIR — measurement names if your bucket differs
 *
 * Phase E — passage_ais_vessels in D1: other AIS targets (Influx only at seed; self != true, vessels.* context).
 *   PASSAGE_TRAFFIC_EXPORT=0 — skip (default: on). PASSAGE_TRAFFIC_MAX_PASSAGES (default: PLAYBACK_MAX_PASSAGES).
 *   PASSAGE_TRAFFIC_WINDOW, PASSAGE_TRAFFIC_MAX_NM, PASSAGE_TRAFFIC_MAX_VESSELS, PASSAGE_TRAFFIC_MAX_SAMPLES
 *
 * AIS row rules: Flux keeps rows where context starts with `vessels.urn:mrn:imo:mmsi:` (MMSI from URN suffix).
 * Self vessel is excluded via the same position source / self filters as Phase B. Decimation and per-passage caps
 * are env-driven (see above). Measurements queried for traffic match the AIS family (position + SOG/COG/heading fields).
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SEED_OUT = join(REPO_ROOT, 'apps/web/drizzle/seed-passages.sql')
const CACHE_HOURLY = join(REPO_ROOT, 'tools/.passage-hourly-cache.jsonl')

const INFLUX_HOST = process.env.INFLUX_HOST || 'http://tideye-server.curl-banjo.ts.net:8086'
const TOKEN = process.env.INFLUX_TOKEN
const ORG_ID = process.env.INFLUX_ORG_ID
const BUCKET = process.env.INFLUX_BUCKET_MAIN || 'Tideye'
const SOURCE_POSITION =
  process.env.INFLUX_SOURCE_POSITION || process.env.INFLUX_POSITION_SOURCE || 'ydg-nmea-2000.2'
const SOURCE_NAVIGATION = process.env.INFLUX_SOURCE_NAVIGATION || SOURCE_POSITION
const SOURCE_ENVIRONMENT = process.env.INFLUX_SOURCE_ENVIRONMENT || SOURCE_POSITION
const SOURCE_AIS = process.env.INFLUX_SOURCE_AIS || SOURCE_POSITION

const RANGE_START = process.env.PASSAGE_RANGE_START || '2023-11-01T00:00:00Z'
const RANGE_STOP = process.env.PASSAGE_RANGE_STOP || '2026-01-01T00:00:00Z'

const WINDOW_1H = '1h'
const WINDOW_10M = '10m'
/** Phase B map track + playback scalar alignment (finer than Phase A2 / subdaily split). */
const WINDOW_TRACK = (process.env.PASSAGE_TRACK_WINDOW || '5m').trim()

const MOVING_PATH_NM = Number(process.env.PASSAGE_MOVING_PATH_NM) || 4
const MOVING_DISP_NM = Number(process.env.PASSAGE_MOVING_DISP_NM) || 3
const MAX_GAP_DAYS = Number(process.env.PASSAGE_MAX_GAP_DAYS) || 3
const MIN_MOVING_DAYS = Number(process.env.PASSAGE_MIN_MOVING_DAYS) || 1
const MIN_GC_NM = Number(process.env.PASSAGE_MIN_GC_NM) || 10
const STATIONARY_PATH_NM = Number(process.env.PASSAGE_STATIONARY_PATH_NM) || 2.5
const STATIONARY_DISP_NM = Number(process.env.PASSAGE_STATIONARY_DISP_NM) || 2
const MIN_STATIONARY_BREAK_DAYS = Number(process.env.PASSAGE_MIN_STATIONARY_BREAK_DAYS) || 2
const TITLE_COORDS_ONLY = process.env.PASSAGE_TITLE_COORDS_ONLY === '1'
const NOISE_LEG_NM = Number(process.env.PASSAGE_NOISE_LEG_NM) || 0.04

const TRACK_BUFFER_H = Number(process.env.PASSAGE_TRACK_BUFFER_H) || 12
const TRACK_MAX_POINTS = Number(process.env.PASSAGE_TRACK_MAX_POINTS) || 1000
const SKIP_TRACKS = process.env.PASSAGE_SKIP_TRACKS === '1'
const SKIP_MOVING_DAY_10M = process.env.PASSAGE_SKIP_MOVING_DAY_10M === '1'

const SUBDAILY_SPLIT = process.env.PASSAGE_SUBDAILY_SPLIT !== '0'
const SUBDAILY_MAX_RANK_RAW =
  process.env.PASSAGE_SUBDAILY_MAX_RANK !== undefined && process.env.PASSAGE_SUBDAILY_MAX_RANK !== ''
    ? Number(process.env.PASSAGE_SUBDAILY_MAX_RANK)
    : 999
const SUBDAILY_MAX_RANK = Number.isFinite(SUBDAILY_MAX_RANK_RAW) ? SUBDAILY_MAX_RANK_RAW : 999
const SUBDAILY_MIN_VOYAGE_NM = Number(process.env.PASSAGE_SUBDAILY_MIN_VOYAGE_NM) || 150
const SUBDAILY_SLOW_KT = Number(process.env.PASSAGE_SUBDAILY_SLOW_KT) || 1.35
const SUBDAILY_MIN_STOP_H = Number(process.env.PASSAGE_SUBDAILY_MIN_STOP_H) || 3
const SUBDAILY_SLOW_RUNS = Number(process.env.PASSAGE_SUBDAILY_SLOW_RUNS) || 6
const SUBDAILY_MIN_SEGMENT_NM = Number(process.env.PASSAGE_SUBDAILY_MIN_SEGMENT_NM) || 10
const SUBDAILY_MAX_TRACK_POINTS = Number(process.env.PASSAGE_SUBDAILY_MAX_TRACK_POINTS) || 10_000
const SUBDAILY_STOP_MAX_RADIUS_NM = Number(process.env.PASSAGE_SUBDAILY_STOP_MAX_RADIUS_NM) || 15

const PLAYBACK_ENRICH = process.env.PASSAGE_PLAYBACK_ENRICH !== '0'
const PLAYBACK_MAX_PASSAGES = Number(process.env.PASSAGE_PLAYBACK_MAX_PASSAGES) || 8
const PLAYBACK_MAX_SAMPLES = Number(process.env.PASSAGE_PLAYBACK_MAX_SAMPLES) || 380

const MEAS_SOG = process.env.PASSAGE_INFLUX_SOG || 'navigation.speedOverGround'
const MEAS_COG = process.env.PASSAGE_INFLUX_COG || 'navigation.courseOverGroundTrue'
const MEAS_STW = process.env.PASSAGE_INFLUX_STW || 'navigation.speedThroughWater'
const MEAS_WIND_SPD = process.env.PASSAGE_INFLUX_WIND_SPD || 'environment.wind.speedTrue'
const MEAS_WIND_DIR = process.env.PASSAGE_INFLUX_WIND_DIR || 'environment.wind.directionTrue'
const MEAS_HEADING = process.env.PASSAGE_INFLUX_HEADING || 'navigation.headingTrue'

const TRAFFIC_EXPORT = process.env.PASSAGE_TRAFFIC_EXPORT !== '0'
const TRAFFIC_MAX_PASSAGES = Number(process.env.PASSAGE_TRAFFIC_MAX_PASSAGES) || PLAYBACK_MAX_PASSAGES
const TRAFFIC_WINDOW = (process.env.PASSAGE_TRAFFIC_WINDOW || WINDOW_TRACK).trim()
const TRAFFIC_MAX_NM = Number(process.env.PASSAGE_TRAFFIC_MAX_NM) || 22
const TRAFFIC_MAX_VESSELS = Number(process.env.PASSAGE_TRAFFIC_MAX_VESSELS) || 100
const TRAFFIC_MAX_SAMPLES = Number(process.env.PASSAGE_TRAFFIC_MAX_SAMPLES) || 400

/** Cap raw track-window points per voyage before coord decimation (Phase B). */
const TRACK_FETCH_MAX_POINTS = Number(process.env.PASSAGE_TRACK_FETCH_MAX_POINTS) || 100_000

const INFLUX_MAX_BUFFER = 96 * 1024 * 1024

function* eachUtcSixMonths(startIso, stopIso) {
  let cur = new Date(startIso)
  const end = new Date(stopIso)
  while (cur < end) {
    const start = cur.toISOString()
    const next = new Date(cur.getTime())
    next.setUTCMonth(next.getUTCMonth() + 6)
    const sliceStop = next > end ? end : next
    yield { start, stop: sliceStop.toISOString() }
    cur = sliceStop
  }
}

function fluxForRange(start, stop, windowEvery) {
  return `
lat = from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lat"
    and r.self == "true"
    and r.source == "${SOURCE_POSITION}")
  |> aggregateWindow(every: ${windowEvery}, fn: mean, createEmpty: false)
  |> group(columns: ["_time"])
  |> mean(column: "_value")
  |> set(key: "_field", value: "lat")

lon = from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lon"
    and r.self == "true"
    and r.source == "${SOURCE_POSITION}")
  |> aggregateWindow(every: ${windowEvery}, fn: mean, createEmpty: false)
  |> group(columns: ["_time"])
  |> mean(column: "_value")
  |> set(key: "_field", value: "lon")

union(tables: [lat, lon])
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
`.trim()
}

function runInflux(flux) {
  return execFileSync(
    'influx',
    ['query', '--host', INFLUX_HOST, '--token', TOKEN, '--org-id', ORG_ID, '--raw', flux],
    { encoding: 'utf8', maxBuffer: INFLUX_MAX_BUFFER },
  )
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function parseInfluxCsv(raw) {
  const lines = raw.split('\n')
  let v1 = 'lon'
  let v2 = 'lat'
  for (const line of lines) {
    if (!line.startsWith(',result,table,')) continue
    const parts = line.split(',')
    const ti = parts.indexOf('_time')
    if (ti !== -1 && ti + 2 < parts.length) {
      v1 = parts[ti + 1]
      v2 = parts[ti + 2]
    }
    break
  }

  const rows = []
  for (const line of lines) {
    if (!line.startsWith(',,')) continue
    const cells = line.split(',')
    const timeIdx = cells.findIndex((c) => ISO.test(c))
    if (timeIdx === -1) continue
    const t = cells[timeIdx]
    const a = Number.parseFloat(cells[timeIdx + 1])
    const b = Number.parseFloat(cells[timeIdx + 2])
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    let lat
    let lon
    if (v1 === 'lat' && v2 === 'lon') {
      lat = a
      lon = b
    } else {
      lon = a
      lat = b
    }
    rows.push({ t, ...normalizeLatLonCaribbeanUS(lat, lon) })
  }
  return rows
}

function normalizeLatLonCaribbeanUS(lat, lon) {
  const latLooksLikeLon =
    lat < -55 && lat > -100 && lon > 15 && lon < 45 && Math.abs(lon) < Math.abs(lat)
  if (latLooksLikeLon) {
    return { lat: lon, lon: lat }
  }
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

/** Calendar days between UTC date keys YYYY-MM-DD */
function calendarGapDays(dateKeyA, dateKeyB) {
  const a = Date.parse(`${dateKeyA}T12:00:00Z`)
  const b = Date.parse(`${dateKeyB}T12:00:00Z`)
  return Math.round(Math.abs(b - a) / 86_400_000)
}

function utcDayKey(iso) {
  return iso.slice(0, 10)
}

/** Next calendar date key after `dk` (UTC). */
function dateKeyPlusOne(dk) {
  const ms = Date.parse(`${dk}T12:00:00Z`) + 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

function groupRowsByUtcDay(rows) {
  const byDay = new Map()
  for (const r of rows) {
    const dayKey = utcDayKey(r.t)
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey).push(r)
  }
  return byDay
}

/**
 * @param {{ t: string, lat: number, lon: number }[]} pts
 * @param {{ requireMoving?: boolean }} [options]
 */
function summarizeDayFromPoints(pts, dateKey, options = {}) {
  const requireMoving = options.requireMoving !== false
  if (!pts || pts.length === 0) return null
  const sorted = [...pts].sort((a, b) => a.t.localeCompare(b.t))

  let pathNm = 0
  for (let i = 1; i < sorted.length; i++) {
    const leg = haversineNm(sorted[i - 1].lat, sorted[i - 1].lon, sorted[i].lat, sorted[i].lon)
    if (leg >= NOISE_LEG_NM) pathNm += leg
  }
  const disp = haversineNm(
    sorted[0].lat,
    sorted[0].lon,
    sorted[sorted.length - 1].lat,
    sorted[sorted.length - 1].lon,
  )

  const isMoving = pathNm >= MOVING_PATH_NM || disp >= MOVING_DISP_NM
  if (requireMoving && !isMoving) return null

  const meanLat = sorted.reduce((s, p) => s + p.lat, 0) / sorted.length
  const meanLon = sorted.reduce((s, p) => s + p.lon, 0) / sorted.length
  const p0 = sorted[0]
  const p1 = sorted[sorted.length - 1]
  return {
    dateKey,
    firstT: p0.t,
    lastT: p1.t,
    startLat: p0.lat,
    startLon: p0.lon,
    endLat: p1.lat,
    endLon: p1.lon,
    lat: meanLat,
    lon: meanLon,
    pathNm,
    dispNm: disp,
    isMoving,
  }
}

/**
 * Group hourly rows by UTC day; classify moving days; return one summary per moving day.
 */
function hourlyToMovingDays(hourlyRows) {
  const byDay = groupRowsByUtcDay(hourlyRows)
  const moving = []
  for (const dk of [...byDay.keys()].sort()) {
    const pts = byDay.get(dk)
    const summ = summarizeDayFromPoints(pts, dk, { requireMoving: true })
    if (!summ) continue
    moving.push({
      dateKey: dk,
      firstT: summ.firstT,
      lastT: summ.lastT,
      startLat: summ.startLat,
      startLon: summ.startLon,
      endLat: summ.endLat,
      endLon: summ.endLon,
      lat: summ.lat,
      lon: summ.lon,
      pathNm: summ.pathNm,
      dispNm: summ.dispNm,
    })
  }
  return moving
}

/**
 * Merge consecutive moving-day keys (calendar gap ≤ 1) into minimal [start, stop) flux ranges.
 */
function mergeMovingDayKeysToRanges(sortedDateKeys) {
  if (sortedDateKeys.length === 0) return []
  const ranges = []
  let rangeStart = sortedDateKeys[0]
  let rangeEnd = sortedDateKeys[0]
  for (let i = 1; i < sortedDateKeys.length; i++) {
    const dk = sortedDateKeys[i]
    const gap = calendarGapDays(rangeEnd, dk)
    if (gap <= 1) {
      rangeEnd = dk
    } else {
      ranges.push({
        start: `${rangeStart}T00:00:00Z`,
        stop: `${dateKeyPlusOne(rangeEnd)}T00:00:00Z`,
      })
      rangeStart = dk
      rangeEnd = dk
    }
  }
  ranges.push({
    start: `${rangeStart}T00:00:00Z`,
    stop: `${dateKeyPlusOne(rangeEnd)}T00:00:00Z`,
  })
  return ranges
}

/**
 * Re-summarize each moving day using 10m points when available (≥2 samples), else hourly.
 */
function refineMovingDaysWithTenMinute(movingDays, hourlyByDay, tenMinByDay) {
  const byKey = new Map(movingDays.map((d) => [d.dateKey, d]))
  const sortedKeys = [...byKey.keys()].sort()
  const out = []
  for (const dk of sortedKeys) {
    const fallback = byKey.get(dk)
    const tenPts = tenMinByDay.get(dk)
    const hourPts = hourlyByDay.get(dk)
    const tenSorted = tenPts ? [...tenPts].sort((a, b) => a.t.localeCompare(b.t)) : []
    const hourSorted = hourPts ? [...hourPts].sort((a, b) => a.t.localeCompare(b.t)) : []
    const pts = tenSorted.length >= 2 ? tenSorted : hourSorted
    const summ = summarizeDayFromPoints(pts, dk, { requireMoving: false })
    if (!summ) {
      out.push(fallback)
      continue
    }
    out.push({
      dateKey: dk,
      firstT: summ.firstT,
      lastT: summ.lastT,
      startLat: summ.startLat,
      startLon: summ.startLon,
      endLat: summ.endLat,
      endLon: summ.endLon,
      lat: summ.lat,
      lon: summ.lon,
      pathNm: summ.pathNm,
      dispNm: summ.dispNm,
    })
  }
  return out
}

/** Per-UTC-day metrics for every day that has hourly points (moving or not). */
function buildAllDaySummariesFromHourly(hourlyRows) {
  const byDay = groupRowsByUtcDay(hourlyRows)
  const map = new Map()
  for (const [dk, pts] of byDay) {
    const s = summarizeDayFromPoints(pts, dk, { requireMoving: false })
    if (s) map.set(dk, s)
  }
  return map
}

/** Count UTC days strictly between two moving days where track looks anchored (low path + low displacement). */
function countStationaryDaysBetween(startMovingDateKey, endMovingDateKey, byDaySummary) {
  let dk = dateKeyPlusOne(startMovingDateKey)
  let count = 0
  while (dk < endMovingDateKey) {
    const s = byDaySummary.get(dk)
    if (s && s.pathNm < STATIONARY_PATH_NM && s.dispNm < STATIONARY_DISP_NM) {
      count++
    }
    dk = dateKeyPlusOne(dk)
  }
  return count
}

/**
 * Cluster moving days into voyages:
 * - Split if calendar gap > MAX_GAP_DAYS, or
 * - Split if ≥ MIN_STATIONARY_BREAK_DAYS anchored UTC days (per hourly track) lie strictly between two moving days.
 * Endpoints = first fix of first moving day → last fix of last moving day.
 */
function clusterMovingDaysToVoyages(movingDays, byDaySummary) {
  const sorted = [...movingDays].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  /** @type {typeof sorted[] } */
  const clusters = []
  let cur = []

  for (const d of sorted) {
    if (cur.length === 0) {
      cur.push(d)
      continue
    }
    const prev = cur[cur.length - 1]
    const gap = calendarGapDays(prev.dateKey, d.dateKey)
    const stationaryBetween = countStationaryDaysBetween(prev.dateKey, d.dateKey, byDaySummary)
    const splitByGap = gap > MAX_GAP_DAYS
    const splitByAnchor = stationaryBetween >= MIN_STATIONARY_BREAK_DAYS
    if (splitByGap || splitByAnchor) {
      if (cur.length >= MIN_MOVING_DAYS) clusters.push(cur)
      cur = [d]
    } else {
      cur.push(d)
    }
  }
  if (cur.length >= MIN_MOVING_DAYS) clusters.push(cur)

  const voyages = []
  for (const seg of clusters) {
    const first = seg[0]
    const last = seg[seg.length - 1]
    const startLat = first.startLat
    const startLon = first.startLon
    const endLat = last.endLat
    const endLon = last.endLon
    const gc = haversineNm(startLat, startLon, endLat, endLon)
    if (gc < MIN_GC_NM) continue

    voyages.push({
      startedAt: first.firstT,
      endedAt: last.lastT,
      startLat,
      startLon,
      endLat,
      endLon,
      distanceNm: Math.round(gc * 10) / 10,
      movingDayCount: seg.length,
    })
  }
  return voyages
}

function formatCoordLabel(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`
}

function truncateTitle(s, max = 42) {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function coordinateTitle(v) {
  const a = formatCoordLabel(v.startLat, v.startLon)
  const b = formatCoordLabel(v.endLat, v.endLon)
  return `${a} → ${b} · ${v.distanceNm} nm`
}

let cachedMapsAccessToken = ''
let cachedMapsAccessTokenExp = 0

async function getMapsAccessTokenForTitles() {
  if (TITLE_COORDS_ONLY) return null
  const jwt = (process.env.MAPKIT_SERVER_API_KEY || '').trim()
  if (!jwt) return null
  if (!jwt.startsWith('eyJ')) {
    process.stderr.write(
      'Note: MAPKIT_SERVER_API_KEY must be a Maps Auth JWT (starts with eyJ…) for place-name titles; using coordinates.\n',
    )
    return null
  }
  const now = Date.now()
  if (cachedMapsAccessToken && now < cachedMapsAccessTokenExp) return cachedMapsAccessToken
  const res = await fetch('https://maps-api.apple.com/v1/token', {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  const at = data.accessToken
  if (!at) return null
  const sec = data.expiresInSeconds ?? 300
  cachedMapsAccessToken = at
  cachedMapsAccessTokenExp = now + Math.max(60, sec) * 1000 - 30_000
  return at
}

function pickGeocodeName(result) {
  if (!result || typeof result !== 'object') return null
  if (result.name) return String(result.name)
  const lines = result.formattedAddressLines
  if (Array.isArray(lines) && lines[0]) return String(lines[0])
  const loc = result.structuredAddress?.locality
  if (loc) return String(loc)
  return null
}

async function reverseGeocodeTitlePoint(accessToken, lat, lng) {
  const url = new URL('https://maps-api.apple.com/v1/reverseGeocode')
  url.searchParams.set('loc', `${lat},${lng}`)
  url.searchParams.set('lang', 'en-US')
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  const r = data.results?.[0]
  return pickGeocodeName(r)
}

const PLACE_LABEL_STORE_MAX = 200

async function voyageTitleAndLabels(v, accessToken) {
  const coordTitle = coordinateTitle(v)
  if (!accessToken) {
    return { title: coordTitle, startPlaceLabel: null, endPlaceLabel: null }
  }
  try {
    const [nameA, nameB] = await Promise.all([
      reverseGeocodeTitlePoint(accessToken, v.startLat, v.startLon),
      reverseGeocodeTitlePoint(accessToken, v.endLat, v.endLon),
    ])
    const left = nameA ? truncateTitle(nameA, 40) : formatCoordLabel(v.startLat, v.startLon)
    const right = nameB ? truncateTitle(nameB, 40) : formatCoordLabel(v.endLat, v.endLon)
    const title = `${left} → ${right} · ${v.distanceNm} nm`
    const startPlaceLabel = nameA ? String(nameA).slice(0, PLACE_LABEL_STORE_MAX) : null
    const endPlaceLabel = nameB ? String(nameB).slice(0, PLACE_LABEL_STORE_MAX) : null
    return { title, startPlaceLabel, endPlaceLabel }
  } catch {
    return { title: coordTitle, startPlaceLabel: null, endPlaceLabel: null }
  }
}

function sqlEscape(s) {
  return s.replaceAll("'", "''")
}

function decimateCoords(coords, maxPts) {
  if (coords.length <= maxPts) return coords
  const step = Math.ceil(coords.length / maxPts)
  const out = []
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[i])
  }
  const last = coords[coords.length - 1]
  const tail = out[out.length - 1]
  if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last)
  return out
}

function roundCoordPairs(coordsLonLat, digits = 5) {
  const f = 10 ** digits
  return coordsLonLat.map(([lon, lat]) => [Math.round(lon * f) / f, Math.round(lat * f) / f])
}

function buildTrackFeatureCollection(coordsLonLat) {
  const coordinates = roundCoordPairs(coordsLonLat, 4)
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'voyage-track' },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  }
}

function fetchPositionRows(startIso, endIso, maxPoints, windowEvery) {
  const flux = fluxForRange(startIso, endIso, windowEvery)
  const raw = runInflux(flux)
  const rows = parseInfluxCsv(raw)
  rows.sort((a, b) => a.t.localeCompare(b.t))
  if (rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  const thin = []
  for (let i = 0; i < rows.length; i += step) thin.push(rows[i])
  const last = rows[rows.length - 1]
  if (thin[thin.length - 1].t !== last.t) thin.push(last)
  return thin
}

function buildTrackFromRows(rows, maxPts) {
  if (rows.length < 2) return null
  const coords = rows.map((r) => [r.lon, r.lat])
  const dec = decimateCoords(coords, maxPts)
  return buildTrackFeatureCollection(dec)
}

function fetchTenMinuteTrack(startIso, endIso) {
  const rows = fetchPositionRows(startIso, endIso, TRACK_FETCH_MAX_POINTS, WINDOW_TRACK)
  return buildTrackFromRows(rows, TRACK_MAX_POINTS)
}

function stableSegmentGroupId(v) {
  return createHash('sha256')
    .update(`${v.startedAt}|${v.endedAt}|${v.startLat}|${v.startLon}`)
    .digest('hex')
    .slice(0, 24)
}

function computePointSpeedsKts(rows) {
  const speeds = [null]
  for (let i = 1; i < rows.length; i++) {
    const dtMs = Date.parse(rows[i].t) - Date.parse(rows[i - 1].t)
    if (dtMs <= 0) {
      speeds.push(null)
      continue
    }
    const dtH = dtMs / 3_600_000
    const nm = haversineNm(rows[i - 1].lat, rows[i - 1].lon, rows[i].lat, rows[i].lon)
    speeds.push(nm / dtH)
  }
  return speeds
}

function voyageFromRowSlice(rows, sliceStart, sliceEndInclusive) {
  const sub = rows.slice(sliceStart, sliceEndInclusive + 1)
  if (sub.length < 2) return null
  const a = sub[0]
  const b = sub[sub.length - 1]
  const gc = haversineNm(a.lat, a.lon, b.lat, b.lon)
  return {
    startedAt: a.t,
    endedAt: b.t,
    startLat: a.lat,
    startLon: a.lon,
    endLat: b.lat,
    endLon: b.lon,
    distanceNm: Math.round(gc * 10) / 10,
    movingDayCount: 0,
  }
}

function mergeTwoVoyages(a, b) {
  return {
    startedAt: a.startedAt,
    endedAt: b.endedAt,
    startLat: a.startLat,
    startLon: a.startLon,
    endLat: b.endLat,
    endLon: b.endLon,
    distanceNm:
      Math.round(haversineNm(a.startLat, a.startLon, b.endLat, b.endLon) * 10) / 10,
    movingDayCount: (a.movingDayCount ?? 0) + (b.movingDayCount ?? 0),
  }
}

function mergeTinySegments(parts, minNm) {
  let list = [...parts]
  let guard = 0
  while (guard++ < list.length + 8) {
    const idx = list.findIndex((p) => p.distanceNm < minNm)
    if (idx === -1) break
    if (list.length <= 1) break
    if (idx === 0) {
      list.splice(0, 2, mergeTwoVoyages(list[0], list[1]))
    } else if (idx === list.length - 1) {
      list.splice(list.length - 2, 2, mergeTwoVoyages(list[list.length - 2], list[list.length - 1]))
    } else {
      const left = list[idx - 1].distanceNm
      const right = list[idx + 1].distanceNm
      if (left <= right) {
        list.splice(idx - 1, 2, mergeTwoVoyages(list[idx - 1], list[idx]))
      } else {
        list.splice(idx, 2, mergeTwoVoyages(list[idx], list[idx + 1]))
      }
    }
  }
  return list
}

function splitVoyageAtAnchorStops(voyage, sortedRows) {
  const rows = sortedRows
  if (rows.length < 30) return [voyage]

  const speeds = computePointSpeedsKts(rows)
  const smoothed = speeds.map((v, i) => {
    const window = [speeds[i - 1], v, speeds[i + 1]].filter((x) => x != null && Number.isFinite(x))
    if (!window.length) return 999
    window.sort((a, b) => a - b)
    return window[Math.floor(window.length / 2)]
  })

  const slow = smoothed.map((s) => s < SUBDAILY_SLOW_KT)
  /** @type {{ from: number, to: number }[]} */
  const islands = []

  function flushRun(from, to) {
    if (from > to) return
    const len = to - from + 1
    if (len < SUBDAILY_SLOW_RUNS) return
    const durH = (Date.parse(rows[to].t) - Date.parse(rows[from].t)) / 3_600_000
    if (durH < SUBDAILY_MIN_STOP_H) return
    let maxD = 0
    for (let j = from; j <= to; j++) {
      maxD = Math.max(maxD, haversineNm(rows[from].lat, rows[from].lon, rows[j].lat, rows[j].lon))
    }
    if (maxD > SUBDAILY_STOP_MAX_RADIUS_NM) return
    islands.push({ from, to })
  }

  let runStart = null
  for (let i = 0; i < slow.length; i++) {
    if (slow[i]) {
      if (runStart === null) runStart = i
    } else if (runStart !== null) {
      flushRun(runStart, i - 1)
      runStart = null
    }
  }
  if (runStart !== null) flushRun(runStart, slow.length - 1)

  if (islands.length === 0) return [voyage]

  islands.sort((a, b) => a.from - b.from)
  /** @type {object[]} */
  const parts = []
  let cursor = 0
  for (const is of islands) {
    const segEnd = is.from - 1
    if (segEnd >= cursor) {
      const v = voyageFromRowSlice(rows, cursor, segEnd)
      if (v) parts.push(v)
    }
    cursor = is.to + 1
  }
  if (cursor < rows.length) {
    const v = voyageFromRowSlice(rows, cursor, rows.length - 1)
    if (v) parts.push(v)
  }

  const merged = mergeTinySegments(parts, SUBDAILY_MIN_SEGMENT_NM)
  if (merged.length <= 1) return [voyage]
  return merged
}

function expandVoyagesForSeed(voyages) {
  /** @type {{ voyage: object, segmentGroupId: string | null, segmentIndex: number }[]} */
  const out = []
  for (let vi = 0; vi < voyages.length; vi++) {
    const v = voyages[vi]
    const trySplit =
      SUBDAILY_SPLIT && vi < SUBDAILY_MAX_RANK && v.distanceNm >= SUBDAILY_MIN_VOYAGE_NM
    if (!trySplit) {
      out.push({ voyage: v, segmentGroupId: null, segmentIndex: 0 })
      continue
    }
    const t0 = addHoursIso(v.startedAt, -TRACK_BUFFER_H)
    const t1 = addHoursIso(v.endedAt, TRACK_BUFFER_H)
    let rows
    try {
      rows = fetchPositionRows(t0, t1, SUBDAILY_MAX_TRACK_POINTS, WINDOW_10M)
    } catch (e) {
      process.stderr.write(`  subdaily split: skip voyage ${vi + 1} (${e.message || e})\n`)
      out.push({ voyage: v, segmentGroupId: null, segmentIndex: 0 })
      continue
    }
    const parts = splitVoyageAtAnchorStops(v, rows)
    if (parts.length <= 1) {
      out.push({ voyage: v, segmentGroupId: null, segmentIndex: 0 })
      continue
    }
    process.stderr.write(`  subdaily split: voyage ${vi + 1} → ${parts.length} segment(s)\n`)
    const gid = stableSegmentGroupId(v)
    for (let si = 0; si < parts.length; si++) {
      out.push({ voyage: parts[si], segmentGroupId: gid, segmentIndex: si })
    }
  }
  return out
}

function fluxScalarMean(start, stop, every, measurement, fieldName = 'value', sourceTag = SOURCE_NAVIGATION) {
  return `
from(bucket: "${BUCKET}")
  |> range(start: ${start}, stop: ${stop})
  |> filter(fn: (r) =>
    r._measurement == "${measurement}"
    and r._field == "${fieldName}"
    and r.self == "true"
    and r.source == "${sourceTag}")
  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_value"])
`.trim()
}

function parseInfluxScalarCsv(raw) {
  const lines = raw.split('\n')
  let timeIdx = -1
  let valueIdx = -1
  for (const line of lines) {
    if (!line.startsWith(',result,table,')) continue
    const parts = line.split(',')
    timeIdx = parts.indexOf('_time')
    valueIdx = parts.indexOf('_value')
    break
  }
  const out = []
  for (const line of lines) {
    if (!line.startsWith(',,')) continue
    const cells = line.split(',')
    if (timeIdx < 0 || valueIdx < 0 || timeIdx >= cells.length || valueIdx >= cells.length) continue
    const t = cells[timeIdx]
    if (!ISO.test(t)) continue
    const val = Number.parseFloat(cells[valueIdx])
    if (!Number.isFinite(val)) continue
    out.push({ t, v: val })
  }
  return out
}

function nearestScalar(points, targetMs, maxDeltaMs) {
  if (!points.length) return null
  let best = null
  let bestD = Infinity
  for (const p of points) {
    const d = Math.abs(Date.parse(p.t) - targetMs)
    if (d < bestD) {
      bestD = d
      best = p.v
    }
  }
  if (bestD > maxDeltaMs) return null
  return best
}

function decimateRowsEvenly(rows, maxN) {
  if (rows.length <= maxN) return rows
  const step = Math.ceil(rows.length / maxN)
  const out = []
  for (let i = 0; i < rows.length; i += step) out.push(rows[i])
  const last = rows[rows.length - 1]
  if (out[out.length - 1].t !== last.t) out.push(last)
  return out
}

function buildPlaybackJsonForVoyage(voyage, paddedPositionRows) {
  const sub = paddedPositionRows.filter((r) => r.t >= voyage.startedAt && r.t <= voyage.endedAt)
  if (sub.length < 2) return null
  const base = decimateRowsEvenly(sub, PLAYBACK_MAX_SAMPLES)
  const t0 = base[0].t
  const t1 = base[base.length - 1].t

  /** @type {{ t: string, v: number }[]} */
  let sogPts = []
  let cogPts = []
  let stwPts = []
  let wspdPts = []
  let wdirPts = []
  try {
    sogPts = parseInfluxScalarCsv(runInflux(fluxScalarMean(t0, t1, WINDOW_TRACK, MEAS_SOG, 'value', SOURCE_NAVIGATION)))
  } catch {
    sogPts = []
  }
  try {
    cogPts = parseInfluxScalarCsv(runInflux(fluxScalarMean(t0, t1, WINDOW_TRACK, MEAS_COG, 'value', SOURCE_NAVIGATION)))
  } catch {
    cogPts = []
  }
  try {
    stwPts = parseInfluxScalarCsv(runInflux(fluxScalarMean(t0, t1, WINDOW_TRACK, MEAS_STW, 'value', SOURCE_NAVIGATION)))
  } catch {
    stwPts = []
  }
  try {
    wspdPts = parseInfluxScalarCsv(
      runInflux(fluxScalarMean(t0, t1, WINDOW_TRACK, MEAS_WIND_SPD, 'value', SOURCE_ENVIRONMENT)),
    )
  } catch {
    wspdPts = []
  }
  try {
    wdirPts = parseInfluxScalarCsv(
      runInflux(fluxScalarMean(t0, t1, WINDOW_TRACK, MEAS_WIND_DIR, 'value', SOURCE_ENVIRONMENT)),
    )
  } catch {
    wdirPts = []
  }

  const maxDelta = 450_000
  const samples = base.map((p) => {
    const ms = Date.parse(p.t)
    return {
      t: p.t,
      lat: Math.round(p.lat * 1e6) / 1e6,
      lon: Math.round(p.lon * 1e6) / 1e6,
      sog: nearestScalar(sogPts, ms, maxDelta),
      cog: nearestScalar(cogPts, ms, maxDelta),
      stw: nearestScalar(stwPts, ms, maxDelta),
      windKts: nearestScalar(wspdPts, ms, maxDelta),
      windDir: nearestScalar(wdirPts, ms, maxDelta),
    }
  })

  return JSON.stringify({
    v: 1,
    positionSource: SOURCE_POSITION,
    trackWindow: WINDOW_TRACK,
    samples,
    vessels: [],
    note: 'AIS traffic: see passage_ais_vessels table (Phase E seed export)',
  })
}

function fluxEscapeContext(ctx) {
  return String(ctx).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function fluxContextOrExpr(contexts) {
  if (!contexts.length) return 'false'
  return contexts.map((c) => `r.context == "${fluxEscapeContext(c)}"`).join(' or ')
}

function fetchOwnMmsiFromInflux(startIso, stopIso) {
  const flux = `
from(bucket: "${BUCKET}")
  |> range(start: ${startIso}, stop: ${stopIso})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lat"
    and r.self == "true"
    and r.source == "${SOURCE_POSITION}")
  |> limit(n: 1)
`.trim()
  try {
    const raw = runInflux(flux)
    const m = /vessels\.urn:mrn:imo:mmsi:(\d+)/.exec(raw)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function fluxOtherVesselPositionPivot(startIso, stopIso, windowEvery) {
  return `
import "strings"

bucket = "${BUCKET}"

lat = from(bucket: bucket)
  |> range(start: ${startIso}, stop: ${stopIso})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lat"
    and r.self != "true"
    and r.source == "${SOURCE_AIS}"
    and strings.hasPrefix(v: r.context, prefix: "vessels.urn:mrn:imo:mmsi:"))
  |> aggregateWindow(every: ${windowEvery}, fn: mean, createEmpty: false)
  |> group(columns: ["context", "_time"])
  |> mean(column: "_value")
  |> set(key: "_field", value: "lat")

lon = from(bucket: bucket)
  |> range(start: ${startIso}, stop: ${stopIso})
  |> filter(fn: (r) =>
    r._measurement == "navigation.position"
    and r._field == "lon"
    and r.self != "true"
    and r.source == "${SOURCE_AIS}"
    and strings.hasPrefix(v: r.context, prefix: "vessels.urn:mrn:imo:mmsi:"))
  |> aggregateWindow(every: ${windowEvery}, fn: mean, createEmpty: false)
  |> group(columns: ["context", "_time"])
  |> mean(column: "_value")
  |> set(key: "_field", value: "lon")

union(tables: [lat, lon])
  |> pivot(rowKey: ["_time", "context"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["context", "_time"])
`.trim()
}

/** @returns {{ t: string, context: string, lat: number, lon: number }[]} */
function parseTrafficPivotCsv(raw) {
  const lines = raw.split('\n')
  const rows = []
  for (const line of lines) {
    if (!line.startsWith(',,')) continue
    const cells = line.split(',')
    if (cells.length < 7) continue
    const t = cells[3]
    if (!ISO.test(t)) continue
    const context = cells[4]
    if (!context || !context.includes('mmsi:')) continue
    const lat = Number.parseFloat(cells[5])
    const lon = Number.parseFloat(cells[6])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const { lat: la, lon: lo } = normalizeLatLonCaribbeanUS(lat, lon)
    rows.push({ t, context, lat: la, lon: lo })
  }
  return rows
}

/** @returns {Map<string, { t: string, v: number }[]>} */
function parseContextTimeValueCsv(raw) {
  const map = new Map()
  for (const line of raw.split('\n')) {
    if (!line.startsWith(',,')) continue
    const cells = line.split(',')
    if (cells.length < 6) continue
    const t = cells[3]
    if (!ISO.test(t)) continue
    const context = cells[4]
    const v = Number.parseFloat(cells[5])
    if (!Number.isFinite(v) || !context) continue
    if (!map.has(context)) map.set(context, [])
    map.get(context).push({ t, v })
  }
  for (const arr of map.values()) arr.sort((a, b) => a.t.localeCompare(b.t))
  return map
}

function fluxAggScalarByContext(startIso, stopIso, windowEvery, measurement, contextOrExpr) {
  return `
from(bucket: "${BUCKET}")
  |> range(start: ${startIso}, stop: ${stopIso})
  |> filter(fn: (r) =>
    r._measurement == "${measurement}"
    and r._field == "value"
    and r.self != "true"
    and r.source == "${SOURCE_AIS}"
    and (${contextOrExpr}))
  |> aggregateWindow(every: ${windowEvery}, fn: mean, createEmpty: false)
  |> group(columns: ["context", "_time"])
  |> mean(column: "_value")
`.trim()
}

function fluxLastByContext(startIso, stopIso, measurement, contextOrExpr) {
  return `
from(bucket: "${BUCKET}")
  |> range(start: ${startIso}, stop: ${stopIso})
  |> filter(fn: (r) =>
    r._measurement == "${measurement}"
    and r._field == "value"
    and r.self != "true"
    and r.source == "${SOURCE_AIS}"
    and (${contextOrExpr}))
  |> group(columns: ["context"])
  |> last()
`.trim()
}

/**
 * Parse Influx annotated CSV row from `|> last()` (handles quoted JSON in _value).
 * @returns {{ context: string, valRaw: string } | null}
 */
function parseInfluxLastDataLine(line) {
  if (!line.startsWith(',,')) return null
  const vi = line.indexOf(',value,')
  if (vi === -1) return null
  const head = line.slice(0, vi)
  const tail = line.slice(vi + ',value,'.length)
  const tm = /^([^,]+),(vessels\.urn:mrn:imo:mmsi:\d+)(?:,(.+))?$/.exec(tail)
  if (!tm) return null
  const context = tm[2]
  const mHead = /^,,[^,]+,(\d{4}-\d{2}-\d{2}T[\d:.]+Z),(\d{4}-\d{2}-\d{2}T[\d:.]+Z),(\d{4}-\d{2}-\d{2}T[\d:.]+Z),(.+)$/.exec(
    head,
  )
  if (!mHead) return null
  let valRaw = mHead[4]
  if (valRaw.startsWith('"') && valRaw.endsWith('"')) {
    valRaw = valRaw.slice(1, -1).replace(/""/g, '"')
  }
  return { context, valRaw }
}

function parseNumericOrJsonOverall(valRaw) {
  const n = Number.parseFloat(valRaw)
  if (Number.isFinite(n)) return n
  const i = valRaw.indexOf('{')
  const j = valRaw.lastIndexOf('}')
  if (i === -1 || j <= i) return null
  try {
    const o = JSON.parse(valRaw.slice(i, j + 1))
    if (typeof o.overall === 'number') return o.overall
  } catch {
    /* */
  }
  return null
}

/** @returns {Map<string, number>} */
function parseLastNumericDesignCsv(raw) {
  const map = new Map()
  for (const line of raw.split('\n')) {
    const p = parseInfluxLastDataLine(line)
    if (!p) continue
    const v = parseNumericOrJsonOverall(p.valRaw)
    if (v != null) map.set(p.context, v)
  }
  return map
}

/** @returns {Map<string, string>} */
function parseLastPlainStringCsv(raw) {
  const map = new Map()
  for (const line of raw.split('\n')) {
    const p = parseInfluxLastDataLine(line)
    if (!p || !p.valRaw) continue
    map.set(p.context, p.valRaw)
  }
  return map
}

/** @returns {Map<string, { id: number, name: string }>} */
function parseLastAisShipTypeCsv(raw) {
  const map = new Map()
  for (const line of raw.split('\n')) {
    const p = parseInfluxLastDataLine(line)
    if (!p) continue
    const i = p.valRaw.indexOf('{')
    const j = p.valRaw.lastIndexOf('}')
    if (i === -1 || j <= i) continue
    try {
      const o = JSON.parse(p.valRaw.slice(i, j + 1))
      if (o && typeof o.id === 'number')
        map.set(p.context, { id: o.id, name: String(o.name || '') })
    } catch {
      /* */
    }
  }
  return map
}

function mmsiFromContext(ctx) {
  const m = /mmsi:(\d+)/.exec(ctx || '')
  return m ? m[1] : null
}

/**
 * @param {{ startedAt: string, endedAt: string }} voyage
 * @param {{ t: string, lat: number, lon: number }[]} ownPaddedRows self vessel positions (same source as track)
 * @returns {{ mmsi: string, profile: object, samples: object[] }[]}
 */
function buildTrafficExportForVoyage(voyage, ownPaddedRows) {
  const t0 = addHoursIso(voyage.startedAt, -TRACK_BUFFER_H)
  const t1 = addHoursIso(voyage.endedAt, TRACK_BUFFER_H)
  const ownRef = ownPaddedRows.filter((r) => r.t >= voyage.startedAt && r.t <= voyage.endedAt)
  if (ownRef.length < 2) return []

  const ownMmsi = fetchOwnMmsiFromInflux(t0, t1)

  let posRows = []
  try {
    posRows = parseTrafficPivotCsv(runInflux(fluxOtherVesselPositionPivot(t0, t1, TRAFFIC_WINDOW)))
  } catch (e) {
    process.stderr.write(`  (traffic positions skip: ${e.message || e})\n`)
    return []
  }

  /** @type {Map<string, { t: string, lat: number, lon: number }[]>} */
  const byCtx = new Map()
  for (const r of posRows) {
    if (!byCtx.has(r.context)) byCtx.set(r.context, [])
    byCtx.get(r.context).push({ t: r.t, lat: r.lat, lon: r.lon })
  }
  for (const arr of byCtx.values()) arr.sort((a, b) => a.t.localeCompare(b.t))

  /** @type {{ context: string, mmsi: string, minD: number, pts: { t: string, lat: number, lon: number }[] }[]} */
  const scored = []
  for (const [context, pts] of byCtx) {
    const mmsi = mmsiFromContext(context)
    if (!mmsi || (ownMmsi && mmsi === ownMmsi)) continue
    let minD = Infinity
    for (const p of pts) {
      for (const o of ownRef) {
        const d = haversineNm(p.lat, p.lon, o.lat, o.lon)
        if (d < minD) minD = d
      }
    }
    if (minD <= TRAFFIC_MAX_NM) scored.push({ context, mmsi, minD, pts })
  }
  scored.sort((a, b) => a.minD - b.minD)
  const picked = scored.slice(0, TRAFFIC_MAX_VESSELS)
  if (!picked.length) return []

  const contexts = picked.map((p) => p.context)
  const orExpr = fluxContextOrExpr(contexts)

  /** @type {Map<string, { t: string, v: number }[]>} */
  let sogM = new Map()
  let cogM = new Map()
  let hdgM = new Map()
  try {
    sogM = parseContextTimeValueCsv(runInflux(fluxAggScalarByContext(t0, t1, TRAFFIC_WINDOW, MEAS_SOG, orExpr)))
  } catch {
    /* */
  }
  try {
    cogM = parseContextTimeValueCsv(runInflux(fluxAggScalarByContext(t0, t1, TRAFFIC_WINDOW, MEAS_COG, orExpr)))
  } catch {
    /* */
  }
  try {
    hdgM = parseContextTimeValueCsv(runInflux(fluxAggScalarByContext(t0, t1, TRAFFIC_WINDOW, MEAS_HEADING, orExpr)))
  } catch {
    /* */
  }

  let lenM = new Map()
  let beamM = new Map()
  let draftM = new Map()
  let destM = new Map()
  let typeM = new Map()
  try {
    lenM = parseLastNumericDesignCsv(runInflux(fluxLastByContext(t0, t1, 'design.length', orExpr)))
  } catch {
    /* */
  }
  try {
    beamM = parseLastNumericDesignCsv(runInflux(fluxLastByContext(t0, t1, 'design.beam', orExpr)))
  } catch {
    /* */
  }
  try {
    draftM = parseLastNumericDesignCsv(runInflux(fluxLastByContext(t0, t1, 'design.draft', orExpr)))
  } catch {
    /* */
  }
  try {
    destM = parseLastPlainStringCsv(runInflux(fluxLastByContext(t0, t1, 'navigation.destination.commonName', orExpr)))
  } catch {
    /* */
  }
  try {
    typeM = parseLastAisShipTypeCsv(runInflux(fluxLastByContext(t0, t1, 'design.aisShipType', orExpr)))
  } catch {
    /* */
  }

  const maxDelta = 450_000
  const out = []
  for (const { context, mmsi, pts } of picked) {
    const sogPts = sogM.get(context) ?? []
    const cogPts = cogM.get(context) ?? []
    const hdgPts = hdgM.get(context) ?? []
    const shipType = typeM.get(context)
    const profile = {
      v: 1,
      contextUrn: context,
      mmsi,
      name: null,
      shipTypeId: shipType?.id ?? null,
      shipTypeName: shipType?.name ?? null,
      lengthM: lenM.get(context) ?? null,
      beamM: beamM.get(context) ?? null,
      draftM: draftM.get(context) ?? null,
      destination: destM.get(context) ?? null,
      note: 'Vessel name not stored in this Influx bucket; MMSI + type label used for display.',
    }

    const samples = decimateRowsEvenly(
      pts.map((p) => {
        const ms = Date.parse(p.t)
        return {
          t: p.t,
          lat: Math.round(p.lat * 1e6) / 1e6,
          lon: Math.round(p.lon * 1e6) / 1e6,
          sog: nearestScalar(sogPts.map((x) => ({ t: x.t, v: x.v })), ms, maxDelta),
          cog: nearestScalar(cogPts.map((x) => ({ t: x.t, v: x.v })), ms, maxDelta),
          hdg: nearestScalar(hdgPts.map((x) => ({ t: x.t, v: x.v })), ms, maxDelta),
        }
      }),
      TRAFFIC_MAX_SAMPLES,
    )

    out.push({ mmsi, profile, samples })
  }
  return out
}

function addHoursIso(iso, hours) {
  const d = new Date(iso)
  d.setTime(d.getTime() + hours * 3600000)
  return d.toISOString()
}

async function main() {
  if (!TOKEN || !ORG_ID) {
    console.error('Missing INFLUX_TOKEN or INFLUX_ORG_ID (use Doppler prd).')
    process.exit(1)
  }

  mkdirSync(dirname(CACHE_HOURLY), { recursive: true })
  writeFileSync(CACHE_HOURLY, '')

  const allHourly = []
  let batch = 0
  for (const { start, stop } of eachUtcSixMonths(RANGE_START, RANGE_STOP)) {
    batch++
    process.stderr.write(
      `Phase A — 1h batch ${batch}: ${start.slice(0, 10)} .. ${stop.slice(0, 10)}\n`,
    )
    const flux = fluxForRange(start, stop, WINDOW_1H)
    let raw
    try {
      raw = runInflux(flux)
    } catch (e) {
      console.error(e.message || e)
      process.exit(1)
    }
    const rows = parseInfluxCsv(raw)
    for (const r of rows) {
      writeFileSync(CACHE_HOURLY, `${JSON.stringify(r)}\n`, { flag: 'a' })
    }
    allHourly.push(...rows)
  }

  const byTime = new Map()
  for (const r of allHourly) {
    byTime.set(r.t, r)
  }
  const dedupedHourly = [...byTime.values()].sort((a, b) => a.t.localeCompare(b.t))

  process.stderr.write(`Unique hourly points: ${dedupedHourly.length}\n`)

  let movingDays = hourlyToMovingDays(dedupedHourly)
  process.stderr.write(`Moving days (1h): ${movingDays.length}\n`)

  if (!SKIP_MOVING_DAY_10M && movingDays.length > 0) {
    const hourlyByDay = groupRowsByUtcDay(dedupedHourly)
    const sortedKeys = [...new Set(movingDays.map((d) => d.dateKey))].sort()
    const ranges = mergeMovingDayKeysToRanges(sortedKeys)
    process.stderr.write(
      `Phase A2 — 10m on moving days: ${ranges.length} Influx range(s), ${sortedKeys.length} day(s)\n`,
    )
    const allTenMin = []
    for (let ri = 0; ri < ranges.length; ri++) {
      const { start, stop } = ranges[ri]
      process.stderr.write(
        `  10m range ${ri + 1}/${ranges.length}: ${start.slice(0, 10)} .. ${stop.slice(0, 10)} (excl.)\n`,
      )
      const flux = fluxForRange(start, stop, WINDOW_10M)
      let raw
      try {
        raw = runInflux(flux)
      } catch (e) {
        console.error(e.message || e)
        process.exit(1)
      }
      allTenMin.push(...parseInfluxCsv(raw))
    }
    const tenMinByDay = groupRowsByUtcDay(allTenMin)
    movingDays = refineMovingDaysWithTenMinute(movingDays, hourlyByDay, tenMinByDay)
    process.stderr.write(`Moving days refined with 10m where available: ${movingDays.length}\n`)
  } else if (SKIP_MOVING_DAY_10M) {
    process.stderr.write('Phase A2 skipped (PASSAGE_SKIP_MOVING_DAY_10M=1)\n')
  }

  const byDaySummary = buildAllDaySummariesFromHourly(dedupedHourly)
  const voyages = clusterMovingDaysToVoyages(movingDays, byDaySummary)
  process.stderr.write(
    `Voyages (before tracks): ${voyages.length} (stationary break: ≥${MIN_STATIONARY_BREAK_DAYS} day(s) with path<${STATIONARY_PATH_NM} nm & disp<${STATIONARY_DISP_NM} nm between moving days)\n`,
  )

  const expanded = expandVoyagesForSeed(voyages)
  process.stderr.write(
    `After sub-daily expansion: ${expanded.length} passage row(s) (PASSAGE_SUBDAILY_SPLIT=${SUBDAILY_SPLIT}, maxRank=${SUBDAILY_MAX_RANK}, playback=${PLAYBACK_ENRICH}, playbackRows≤${PLAYBACK_MAX_PASSAGES})\n`,
  )

  process.stderr.write(
    `Phase B — track Influx aggregateWindow: ${WINDOW_TRACK} (≤${TRACK_MAX_POINTS} vertices; coords 4dp; D1 INSERT ≤100KB)\n`,
  )

  const titleToken = await getMapsAccessTokenForTitles()
  if (titleToken) {
    process.stderr.write('Titles: using Apple reverse geocode (MAPKIT_SERVER_API_KEY)\n')
  } else if (!TITLE_COORDS_ONLY) {
    process.stderr.write(
      'Titles: coordinate labels (set MAPKIT_SERVER_API_KEY in Doppler for place names)\n',
    )
  } else {
    process.stderr.write('Titles: coordinate labels only (PASSAGE_TITLE_COORDS_ONLY=1)\n')
  }

  const rowsOut = []
  for (let idx = 0; idx < expanded.length; idx++) {
    const { voyage: v, segmentGroupId, segmentIndex } = expanded[idx]
    let track = null
    let playbackJson = null
    /** @type {{ t: string, lat: number, lon: number }[]} */
    let positionRows = []
    /** @type {{ mmsi: string, profile: object, samples: object[] }[]} */
    let trafficVessels = []
    const wantPlayback = PLAYBACK_ENRICH && idx < PLAYBACK_MAX_PASSAGES
    const wantTraffic = TRAFFIC_EXPORT && idx < TRAFFIC_MAX_PASSAGES
    if (!SKIP_TRACKS || wantPlayback || wantTraffic) {
      const t0 = addHoursIso(v.startedAt, -TRACK_BUFFER_H)
      const t1 = addHoursIso(v.endedAt, TRACK_BUFFER_H)
      process.stderr.write(
        `Phase B — passage ${idx + 1}/${expanded.length} ${t0.slice(0, 10)}… (seg ${segmentIndex})\n`,
      )
      try {
        positionRows = fetchPositionRows(t0, t1, TRACK_FETCH_MAX_POINTS, WINDOW_TRACK)
        if (!SKIP_TRACKS) {
          track = buildTrackFromRows(positionRows, TRACK_MAX_POINTS)
        }
        if (wantPlayback) {
          try {
            playbackJson = buildPlaybackJsonForVoyage(v, positionRows)
          } catch (e) {
            process.stderr.write(`  (playback skip: ${e.message || e})\n`)
          }
        }
        if (wantTraffic && positionRows.length >= 2) {
          try {
            trafficVessels = buildTrafficExportForVoyage(v, positionRows)
            if (trafficVessels.length) {
              process.stderr.write(`  traffic: ${trafficVessels.length} vessel(s)\n`)
            }
          } catch (e) {
            process.stderr.write(`  (traffic skip: ${e.message || e})\n`)
          }
        }
      } catch (e) {
        process.stderr.write(`  (skip track/playback/traffic: ${e.message || e})\n`)
      }
    }

    const { title, startPlaceLabel, endPlaceLabel } = await voyageTitleAndLabels(v, titleToken)
    rowsOut.push({
      ...v,
      track,
      title,
      startPlaceLabel,
      endPlaceLabel,
      segmentGroupId,
      segmentIndex,
      playbackJson,
      trafficVessels,
    })
    if (titleToken && idx < expanded.length - 1) {
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  const header = `-- Voyages from Influx (${RANGE_START}–${RANGE_STOP})
-- Phase A: 1h means, 6-month batches → moving days; Phase A2: 10m on moving days only (unless PASSAGE_SKIP_MOVING_DAY_10M=1)
-- Cluster moving days (calendar gap + multi-day stationary breaks); endpoints = first/last fix (10m-refined)
-- Phase C: sub-daily split on long anchor stops (see PASSAGE_SUBDAILY_* env); segment_group_id ties legs together
-- Phase D: playback_json = decimated SOG/COG/STW/wind aligned to 10m track (PASSAGE_PLAYBACK_ENRICH=0 to skip)
-- start_place_label / end_place_label = Apple reverse geocode at seed (no per-page API calls)
-- Phase B: PASSAGE_TRACK_WINDOW means (default 5m) → track_geojson (unless PASSAGE_SKIP_TRACKS=1)
-- Phase E: passage_ais_vessels — AIS traffic (PASSAGE_TRAFFIC_EXPORT=0 to skip)
-- Sources: INFLUX_SOURCE_POSITION, INFLUX_SOURCE_NAVIGATION, INFLUX_SOURCE_ENVIRONMENT, INFLUX_SOURCE_AIS
-- Regenerate: doppler run --project tideye --config prd -- node tools/passage-seed-pipeline.mjs

DELETE FROM passage_ais_vessels;
DELETE FROM passages WHERE position_source = '${sqlEscape(SOURCE_POSITION)}';

`

  const created = new Date().toISOString()
  const cols =
    'id, title, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_nm, position_source, created_at, track_geojson, start_place_label, end_place_label, segment_group_id, segment_index, playback_json'

  /** @type {string[]} */
  const statements = []
  rowsOut.forEach((row, idx) => {
    const id = `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`
    const title = row.title
    const trackSql = row.track == null ? 'NULL' : `'${sqlEscape(JSON.stringify(row.track))}'`
    const startLblSql = row.startPlaceLabel == null ? 'NULL' : `'${sqlEscape(row.startPlaceLabel)}'`
    const endLblSql = row.endPlaceLabel == null ? 'NULL' : `'${sqlEscape(row.endPlaceLabel)}'`
    const segGroupSql =
      row.segmentGroupId == null || row.segmentGroupId === '' ? 'NULL' : `'${sqlEscape(row.segmentGroupId)}'`
    const segIdx = Number.isFinite(row.segmentIndex) ? row.segmentIndex : 0
    const playbackSql =
      row.playbackJson == null || row.playbackJson === '' ? 'NULL' : `'${sqlEscape(row.playbackJson)}'`
    statements.push(
      `INSERT INTO passages (${cols}) VALUES ('${id}', '${sqlEscape(title)}', '${row.startedAt}', '${row.endedAt}', ` +
        `${row.startLat}, ${row.startLon}, ${row.endLat}, ${row.endLon}, ${row.distanceNm}, ` +
        `'${sqlEscape(SOURCE_POSITION)}', '${created}', ${trackSql}, ${startLblSql}, ${endLblSql}, ${segGroupSql}, ${segIdx}, ${playbackSql});`,
    )
    const tv = row.trafficVessels
    if (Array.isArray(tv) && tv.length) {
      for (const vessel of tv) {
        const pj = sqlEscape(JSON.stringify(vessel.profile))
        const sj = sqlEscape(JSON.stringify(vessel.samples))
        statements.push(
          `INSERT INTO passage_ais_vessels (passage_id, mmsi, profile_json, samples_json) VALUES ('${id}', '${sqlEscape(vessel.mmsi)}', '${pj}', '${sj}');`,
        )
      }
    }
  })

  const body =
    statements.length === 0
      ? '-- No voyages matched detection thresholds.\n'
      : `${statements.join('\n')}\n`

  writeFileSync(SEED_OUT, header + body, 'utf8')
  console.log(`Wrote ${SEED_OUT} (${rowsOut.length} rows)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
