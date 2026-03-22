export {}

declare module 'nuxt/schema' {
  interface RuntimeConfig {
    ydwgHost: string
    ydwgPort: string
    signalKBaseUrl: string
    signalKFallbackBaseUrl: string
    signalKWriteBaseUrl: string
    signalKWriteClientId: string
    signalKWriteToken: string
  }
}
