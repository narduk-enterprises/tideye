export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  return await getSignalKWriteAccessStatus({
    signalKBaseUrl: config.signalKBaseUrl,
    signalKFallbackBaseUrl: config.signalKFallbackBaseUrl,
    signalKWriteBaseUrl: config.signalKWriteBaseUrl,
    signalKWriteClientId: config.signalKWriteClientId,
    signalKWriteToken: config.signalKWriteToken,
  })
})
