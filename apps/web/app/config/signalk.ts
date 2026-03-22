/**
 * SignalK connection configuration and subscription paths.
 * Extracted from the SignalK store to keep config separate from logic.
 */

// ── Server Endpoints ─────────────────────────────────────────
export const DEV_SERVER = 'http://signalk-local.tideye.com'
export const LOCAL_SERVER = 'http://signalk-local.tideye.com'
export const REMOTE_SERVER = 'https://signalk-public.tideye.com'

// ── Timing Constants ─────────────────────────────────────────
export const AIS_FLUSH_INTERVAL_MS = 2_000
export const STALE_VESSEL_TIMEOUT = 15 * 60 * 1000 // 15 minutes
export const UPDATE_INTERVAL = 250
export const BUFFER_SIZE = 100
export const LOCAL_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

// ── Self-vessel Subscriptions ────────────────────────────────
export const SELF_SUBSCRIPTIONS: ReadonlyArray<{ path: string; policy: string }> = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.headingTrue', policy: 'instant' },
  { path: 'navigation.headingMagnetic', policy: 'instant' },
  { path: 'navigation.speedThroughWater', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
  { path: 'navigation.courseOverGroundMagnetic', policy: 'instant' },
  { path: 'navigation.attitude', policy: 'instant' },
  { path: 'navigation.gnss.*', policy: 'instant' },
  { path: 'navigation.trip.log', policy: 'instant' },
  { path: 'navigation.log', policy: 'instant' },
  { path: 'navigation.magneticVariation', policy: 'instant' },
  { path: 'navigation.destination.*', policy: 'instant' },
  { path: 'navigation.anchor.*', policy: 'instant' },
  { path: 'environment.wind.speedApparent', policy: 'instant' },
  { path: 'environment.wind.angleApparent', policy: 'instant' },
  { path: 'environment.wind.speedTrue', policy: 'instant' },
  { path: 'environment.wind.directionTrue', policy: 'instant' },
  { path: 'environment.wind.speedOverGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueWater', policy: 'instant' },
  { path: 'environment.wind.directionMagnetic', policy: 'instant' },
  { path: 'environment.water.temperature', policy: 'instant' },
  { path: 'environment.water.salinity', policy: 'instant' },
  { path: 'environment.depth.belowSurface', policy: 'instant' },
  { path: 'environment.depth.belowKeel', policy: 'instant' },
  { path: 'environment.depth.belowTransducer', policy: 'instant' },
  { path: 'environment.outside.*', policy: 'instant' },
  { path: 'environment.inside.*', policy: 'instant' },
  { path: 'environment.current.*', policy: 'instant' },
  { path: 'environment.tide.*', policy: 'instant' },
  { path: 'environment.weather.*', policy: 'instant' },
  { path: 'steering.rudderAngle', policy: 'instant' },
  { path: 'steering.autopilot.*', policy: 'instant' },
  { path: 'propulsion.*', policy: 'instant' },
  { path: 'electrical.batteries.*', policy: 'instant' },
  { path: 'electrical.switches.leopard.*', policy: 'instant' },
  { path: 'electrical.solar.*', policy: 'instant' },
  { path: 'electrical.inverters.*', policy: 'instant' },
  { path: 'electrical.chargers.*', policy: 'instant' },
  { path: 'tanks.*', policy: 'instant' },
  { path: 'design.*', policy: 'instant' },
  { path: 'notifications.*', policy: 'instant' },
  { path: 'entertainment.*', policy: 'instant' },
]

// ── AIS Subscriptions ────────────────────────────────────────
export const AIS_SUBSCRIPTIONS: ReadonlyArray<{ path: string; policy: string }> = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.headingTrue', policy: 'instant' },
  { path: 'name', policy: 'instant' },
  { path: 'design.aisShipType', policy: 'instant' },
]
