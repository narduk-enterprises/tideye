import type { SignalKDelta } from '~/types/signalk/signalk-types'

export const SIGNALK_SELF_SLICE_KEYS = [
  'navigation',
  'wind',
  'depth',
  'water',
  'outside',
  'inside',
  'current',
  'tide',
  'steering',
  'propulsion',
  'batteries',
  'solar',
  'inverters',
  'chargers',
  'tanks',
  'notifications',
  'entertainment',
] as const

export type SignalKSelfSliceKey = (typeof SIGNALK_SELF_SLICE_KEYS)[number]

export function filterSignalKDelta(
  delta: SignalKDelta,
  pathDebounces: Map<string, number>,
  currentTime: number,
  updateInterval: number,
): SignalKDelta | null {
  const processedUpdates = []

  for (const update of delta.updates || []) {
    const filteredValues = (update.values || []).filter((value) => {
      const lastUpdate = pathDebounces.get(value.path) || 0
      if (currentTime - lastUpdate >= updateInterval) {
        pathDebounces.set(value.path, currentTime)
        return true
      }
      return false
    })

    const hasMeta = Boolean(update.meta?.length)
    if (filteredValues.length === 0 && !hasMeta) continue

    processedUpdates.push({
      ...update,
      values: filteredValues,
    })
  }

  if (processedUpdates.length === 0) return null

  return {
    ...delta,
    updates: processedUpdates,
  }
}

export function collectTouchedSelfSlices(delta: SignalKDelta): Set<SignalKSelfSliceKey> {
  const touched = new Set<SignalKSelfSliceKey>()

  for (const update of delta.updates || []) {
    for (const value of update.values || []) {
      const sliceKey = mapPathToSliceKey(value.path)
      if (sliceKey) touched.add(sliceKey)
    }
    for (const meta of update.meta || []) {
      const sliceKey = mapPathToSliceKey(meta.path)
      if (sliceKey) touched.add(sliceKey)
    }
  }

  return touched
}

export function cloneSignalKSlice<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.slice() as T
  }
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as T
  }
  return value
}

function mapPathToSliceKey(path: string): SignalKSelfSliceKey | null {
  if (path.startsWith('navigation.')) return 'navigation'
  if (path.startsWith('environment.wind.')) return 'wind'
  if (path.startsWith('environment.depth.')) return 'depth'
  if (path.startsWith('environment.water.')) return 'water'
  if (path.startsWith('environment.outside.')) return 'outside'
  if (path.startsWith('environment.inside.')) return 'inside'
  if (path.startsWith('environment.current.')) return 'current'
  if (path.startsWith('environment.tide.')) return 'tide'
  if (path.startsWith('steering.')) return 'steering'
  if (path.startsWith('propulsion.')) return 'propulsion'
  if (path.startsWith('electrical.batteries.')) return 'batteries'
  if (path.startsWith('electrical.solar.')) return 'solar'
  if (path.startsWith('electrical.inverters.')) return 'inverters'
  if (path.startsWith('electrical.chargers.')) return 'chargers'
  if (path.startsWith('tanks.')) return 'tanks'
  if (path.startsWith('notifications.')) return 'notifications'
  if (path.startsWith('entertainment.')) return 'entertainment'
  return null
}
