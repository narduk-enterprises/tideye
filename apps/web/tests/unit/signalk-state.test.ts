import { describe, expect, it } from 'vitest'
import { transitionSignalKTransportState } from '~/utils/signalk-state'

describe('transitionSignalKTransportState', () => {
  it('moves from idle to connecting to connected', () => {
    const connecting = transitionSignalKTransportState(
      {
        connectionState: 'idle',
        activeEndpointKind: 'none',
        lastError: null,
      },
      'connect-start',
      { endpointKind: 'local' },
    )

    const connected = transitionSignalKTransportState(connecting, 'connect-success', {
      endpointKind: 'local',
    })

    expect(connecting).toEqual({
      connectionState: 'connecting',
      activeEndpointKind: 'local',
      lastError: null,
    })
    expect(connected).toEqual({
      connectionState: 'connected',
      activeEndpointKind: 'local',
      lastError: null,
    })
  })

  it('marks reconnects and failures with the latest error', () => {
    const reconnecting = transitionSignalKTransportState(
      {
        connectionState: 'connected',
        activeEndpointKind: 'remote',
        lastError: null,
      },
      'disconnect',
      { endpointKind: 'remote', error: 'socket dropped' },
    )

    const failed = transitionSignalKTransportState(reconnecting, 'connect-failure', {
      endpointKind: 'remote',
      error: 'all endpoints failed',
    })

    expect(reconnecting.connectionState).toBe('reconnecting')
    expect(reconnecting.lastError).toBe('socket dropped')
    expect(failed).toEqual({
      connectionState: 'error',
      activeEndpointKind: 'remote',
      lastError: 'all endpoints failed',
    })
  })

  it('resets to idle on cleanup', () => {
    expect(
      transitionSignalKTransportState(
        {
          connectionState: 'connected',
          activeEndpointKind: 'local',
          lastError: 'old error',
        },
        'cleanup',
      ),
    ).toEqual({
      connectionState: 'idle',
      activeEndpointKind: 'none',
      lastError: null,
    })
  })
})
