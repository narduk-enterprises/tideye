/**
 * App-specific database schema.
 *
 * Re-exports the layer's base tables (users, sessions, todos) so that
 * drizzle-kit can discover them from this workspace. Add app-specific
 * tables below the re-export.
 */
import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export * from '#layer/server/database/schema'

export const passages = sqliteTable('passages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at').notNull(),
  startLat: real('start_lat').notNull(),
  startLon: real('start_lon').notNull(),
  endLat: real('end_lat').notNull(),
  endLon: real('end_lon').notNull(),
  distanceNm: real('distance_nm').notNull(),
  positionSource: text('position_source').notNull(),
  createdAt: text('created_at').notNull(),
  trackGeojson: text('track_geojson'),
  /** Apple Maps reverse-geocode at seed (optional) */
  startPlaceLabel: text('start_place_label'),
  endPlaceLabel: text('end_place_label'),
  segmentGroupId: text('segment_group_id'),
  segmentIndex: integer('segment_index').notNull().default(0),
  playbackJson: text('playback_json'),
})

/** AIS / other-vessel time series per passage (Influx export via seed pipeline). */
export const passageAisVessels = sqliteTable(
  'passage_ais_vessels',
  {
    passageId: text('passage_id').notNull(),
    mmsi: text('mmsi').notNull(),
    profileJson: text('profile_json').notNull(),
    samplesJson: text('samples_json').notNull(),
  },
  (t) => [primaryKey({ columns: [t.passageId, t.mmsi] })],
)
