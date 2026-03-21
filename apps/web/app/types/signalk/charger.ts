// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import type { Value } from '~/types/signalk/signalk-types'

export interface ChargerData {
  mode?: Value<string>
  modeNumber?: Value<number>
  power?: Value<number>
  voltage?: Value<number>
  current?: Value<number>
  chargingMode?: Value<string>
  chargingModeNumber?: Value<number>
  capacity?: {
    stateOfCharge?: Value<number>
  }
  leds?: {
    bulk?: Value<number>
    temperature?: Value<number>
    absorption?: Value<number>
    overload?: Value<number>
    inverter?: Value<number>
    float?: Value<number>
    lowBattery?: Value<number>
    mains?: Value<number>
  }
}

export class Charger implements ChargerData {
  mode?: Value<string>
  modeNumber?: Value<number>
  power?: Value<number>
  voltage?: Value<number>
  current?: Value<number>
  chargingMode?: Value<string>
  chargingModeNumber?: Value<number>
  capacity?: {
    stateOfCharge?: Value<number>
  }
  leds?: {
    bulk?: Value<number>
    temperature?: Value<number>
    absorption?: Value<number>
    overload?: Value<number>
    inverter?: Value<number>
    float?: Value<number>
    lowBattery?: Value<number>
    mains?: Value<number>
  }

  constructor(data: Partial<ChargerData> = {}) {
    this.mode = data.mode || { value: 'unknown' }
    this.modeNumber = data.modeNumber || { value: 0 }
    this.power = data.power || { value: 0 }
    this.voltage = data.voltage || { value: 0 }
    this.current = data.current || { value: 0 }
    this.chargingMode = data.chargingMode || { value: 'unknown' }
    this.chargingModeNumber = data.chargingModeNumber || { value: 0 }
    this.capacity = {
      stateOfCharge: data.capacity?.stateOfCharge || { value: 0 },
    }
    this.leds = {
      bulk: data.leds?.bulk || { value: 0 },
      temperature: data.leds?.temperature || { value: 0 },
      absorption: data.leds?.absorption || { value: 0 },
      overload: data.leds?.overload || { value: 0 },
      inverter: data.leds?.inverter || { value: 0 },
      float: data.leds?.float || { value: 0 },
      lowBattery: data.leds?.lowBattery || { value: 0 },
      mains: data.leds?.mains || { value: 0 },
    }
  }

  updateValue(path: string, value: any) {
    const parts = path.split('.')
    let current: any = this

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }

    const lastPart = parts.at(-1)
    if (!current[lastPart]) {
      current[lastPart] = {}
    }
    current[lastPart] = { value }
  }
}
