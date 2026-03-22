declare module '@signalk/client' {
  export class Client {
    constructor(options: ClientOptions)
    connect(): Promise<void>
    disconnect(): Promise<void>
    removeAllListeners(): void
    cleanupListeners(): void
    subscribe(subscription: Subscription): void
    unsubscribe(): void
    on(event: string, callback: (data: SignalKDelta) => void): void
    off(event: string, callback: (data: SignalKDelta) => void): void
    API<T>(): Promise<API<T>>
  }
  export interface ClientOptions {
    hostname?: string
    port?: number
    useTLS?: boolean
    useAuthentication?: boolean
    reconnect?: boolean
    autoConnect?: boolean
    notifications?: boolean
    subscriptions?: Subscription[]
    username?: string
    password?: string
    useVersion?: number
    wsKeepaliveInterval?: number
    disableRetryServers?: boolean
    headers?: Record<string, string>
    keepMTUChunked?: boolean
    maxRetries?: number
    pingTimeout?: number
    pingInterval?: number
    sendMeta?: 'all' | 'none'
  }

  export interface API<T> {
    self: () => Promise<SailingVessel>
    get: (path: string) => Promise<ApiResponse<T>>
    login: (username: string, password: string) => Promise<ApiResponse<T>>
    logout: () => Promise<ApiResponse<T>>
    sources: () => Promise<ApiResponse<T>>
    vessels: () => Promise<ApiResponse<T>>
    self: (path: string) => Promise<ApiResponse<T>>
    vessel: (mrn: string) => Promise<ApiResponse<T>>
    name: () => Promise<ApiResponse<T>>
  }

  export interface ApiResponse<T = SignalKValue> {
    state: 'COMPLETED' | 'FAILED'
    statusCode: number
    data?: T
    message?: string
  }

  export interface SubscriptionPath {
    path: SignalKPath
    policy: 'instant' | 'ideal' | 'fixed'
  }

  export interface Subscription {
    context: string
    subscribe: SubscriptionPath[]
  }

  export type SubscriptionCallback = (delta: SignalKDelta) => void

  export function subscribe(context: string, paths: SignalKPath[]): Subscription
}
