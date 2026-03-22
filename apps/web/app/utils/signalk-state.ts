import type { SignalKConnectionEndpointKind } from '~/utils/signalk-endpoints'

export type SignalKConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export type SignalKConnectionEvent =
  | 'idle'
  | 'connect-start'
  | 'connect-success'
  | 'retry-scheduled'
  | 'connect-failure'
  | 'disconnect'
  | 'cleanup'

export interface SignalKTransportState {
  connectionState: SignalKConnectionState
  activeEndpointKind: SignalKConnectionEndpointKind
  lastError: string | null
}

export function transitionSignalKTransportState(
  current: SignalKTransportState,
  event: SignalKConnectionEvent,
  payload: {
    endpointKind?: SignalKConnectionEndpointKind
    error?: string | null
  } = {},
): SignalKTransportState {
  switch (event) {
    case 'connect-start':
      return {
        connectionState:
          current.connectionState === 'connected' || current.connectionState === 'reconnecting'
            ? 'reconnecting'
            : 'connecting',
        activeEndpointKind: payload.endpointKind ?? current.activeEndpointKind,
        lastError: payload.error ?? null,
      }
    case 'connect-success':
      return {
        connectionState: 'connected',
        activeEndpointKind: payload.endpointKind ?? current.activeEndpointKind,
        lastError: null,
      }
    case 'retry-scheduled':
      return {
        connectionState: 'reconnecting',
        activeEndpointKind: payload.endpointKind ?? current.activeEndpointKind,
        lastError: payload.error ?? current.lastError,
      }
    case 'connect-failure':
      return {
        connectionState: 'error',
        activeEndpointKind: payload.endpointKind ?? current.activeEndpointKind,
        lastError: payload.error ?? current.lastError,
      }
    case 'disconnect':
      return {
        connectionState: 'reconnecting',
        activeEndpointKind: payload.endpointKind ?? current.activeEndpointKind,
        lastError: payload.error ?? current.lastError,
      }
    case 'cleanup':
    case 'idle':
      return {
        connectionState: 'idle',
        activeEndpointKind: 'none',
        lastError: payload.error ?? null,
      }
    default:
      return current
  }
}
