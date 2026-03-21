// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import type { Value } from '~/types/signalk/signalk-types'

export interface BatteryData {
  voltage?: Value<number>
  current?: Value<number>
  temperature?: Value<number>
  power?: Value<number>
  capacity?: {
    stateOfCharge?: Value<number>
    timeRemaining?: Value<number>
    discharged?: Value<number>
  }
  name?: Value<string>
}

export class Battery implements BatteryData {
  voltage?: Value<number>
  current?: Value<number>
  temperature?: Value<number>
  power?: Value<number>
  capacity?: {
    stateOfCharge?: Value<number>
    timeRemaining?: Value<number>
    discharged?: Value<number>
  }
  name?: Value<string>

  constructor(data: Partial<BatteryData> = {}) {
    this.voltage = data.voltage || { value: 0 }
    this.current = data.current || { value: 0 }
    this.temperature = data.temperature || { value: 0 }
    this.power = data.power || { value: 0 }
    this.capacity = {
      stateOfCharge: data.capacity?.stateOfCharge || { value: 0 },
      timeRemaining: data.capacity?.timeRemaining || { value: 0 },
      discharged: data.capacity?.discharged || { value: 0 },
    }
    this.name = data.name
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
