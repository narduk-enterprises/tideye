// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import convert from 'convert-units'

export interface UnitPreferences {
  length: convert.Unit
  speed: convert.Unit
  temperature: convert.Unit
  pressure: convert.Unit
  angle: 'deg' | 'rad'
  volume: convert.Unit
  mass: convert.Unit
}

const defaultPreferences: UnitPreferences = {
  length: 'ft',
  speed: 'knot',
  temperature: 'F',
  pressure: 'kPa',
  angle: 'deg',
  volume: 'gal',
  mass: 'lb',
}

export function formatValue(
  value: number | undefined | null,
  fromUnit: convert.Unit,
  toUnit: convert.Unit | 'deg' | 'rad',
  decimals: number = 2,
): string {
  if (value === undefined || value === null) return 'Unknown'

  const convertedValue = convert(value)
    .from(fromUnit as convert.Unit)
    .to(toUnit as convert.Unit)

  let formattedUnit: convert.Unit | string = toUnit
  if (toUnit === 'deg') {
    formattedUnit = '°'
  } else if (toUnit === 'knot') {
    formattedUnit = 'knots'
  } else if (toUnit === 'F') {
    formattedUnit = '°F'
  }

  return `${convertedValue.toFixed(decimals)} ${formattedUnit}`.trim()
}

export function getUnitConverter(preferences: Partial<UnitPreferences> = {}) {
  const mergedPreferences = { ...defaultPreferences, ...preferences }

  return {
    formatLength: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'm',
      decimals: number = 2,
    ) => formatValue(value, fromUnit, mergedPreferences.length, decimals),
    formatSpeed: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'm/s',
      decimals: number = 1,
    ) => formatValue(value, fromUnit, mergedPreferences.speed, decimals),
    formatTemperature: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'K',
      decimals: number = 1,
    ) => formatValue(value, fromUnit, mergedPreferences.temperature, decimals),
    formatPressure: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'Pa',
      decimals: number = 2,
    ) => formatValue(value, fromUnit, mergedPreferences.pressure, decimals),
    formatAngle: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'rad',
      decimals: number = 1,
    ) => {
      return formatValue(value, fromUnit, mergedPreferences.angle, decimals)
    },
    formatVolume: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'l',
      decimals: number = 2,
    ) => formatValue(value, fromUnit, mergedPreferences.volume, decimals),
    formatMass: (
      value: number | undefined | null,
      fromUnit: convert.Unit = 'kg',
      decimals: number = 2,
    ) => formatValue(value, fromUnit, mergedPreferences.mass, decimals),
  }
}
