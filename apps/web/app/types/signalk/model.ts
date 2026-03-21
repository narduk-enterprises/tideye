// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
export class SailingVessel implements SignalKModel {
  mmsi: string
  name: string
  design: Design
  sensors: Sensors
  propulsion: Propulsion
  environment: Environment
  tanks: Tanks
  navigation: Navigation
  steering: Steering
  electrical: Electrical
  notifications: Notifications
  communication: {
    callsignVhf: string
  }
  entertainment: Entertainment

  constructor(data: SignalKModel) {
    this.mmsi = data.mmsi
    this.name = data.name
    this.design = data.design
    this.sensors = data.sensors
    this.propulsion = data.propulsion
    this.environment = data.environment
    this.tanks = data.tanks
    this.navigation = data.navigation
    this.steering = data.steering
    this.electrical = data.electrical
    this.notifications = data.notifications
    this.communication = data.communication
    this.entertainment = data.entertainment
  }

  get currentPosition(): { latitude: number; longitude: number } {
    const position = this.navigation?.position?.value
    if (!position) {
      return { latitude: 0, longitude: 0 }
    }
    return { latitude: position.latitude, longitude: position.longitude }
  }

  updateFromSignalK(data: {
    updates: Array<{ values: Array<{ path: string; value: unknown }>; $source: string }>
    context: string
  }): void {
    if (data.updates)
      for (const update of data.updates) {
        for (const value of update.values) {
          const pathParts = value.path.split('.')

          let current: any = this
          for (let i = 0; i < pathParts.length; i++) {
            if (i === pathParts.length - 1) {
              if (
                current[pathParts[i]] &&
                typeof current[pathParts[i]] === 'object' &&
                'value' in current[pathParts[i]]
              ) {
                current[pathParts[i]].value = value.value
              } else {
                current[pathParts[i]] = value.value
              }
            } else {
              if (!current[pathParts[i]]) {
                current[pathParts[i]] = {}
              }
              current = current[pathParts[i]]
            }
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
      pgn: number
      src: string
      deviceInstance: number
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

export interface Meta {
  description?: string
  properties?: Record<string, Property>
  units?: string
}

export interface Property {
  type: string
  description: string
  units?: string
}

export interface Value<T> {
  value: T
  meta: Meta
  $source: string
  timestamp: string
  pgn?: number
  sentence?: string
  values?: Record<string, Value<T>>
}

export interface Design {
  aisShipType: Value<{
    id: number
    name: string
  }>
  draft: Value<{
    minimum?: number
    maximum?: number
    current?: number
    canoe?: number
  }>
  length: Value<{
    overall?: number
    hull?: number
    waterline?: number
  }>
  beam: Value<number>
  airHeight: Value<number>
}

export interface Sensors {
  gps: {
    fromBow: Value<number>
    fromCenter: Value<number>
  }
  ais: {
    class: Value<string>
    fromBow: Value<number>
    fromCenter: Value<number>
  }
}

export interface Propulsion {
  port: {
    runTime: Value<number>
    runTimeTrip: Value<number>
  }
  engine_0: {
    runTime: Value<number>
    runTimeTrip: Value<number>
  }
  starboard: {
    runTime: Value<number>
    runTimeTrip: Value<number>
  }
  engine_1: {
    runTime: Value<number>
    runTimeTrip: Value<number>
  }
}

export interface Environment {
  wind: {
    speedApparent: Value<number>
    angleApparent: Value<number>
    directionTrue: Value<number>
    directionMagnetic: Value<number>
    speedOverGround: Value<number>
    speedTrue: Value<number>
    angleTrueWater: Value<number>
    speedPeriodMax: Value<number>
    speedPeriodAverage: Value<number>
    speedMaxPeriodAverage: Value<number>
  }
  water: {
    temperature: Value<number>
  }
  depth: {
    belowTransducer: Value<number>
    surfaceToTransducer: Value<number>
    belowSurface: Value<number>
  }
  outside?: {
    temperature?: Value<number>
    pressure?: Value<number>
  }
  inside?: {
    temperature?: Value<number>
    pressure?: Value<number>
  }
  current?: {
    value?: unknown
  }
  tide?: {
    value?: unknown
  }
  weather?: {
    value?: unknown
  }
}

export interface Tanks {
  fuel: Record<
    string,
    {
      currentLevel: Value<number>
      capacity: Value<number>
    }
  >
  freshWater: Record<
    string,
    {
      currentLevel: Value<number>
      capacity: Value<number>
    }
  >
}

export interface Navigation {
  headingMagnetic: Value<number>
  rateOfTurn: Value<number>
  attitude: Value<{
    yaw: number
    pitch: number
    roll: number
  }>
  speedOverGround: Value<number>
  position: Value<{
    longitude: number
    latitude: number
    altitude?: number
  }>
  speedThroughWater: Value<number>
  speedThroughWaterReferenceType: Value<string>
  trip: {
    log: Value<number>
  }
  log: Value<number>
  speedPeriodMax: Value<number>
  speedPeriodAverage: Value<number>
  speedMaxPeriodAverage: Value<number>
  courseOverGroundTrue: Value<number>
  gnss?: unknown
  destination?: unknown
  anchor?: unknown
  magneticVariation?: Value<number>
  headingTrue?: Value<number>
  courseOverGroundMagnetic?: Value<number>
}

export interface Steering {
  autopilot: {
    state: Value<string>
  }
  rudderAngle?: Value<number>
}

export interface Electrical {
  batteries: Record<
    string,
    {
      voltage: Value<number>
      current: Value<number>
      capacity: {
        timeRemaining: Value<number | null>
      }
      temperature: Value<number>
    }
  >
  converter: Record<
    string,
    {
      undefined: {
        operatingState: Value<string>
        temperatureState: Value<string>
      }
    }
  >
  switches: {
    bank: Record<
      string,
      Record<
        string,
        {
          state: Value<number>
          order: Value<number>
        }
      >
    >
  }
  solar?: unknown
  inverters?: unknown
  chargers?: unknown
}

export interface Notifications {
  server: {
    newVersion: Value<{
      state: string
      method: string[]
      message: string
    }>
  }
  ais: Record<
    string,
    Value<{
      message: string
      method: string[]
      state: string
      timestamp: string
    }>
  >
}

export interface Entertainment {
  device: {
    fusion1: {
      output: Record<
        string,
        {
          source: Value<string>
        }
      >
      avsource: Record<
        string,
        {
          name: Value<string>
          track?: {
            elapsedTime: Value<number>
          }
          tuner?: {
            mode: Value<number>
            frequency: Value<number>
          }
        }
      >
    }
  }
}

export interface SignalKModel {
  mmsi: string
  name: string
  design: Design
  sensors: Sensors
  propulsion: Propulsion
  environment: Environment
  tanks: Tanks
  navigation: Navigation
  steering: Steering
  electrical: Electrical
  notifications: Notifications
  communication: {
    callsignVhf: string
  }
  entertainment: Entertainment
}
