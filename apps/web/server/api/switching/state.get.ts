export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  return getSwitchStates({
    signalKBaseUrl: config.signalKBaseUrl,
    signalKFallbackBaseUrl: config.signalKFallbackBaseUrl,
  })
})
