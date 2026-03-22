// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import type {
  SignalKModel,
  Design,
  Sensors,
  Propulsion,
  Environment,
  Tanks,
  Navigation,
  Steering,
  Electrical,
  Notifications,
  Entertainment,
  Value,
  SignalKDelta,
} from '~/types/signalk/signalk-types'
import { type UnitPreferences, getUnitConverter } from '~/utils/unitConversions'
import { Inverter, type InverterData } from '~/types/signalk/inverter'

// Add this type to improve path typing
type SignalKPath = keyof SignalKModel | `${keyof SignalKModel}.${string}`

export class Vessel implements Partial<SignalKModel> {
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
  communication?: {}
  entertainment?: Partial<Entertainment>
  private inverters: Map<string, Inverter> = new Map()
  private unitConverter: ReturnType<typeof getUnitConverter>

  constructor(data: SignalKModel | SignalKDelta, unitPreferences: Partial<UnitPreferences> = {}) {
    this.unitConverter = getUnitConverter(unitPreferences)

    if ('context' in data && 'updates' in data) {
      // This is a SignalKDelta
      this.updateFromSignalK(data)
    } else {
      // This is a SignalKModel
      Object.assign(this, this.parseData(data))
    }
  }

  private parseData(data: Partial<SignalKModel>): Partial<SignalKModel> {
    const parsed: Partial<SignalKModel> = {}
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        ;(parsed as any)[key] = this.parseNestedObject(value)
      } else {
        ;(parsed as any)[key] = value
      }
    }
    return parsed
  }

  private parseNestedObject(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }
    if ('value' in obj && typeof obj === 'object') {
      return obj as Value<unknown>
    }
    const parsed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      parsed[key] = this.parseNestedObject(value)
    }
    return parsed
  }

  get currentPosition(): { latitude: number; longitude: number } | null {
    return this.navigation?.position?.value ?? null
  }

  updateFromSignalK(delta: SignalKDelta): void {
    if (delta.updates) {
      for (const update of delta.updates) {
        if (update.meta) {
          for (const { path, value } of update.meta) {
            this.updateMetaByPath(path as SignalKPath, value)
          }
        }
        if (update.values) {
          for (const { path, value } of update.values) {
            this.updateValueByPath(path as SignalKPath, value)
          }
        }
      }
    }

    // Handle inverter updates
    for (const update of delta.updates ?? []) {
      for (const value of update.values ?? []) {
        if (value.path.startsWith('electrical.inverters.')) {
          const [, , inverterId, ...rest] = value.path.split('.')
          if (!this.inverters.has(inverterId)) {
            this.inverters.set(inverterId, new Inverter({} as InverterData))
          }
          const inverter = this.inverters.get(inverterId)!
          // Update the specific inverter property
          this.updateInverterValue(inverter, rest.join('.'), value.value)
        }
      }
    }
  }

  private updateValueByPath(path: SignalKPath, value: unknown): void {
    const pathParts = path.split('.')
    let current: Record<string, unknown> = this as unknown as Record<string, unknown>
    const lastIndex = pathParts.length - 1

    for (let i = 0; i < lastIndex; i++) {
      const part = pathParts[i]
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    const existing =
      typeof current[pathParts[lastIndex]!] === 'object' && current[pathParts[lastIndex]!] !== null
        ? (current[pathParts[lastIndex]!] as Record<string, unknown>)
        : {}

    current[pathParts[lastIndex]!] = {
      ...existing,
      value,
    }
  }

  private updateMetaByPath(path: SignalKPath, meta: unknown): void {
    const pathParts = path.split('.')
    let current: Record<string, unknown> = this as unknown as Record<string, unknown>
    const lastIndex = pathParts.length - 1

    for (let i = 0; i < lastIndex; i++) {
      const part = pathParts[i]
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    // Store meta information alongside the value
    if (!current[pathParts[lastIndex]!]) {
      current[pathParts[lastIndex]!] = {}
    }
    ;(current[pathParts[lastIndex]!] as Record<string, unknown>).meta = meta
  }

  getValue<T>(path: SignalKPath): T | undefined {
    return path.split('.').reduce((obj, part) => {
      return (obj as Record<string, unknown>)?.[part]
    }, this as unknown) as Value<T>['value']
  }

  getFormattedValue(
    path: SignalKPath,
    options: { fromUnit?: string; decimals?: number } = {},
  ): string {
    const value = this.getValue<number>(path)
    if (value === undefined || value === null) {
      //console.log('Unknown value for path', path)
      return 'Unknown'
    }

    if (path.includes('courseOverGround')) {
      //console.log('getFormattedValue', path, value, options)
    }

    const { fromUnit, decimals } = options

    if (path.includes('length') || path.includes('depth')) {
      return this.unitConverter.formatLength(value, fromUnit as string, decimals)
    } else if (path.includes('speed')) {
      return this.unitConverter.formatSpeed(value, fromUnit as string, decimals)
    } else if (path.includes('temperature')) {
      return this.unitConverter.formatTemperature(value, fromUnit as string, decimals)
    } else if (path.includes('pressure')) {
      return this.unitConverter.formatPressure(value, fromUnit as string, decimals)
    } else if (
      path.includes('angle') ||
      path.includes('direction') ||
      path.includes('heading') ||
      path.includes('course') ||
      path.includes('magneticVariation')
    ) {
      return this.unitConverter.formatAngle(value, fromUnit as string, decimals)
    } else if (path.includes('volume')) {
      return this.unitConverter.formatVolume(value, fromUnit as string, decimals)
    } else if (path.includes('mass') || path.includes('weight')) {
      return this.unitConverter.formatMass(value, fromUnit as string, decimals)
    }

    // Default to returning the raw value as a string
    return value.toString()
  }

  updateUnitPreferences(preferences: Partial<UnitPreferences>): void {
    this.unitConverter = getUnitConverter(preferences)
  }

  private updateInverterValue(inverter: Inverter, path: string, value: any) {
    const parts = path.split('.')
    let current: any = inverter
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]!]) {
        current[parts[i]!] = {}
      }
      current = current[parts[i]!]
    }
    current[parts.at(-1)!] = { value }
  }
}
