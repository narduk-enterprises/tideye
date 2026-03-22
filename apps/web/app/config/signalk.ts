import type { SubscriptionPath } from '@signalk/client'

export const AIS_FLUSH_INTERVAL_MS = 2_000
export const STALE_AIS_TIMEOUT_MS = 15 * 60 * 1000
export const DELTA_UPDATE_INTERVAL_MS = 250
export const LOCAL_UPGRADE_CHECK_INTERVAL_MS = 5 * 60 * 1000
export const CONNECT_TIMEOUT_MS = 6_000
export const ENDPOINT_PROBE_TIMEOUT_MS = 1_250
export const RECONNECT_DELAY_MS = 5_000
export const IDLE_DISCONNECT_DELAY_MS = 15_000
export const DELTA_STALE_MS = 10_000

export const DASHBOARD_SELF_SUBSCRIPTIONS: ReadonlyArray<SubscriptionPath> = [
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
  { path: 'environment.wind.speedApparent', policy: 'instant' },
  { path: 'environment.wind.angleApparent', policy: 'instant' },
  { path: 'environment.wind.speedTrue', policy: 'instant' },
  { path: 'environment.wind.directionTrue', policy: 'instant' },
  { path: 'environment.wind.speedOverGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueWater', policy: 'instant' },
  { path: 'environment.wind.directionMagnetic', policy: 'instant' },
  { path: 'environment.water.temperature', policy: 'instant' },
  { path: 'environment.depth.belowSurface', policy: 'instant' },
  { path: 'environment.depth.belowKeel', policy: 'instant' },
  { path: 'environment.depth.belowTransducer', policy: 'instant' },
  { path: 'environment.outside.*', policy: 'instant' },
  { path: 'environment.inside.*', policy: 'instant' },
  { path: 'environment.current.*', policy: 'instant' },
  { path: 'environment.tide.*', policy: 'instant' },
  { path: 'steering.rudderAngle', policy: 'instant' },
  { path: 'steering.autopilot.*', policy: 'instant' },
  { path: 'propulsion.*', policy: 'instant' },
  { path: 'electrical.batteries.*', policy: 'instant' },
  { path: 'electrical.solar.*', policy: 'instant' },
  { path: 'electrical.inverters.*', policy: 'instant' },
  { path: 'electrical.chargers.*', policy: 'instant' },
  { path: 'tanks.*', policy: 'instant' },
  { path: 'notifications.*', policy: 'instant' },
  { path: 'entertainment.*', policy: 'instant' },
]

export const MAP_CORE_SELF_SUBSCRIPTIONS: ReadonlyArray<SubscriptionPath> = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.headingTrue', policy: 'instant' },
  { path: 'navigation.headingMagnetic', policy: 'instant' },
  { path: 'navigation.speedThroughWater', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
  { path: 'navigation.attitude', policy: 'instant' },
  { path: 'navigation.gnss.*', policy: 'instant' },
]

export const MAP_ENVIRONMENT_SELF_SUBSCRIPTIONS: ReadonlyArray<SubscriptionPath> = [
  { path: 'environment.wind.speedApparent', policy: 'instant' },
  { path: 'environment.wind.angleApparent', policy: 'instant' },
  { path: 'environment.wind.speedTrue', policy: 'instant' },
  { path: 'environment.wind.directionTrue', policy: 'instant' },
  { path: 'environment.wind.speedOverGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueGround', policy: 'instant' },
  { path: 'environment.wind.angleTrueWater', policy: 'instant' },
  { path: 'environment.wind.directionMagnetic', policy: 'instant' },
  { path: 'environment.water.temperature', policy: 'instant' },
  { path: 'environment.depth.belowSurface', policy: 'instant' },
  { path: 'environment.depth.belowKeel', policy: 'instant' },
  { path: 'environment.depth.belowTransducer', policy: 'instant' },
  { path: 'environment.current.*', policy: 'instant' },
]

export const AIS_SUBSCRIPTIONS: ReadonlyArray<SubscriptionPath> = [
  { path: 'navigation.position', policy: 'instant' },
  { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
  { path: 'navigation.speedOverGround', policy: 'instant' },
  { path: 'navigation.headingTrue', policy: 'instant' },
  { path: 'name', policy: 'instant' },
  { path: 'design.aisShipType', policy: 'instant' },
]
