// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import type { Value } from '~/types/signalk/signalk-types'

export interface InverterData {
  acout: {
    power: Value<number>
    voltage: Value<number>
    frequency: Value<number>
    current: Value<number>
  }
  acin: {
    power: Value<number>
    voltage: Value<number>
    frequency: Value<number>
    current: Value<number>
    currentLimit: Value<number>
  }
  mode: Value<string>
  modeNumber: Value<number>
  name?: Value<string>
}

export class Inverter implements InverterData {
  acout: InverterData['acout']
  acin: InverterData['acin']
  mode: InverterData['mode']
  modeNumber: InverterData['modeNumber']
  name?: InverterData['name']

  constructor(data: Partial<InverterData> = {}) {
    this.acout = data.acout || {
      power: { value: 0 },
      voltage: { value: 0 },
      frequency: { value: 0 },
      current: { value: 0 },
    }

    this.acin = data.acin || {
      power: { value: 0 },
      voltage: { value: 0 },
      frequency: { value: 0 },
      current: { value: 0 },
      currentLimit: { value: 0 },
    }

    this.mode = data.mode || { value: 'unknown' }
    this.modeNumber = data.modeNumber || { value: 0 }
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
