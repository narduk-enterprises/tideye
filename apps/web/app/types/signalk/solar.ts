// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import type { Value } from '~/types/signalk/signalk-types'

export interface SolarData {
  voltage?: Value<number>
  current?: Value<number>
  power?: Value<number>
  controllerMode?: Value<string>
  panelVoltage?: Value<number>
  panelCurrent?: Value<number>
  panelPower?: Value<number>
  controllerVoltage?: Value<number>
  controllerCurrent?: Value<number>
  controllerPower?: Value<number>
  yieldToday?: Value<number>
  yieldYesterday?: Value<number>
  name?: Value<string>
}

export class Solar implements SolarData {
  voltage?: Value<number>
  current?: Value<number>
  power?: Value<number>
  controllerMode?: Value<string>
  panelVoltage?: Value<number>
  panelCurrent?: Value<number>
  panelPower?: Value<number>
  controllerVoltage?: Value<number>
  controllerCurrent?: Value<number>
  controllerPower?: Value<number>
  yieldToday?: Value<number>
  yieldYesterday?: Value<number>
  name?: Value<string>

  constructor(data: Partial<SolarData> = {}) {
    this.panelVoltage = data.panelVoltage || { value: 0 }
    this.panelCurrent = data.panelCurrent || { value: 0 }
    this.panelPower = data.panelPower || { value: 0 }
    this.controllerVoltage = data.controllerVoltage || { value: 0 }
    this.controllerCurrent = data.controllerCurrent || { value: 0 }
    this.controllerPower = data.controllerPower || { value: 0 }
    this.yieldToday = data.yieldToday || { value: 0 }
    this.yieldYesterday = data.yieldYesterday || { value: 0 }
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
