#!/usr/bin/env node
/**
 * Import generated passage-playback bundles into local D1 for UI preview.
 *
 * Reads:
 *   tools/.generated/passage-playback/manifest.json
 *   tools/.generated/passage-playback/passages/*.json
 *
 * Writes a temp SQL file and executes it against D1:
 *   wrangler d1 execute tideye-db --local|--remote --file=<generated-sql>
 *
 * Optional:
 *   upload full bundle JSON objects to R2 and keep only lightweight metadata in D1
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const APP_ROOT = join(REPO_ROOT, 'apps/web')

const GENERATED_DIR =
  process.env.PASSAGE_EXPORT_OUT_DIR || join(REPO_ROOT, 'tools/.generated/passage-playback')
const MANIFEST_PATH = join(GENERATED_DIR, 'manifest.json')
const SQL_OUT = process.env.PASSAGE_IMPORT_SQL_OUT || join(GENERATED_DIR, 'import-local-d1.sql')
const DB_NAME = process.env.PASSAGE_IMPORT_D1_NAME || 'tideye-db'
const CLEAR_EXISTING = process.env.PASSAGE_IMPORT_CLEAR !== '0'
const ALLOW_MISSING = process.env.PASSAGE_IMPORT_ALLOW_MISSING === '1'
const REMOTE = process.env.PASSAGE_IMPORT_REMOTE === '1'
const INCLUDE_TRAFFIC = process.env.PASSAGE_IMPORT_INCLUDE_TRAFFIC !== '0'
const R2_BUCKET = process.env.PASSAGE_IMPORT_R2_BUCKET?.trim() || ''
const R2_PREFIX = (process.env.PASSAGE_IMPORT_R2_PREFIX || 'passage-playback').replace(
  /^\/+|\/+$/g,
  '',
)
const PLAYBACK_JSON_MAX_SAMPLES = Number(
  process.env.PASSAGE_IMPORT_PLAYBACK_JSON_MAX_SAMPLES || 320,
)
const TRACK_GEOJSON_MAX_POINTS = Number(process.env.PASSAGE_IMPORT_TRACK_MAX_POINTS || 850)

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    if (ALLOW_MISSING) {
      console.log(`Skipping local playback import; manifest not found at ${MANIFEST_PATH}`)
      return
    }
    throw new Error(`Missing manifest: ${MANIFEST_PATH}`)
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const passageEntries = Array.isArray(manifest.passages) ? manifest.passages : []
  if (!passageEntries.length) {
    throw new Error('No passages found in playback manifest')
  }

  const statements = []
  statements.push('-- Generated from tools/.generated/passage-playback')
  statements.push('PRAGMA foreign_keys = OFF;')
  if (CLEAR_EXISTING) {
    statements.push('DELETE FROM passage_ais_vessels;')
    statements.push('DELETE FROM passages;')
  }

  for (const entry of passageEntries) {
    const bundlePath = join(GENERATED_DIR, entry.file)
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
    const compactTrack = compactTrackGeojson(bundle.overviewTrackGeojson, TRACK_GEOJSON_MAX_POINTS)
    const bundleObjectKey = `${R2_PREFIX}/passages/${bundle.id}.json`

    const playbackJson = JSON.stringify({
      v: 2,
      summary: bundle.summary,
      selfWindow: bundle.self?.window ?? null,
      samples: compactPlaybackSamples(bundle.self?.samples ?? [], PLAYBACK_JSON_MAX_SAMPLES),
      traffic: {
        window: bundle.traffic?.window ?? null,
        vesselCount: Array.isArray(bundle.traffic?.vessels) ? bundle.traffic.vessels.length : 0,
      },
      note: R2_BUCKET
        ? `Full playback bundle stored in R2 at ${bundleObjectKey}.`
        : 'Full traffic samples live in passage_ais_vessels; playback bundle lives on disk export.',
    })

    statements.push(
      `INSERT INTO passages (` +
        'id, title, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_nm, position_source, created_at, track_geojson, start_place_label, end_place_label, segment_group_id, segment_index, playback_json' +
        `) VALUES (` +
        `'${sqlEscape(bundle.id)}', ` +
        `'${sqlEscape(bundle.title)}', ` +
        `'${sqlEscape(bundle.startedAt)}', ` +
        `'${sqlEscape(bundle.endedAt)}', ` +
        `${bundle.startLat}, ${bundle.startLon}, ${bundle.endLat}, ${bundle.endLon}, ` +
        `${Number(bundle.summary?.distanceNm || entry.distanceNm || 0)}, ` +
        `'${sqlEscape(bundle.sources?.selfPosition || 'ydg-nmea-2000.2')}', ` +
        `'${sqlEscape(manifest.generatedAt || new Date().toISOString())}', ` +
        `'${sqlEscape(JSON.stringify(compactTrack))}', ` +
        `${toNullableSql(bundle.startPlaceLabel)}, ` +
        `${toNullableSql(bundle.endPlaceLabel)}, ` +
        `NULL, 0, ` +
        `'${sqlEscape(playbackJson)}'` +
        `);`,
    )

    if (INCLUDE_TRAFFIC) {
      const trafficRows = Array.isArray(bundle.traffic?.vessels) ? bundle.traffic.vessels : []
      for (const vessel of trafficRows) {
        const mmsi = vessel?.profile?.mmsi
        if (!mmsi) continue
        statements.push(
          `INSERT INTO passage_ais_vessels (passage_id, mmsi, profile_json, samples_json) VALUES (` +
            `'${sqlEscape(bundle.id)}', ` +
            `'${sqlEscape(mmsi)}', ` +
            `'${sqlEscape(JSON.stringify(vessel.profile || {}))}', ` +
            `'${sqlEscape(JSON.stringify(vessel.samples || []))}'` +
            `);`,
        )
      }
    }
  }

  if (R2_BUCKET) {
    uploadBundlesToR2(passageEntries)
  }

  mkdirSync(dirname(SQL_OUT), { recursive: true })
  writeFileSync(SQL_OUT, `${statements.join('\n')}\n`, 'utf8')

  execFileSync(
    'wrangler',
    ['d1', 'execute', DB_NAME, REMOTE ? '--remote' : '--local', '--file', SQL_OUT],
    {
      cwd: APP_ROOT,
      stdio: 'inherit',
    },
  )

  console.log(
    `Imported ${passageEntries.length} passage bundle(s) into ${REMOTE ? 'remote' : 'local'} D1`,
  )
}

function uploadBundlesToR2(passageEntries) {
  const manifestKey = `${R2_PREFIX}/manifest.json`
  execFileSync(
    'wrangler',
    [
      'r2',
      'object',
      'put',
      `${R2_BUCKET}/${manifestKey}`,
      '--remote',
      '--file',
      MANIFEST_PATH,
      '--content-type',
      'application/json',
    ],
    {
      cwd: APP_ROOT,
      stdio: 'inherit',
    },
  )

  for (const entry of passageEntries) {
    const bundlePath = join(GENERATED_DIR, entry.file)
    const objectKey = `${R2_PREFIX}/${entry.file}`
    execFileSync(
      'wrangler',
      [
        'r2',
        'object',
        'put',
        `${R2_BUCKET}/${objectKey}`,
        '--remote',
        '--file',
        bundlePath,
        '--content-type',
        'application/json',
      ],
      {
        cwd: APP_ROOT,
        stdio: 'inherit',
      },
    )
  }
}

function evenDecimateRows(rows, maxPoints) {
  if (!Array.isArray(rows) || rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  const out = []
  for (let i = 0; i < rows.length; i += step) out.push(rows[i])
  const last = rows[rows.length - 1]
  if (out[out.length - 1]?.t !== last?.t) out.push(last)
  return out
}

function evenDecimateList(values, maxPoints) {
  if (!Array.isArray(values) || values.length <= maxPoints) return values
  const step = Math.ceil(values.length / maxPoints)
  const out = []
  for (let i = 0; i < values.length; i += step) out.push(values[i])
  const last = values[values.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

function compactPlaybackSamples(rows, maxPoints) {
  return evenDecimateRows(rows, maxPoints).map((row) => ({
    t: row.t,
    lat: row.lat,
    lon: row.lon,
    sog: row.sog ?? null,
    cog: row.cog ?? null,
    headingTrue: row.headingTrue ?? null,
  }))
}

function compactTrackGeojson(track, maxPoints) {
  if (!track || track.type !== 'FeatureCollection' || !Array.isArray(track.features)) return track
  const features = track.features.map((feature) => {
    if (feature?.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
      return feature
    }
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: evenDecimateList(feature.geometry.coordinates, maxPoints),
      },
    }
  })
  return { ...track, features }
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''")
}

function toNullableSql(value) {
  if (value == null || value === '') return 'NULL'
  return `'${sqlEscape(value)}'`
}

main()
