import { describe, expect, it } from 'vitest'
import type { SignalKModel } from '~/types/signalk/signalk-types'
import { Vessel } from '~/types/signalk/vessel'

describe('Vessel.updateFromSignalK', () => {
  it('applies values and metadata from the same delta update', () => {
    const vessel = new Vessel({} as SignalKModel)

    vessel.updateFromSignalK({
      context: 'vessels.self',
      updates: [
        {
          source: { label: 'test', type: 'NMEA2000' },
          timestamp: '2026-03-22T00:00:00.000Z',
          values: [{ path: 'environment.wind.speedTrue', value: 8.2 }],
          meta: [{ path: 'environment.wind.speedTrue', value: { units: 'm/s' } }],
        },
      ],
    })

    expect(vessel.environment?.wind?.speedTrue?.value).toBe(8.2)
    expect(vessel.environment?.wind?.speedTrue?.meta).toEqual({ units: 'm/s' })
  })

  it('keeps multiple update entries instead of flattening them', () => {
    const vessel = new Vessel({} as SignalKModel)

    vessel.updateFromSignalK({
      context: 'vessels.self',
      updates: [
        {
          source: { label: 'gps', type: 'NMEA2000' },
          timestamp: '2026-03-22T00:00:00.000Z',
          values: [{ path: 'navigation.position', value: { latitude: 1, longitude: 2 } }],
        },
        {
          source: { label: 'wind', type: 'NMEA2000' },
          timestamp: '2026-03-22T00:00:01.000Z',
          values: [{ path: 'environment.wind.speedTrue', value: 12.3 }],
          meta: [{ path: 'environment.wind.speedTrue', value: { displayName: 'True Wind' } }],
        },
      ],
    })

    expect(vessel.navigation?.position?.value).toEqual({ latitude: 1, longitude: 2 })
    expect(vessel.environment?.wind?.speedTrue?.value).toBe(12.3)
    expect(vessel.environment?.wind?.speedTrue?.meta).toEqual({ displayName: 'True Wind' })
  })
})
