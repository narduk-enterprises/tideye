import type { Battery } from '~/types/signalk/battery'
import type { Solar } from '~/types/signalk/solar'
import type { Inverter } from '~/types/signalk/inverter'
import type { Charger } from '~/types/signalk/charger'

export interface SignalKModel {
  mmsi?: string
  name?: string
  design?: Partial<Design>
  sensors?: Partial<Sensors>
  propulsion?: Partial<Propulsion>
  environment?: Partial<Environment>
  tanks?: Partial<Tanks>
  navigation?: Partial<Navigation>
  steering?: Partial<Steering>
  electrical?: Partial<Electrical>
  notifications?: Partial<Notifications>
  communication?: {
    callsignVhf?: string
  }
  entertainment?: Partial<Entertainment>
}

export interface Value<T> {
  value: T
  meta?: Meta
  $source?: string
  timestamp?: string
  pgn?: number
  sentence?: string
}

export interface Meta {
  description?: string
  units?: string
  displayName?: string
  shortName?: string
}

export interface Design {
  aisShipType?: Value<number>
  airDraft?: Value<number>
  airHeight?: Value<number>
  displacement?: Value<number>
  draft?: Value<{ current?: number; maximum?: number; minimum?: number; canoe?: number }>
  keel?: Value<{ angle?: number; lift?: number }>
  length?: Value<{ overall?: number; hull?: number; waterline?: number }>
  rigging?: Value<string>
  type?: Value<string>
  hullType?: Value<string>
  hullNumber?: Value<string>
  grosstonnage?: Value<number>
  beam?: Value<number>
  nominalDraft?: Value<number>
}

export interface Sensors {
  type?: string
}

export interface Propulsion {
  [key: string]: {
    label?: Value<string>
    state?: Value<string>
    revolutions?: Value<number>
    temperature?: Value<number>
  }
}

export interface Environment {
  outside?: {
    temperature?: Value<number>
    humidity?: Value<number>
    pressure?: Value<number>
  }
  inside?: {
    temperature?: Value<number>
    humidity?: Value<number>
    pressure?: Value<number>
  }
  water?: {
    temperature?: Value<number>
    salinity?: Value<number>
    depth?: Value<number>
  }
  depth?: {
    belowKeel?: Value<number>
    belowTransducer?: Value<number>
    belowSurface?: Value<number>
    transducerToKeel?: Value<number>
  }
  current?: {
    setTrue?: Value<number>
    setMagnetic?: Value<number>
    drift?: Value<number>
  }
  tide?: {
    heightHigh?: Value<number>
    heightNow?: Value<number>
    heightLow?: Value<number>
    timeLow?: Value<string>
    timeHigh?: Value<string>
  }
  wind?: {
    speedApparent?: Value<number>
    angleApparent?: Value<number>
    speedTrue?: Value<number>
    speedOverGround?: Value<number>
    angleTrueGround?: Value<number>
    angleTrueWater?: Value<number>
    directionMagnetic?: Value<number>
    directionTrue?: Value<number>
  }
  time?: Value<string>
  mode?: Value<string>
  weather?: {
    airTemperature?: Value<number>
    airPressure?: Value<number>
    humidity?: Value<number>
    seaTemperature?: Value<number>
    visibility?: Value<number>
    cloudCover?: Value<number>
    precipitation?: {
      rate?: Value<number>
      type?: Value<string>
    }
  }
}

export interface Tanks {
  [key: string]: {
    type?: Value<string>
    capacity?: Value<number>
    currentLevel?: Value<number>
  }
}

export interface Navigation {
  attitude?: Value<{
    pitch?: Value<number>
    roll?: Value<number>
    yaw?: Value<number>
  }>
  position?: Value<Position>
  courseOverGroundTrue?: Value<number>
  courseOverGroundMagnetic?: Value<number>
  speedOverGround?: Value<number>
  speedThroughWater?: Value<number>
  speedThroughWaterLongitudinal?: Value<number>
  speedThroughWaterTransverse?: Value<number>
  leewayAngle?: Value<number>
  log?: Value<number>
  trip?: {
    log?: Value<number>
    lastReset?: Value<string>
  }
  state?: Value<string>
  anchor?: {
    position?: Value<Position>
    currentRadius?: Value<number>
    maxRadius?: Value<number>
  }
  magneticVariation?: Value<number>
  magneticVariationAgeOfService?: Value<number>
  destination?: {
    commonName?: Value<string>
    eta?: Value<string>
    waypoint?: Value<string>
  }
  gnss?: {
    type?: Value<string>
    methodQuality?: Value<string>
    integrity?: Value<string>
    satellites?: Value<number>
    antennaAltitude?: Value<number>
    horizontalDilution?: Value<number>
    positionDilution?: Value<number>
    geoidalSeparation?: Value<number>
    differentialAge?: Value<number>
    differentialReference?: Value<string>
  }
  headingMagnetic?: Value<number>
  headingTrue?: Value<number>
  headingCompass?: Value<number>
  magneticDeviation?: Value<number>
  datetime?: Value<string>
  // Add other navigation properties as needed
}

export interface Position {
  latitude: number
  longitude: number
  altitude?: number
}

export interface Steering {
  rudderAngle?: Value<number>
  autopilot?: {
    state?: Value<string>
    mode?: Value<string>
    target?: {
      headingTrue?: Value<number>
      headingMagnetic?: Value<number>
      windAngleApparent?: Value<number>
      windAngleTrue?: Value<number>
      courseOverGroundTrue?: Value<number>
      courseOverGroundMagnetic?: Value<number>
    }
    // Added properties
    alarm?: Value<string>
    engaged?: Value<boolean>
    pidParameters?: {
      proportional?: Value<number>
      integral?: Value<number>
      derivative?: Value<number>
    }
  }
}

export interface Electrical {
  batteries?: {
    [key: string]: Battery
  }
  solar?: {
    [key: string]: Solar
  }
  inverters?:
    | {
        [key: string]: Inverter
      }
    | Map<string, Inverter>
  chargers?:
    | {
        [key: string]: Charger
      }
    | Map<string, Charger>
}

export interface Notifications {
  [key: string]: Value<{
    message: string
    state: string
    method: string[]
  }>
}

export interface Entertainment {
  type?: string
  device?: {
    fusion1?: {
      output?: {
        zone1?: {
          source?: Value<string>
        }
      }
      avsource?: {
        source11?: {
          track?: any
          name?: Value<string>
          artistName?: Value<string>
          albumName?: Value<string>
          elapsedTime?: Value<number>
          duration?: Value<number>
          playbackState?: Value<string>
        }
      }
    }
  }
}

export interface SignalKUpdate {
  updates: Array<{
    source: {
      label: string
      type: string
      pgn?: number
      src?: string
      deviceInstance?: number
    }
    timestamp: string
    values: Array<{
      path: string
      value: unknown
    }>
    $source: string
  }>
  context: string
}

export type SignalKPath = string

export type SignalKPrimitiveValue = string | number | boolean | null

export interface SignalKComplexValue {
  [key: string]: SignalKValue
}

export type SignalKValue = SignalKPrimitiveValue | SignalKComplexValue | SignalKValue[]

export interface SignalKDelta {
  context: string
  updates: Array<{
    source: {
      label: string
      type: string
      pgn?: number
      src?: string
      deviceInstance?: number
    }
    timestamp: string
    values: Array<{
      path: SignalKPath
      value: SignalKValue
    }>
    meta?: Array<{
      path: SignalKPath
      value: SignalKValue
    }>
  }>
}
