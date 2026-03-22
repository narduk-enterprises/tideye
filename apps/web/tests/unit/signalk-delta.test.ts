import { describe, expect, it } from 'vitest'
import {
  cloneSignalKSlice,
  collectTouchedSelfSlices,
  filterSignalKDelta,
} from '~/utils/signalk-delta'

describe('filterSignalKDelta', () => {
  it('retains multiple update entries and meta-only updates', () => {
    const delta = filterSignalKDelta(
      {
        context: 'vessels.self',
        updates: [
          {
            source: { label: 'test', type: 'NMEA0183' },
            timestamp: '2026-03-22T00:00:00.000Z',
            values: [{ path: 'navigation.position', value: { latitude: 1, longitude: 2 } }],
          },
          {
            source: { label: 'test', type: 'NMEA0183' },
            timestamp: '2026-03-22T00:00:01.000Z',
            values: [],
            meta: [{ path: 'environment.wind.speedTrue', value: { units: 'm/s' } }],
          },
        ],
      },
      new Map(),
      1_000,
      250,
    )

    expect(delta?.updates).toHaveLength(2)
    expect(delta?.updates[1]?.meta).toEqual([
      { path: 'environment.wind.speedTrue', value: { units: 'm/s' } },
    ])
  })

  it('debounces repeated value paths without dropping metadata', () => {
    const pathDebounces = new Map<string, number>([['navigation.position', 900]])

    const delta = filterSignalKDelta(
      {
        context: 'vessels.self',
        updates: [
          {
            source: { label: 'test', type: 'NMEA0183' },
            timestamp: '2026-03-22T00:00:02.000Z',
            values: [{ path: 'navigation.position', value: { latitude: 3, longitude: 4 } }],
            meta: [{ path: 'navigation.position', value: { units: 'degrees' } }],
          },
        ],
      },
      pathDebounces,
      1_000,
      250,
    )

    expect(delta?.updates[0]?.values).toEqual([])
    expect(delta?.updates[0]?.meta).toEqual([
      { path: 'navigation.position', value: { units: 'degrees' } },
    ])
  })
})

describe('collectTouchedSelfSlices', () => {
  it('maps value and meta paths to the touched self slices', () => {
    const touched = collectTouchedSelfSlices({
      context: 'vessels.self',
      updates: [
        {
          source: { label: 'test', type: 'NMEA0183' },
          timestamp: '2026-03-22T00:00:00.000Z',
          values: [
            { path: 'navigation.position', value: { latitude: 1, longitude: 2 } },
            { path: 'environment.current.setTrue', value: 1.4 },
          ],
          meta: [{ path: 'notifications.mob', value: { displayName: 'MOB' } }],
        },
      ],
    })

    expect(Array.from(touched).sort()).toEqual(['current', 'navigation', 'notifications'])
  })
})

describe('cloneSignalKSlice', () => {
  it('returns a new shallow object or array', () => {
    const sourceObject = { a: 1 }
    const sourceArray = [1, 2, 3]
    const objectClone = cloneSignalKSlice(sourceObject)
    const arrayClone = cloneSignalKSlice(sourceArray)

    expect(objectClone).toEqual({ a: 1 })
    expect(objectClone).not.toBe(sourceObject)
    expect(arrayClone).toEqual([1, 2, 3])
    expect(arrayClone).not.toBe(sourceArray)
  })
})
