import { definePublicMutation } from '#layer/server/utils/mutation'

const ACCESS_RATE = {
  namespace: 'tideye-signalk-access',
  maxRequests: 30,
  windowMs: 60_000,
}

export default definePublicMutation(
  {
    rateLimit: ACCESS_RATE,
  },
  async ({ event }) => {
    const config = useRuntimeConfig(event)

    return await createSignalKWriteAccessRequest({
      signalKBaseUrl: config.signalKBaseUrl,
      signalKFallbackBaseUrl: config.signalKFallbackBaseUrl,
      signalKWriteBaseUrl: config.signalKWriteBaseUrl,
      signalKWriteClientId: config.signalKWriteClientId,
      signalKWriteToken: config.signalKWriteToken,
    })
  },
)
