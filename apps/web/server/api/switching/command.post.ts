import { z } from 'zod'

const bodySchema = z.object({
  switchId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request: switchId is required' })
  }

  const { switchId } = parsed.data

  // Validate switch exists
  if (!SWITCH_MAP[switchId]) {
    throw createError({ statusCode: 404, statusMessage: `Unknown switch: ${switchId}` })
  }

  // Reject non-writable switches
  if (!SWITCH_MAP[switchId].writable) {
    throw createError({
      statusCode: 403,
      statusMessage: `Switch ${switchId} is read-only (breaker-reset path not decoded)`,
    })
  }

  const config = useRuntimeConfig(event)
  const currentStates = await getSwitchStates({
    signalKBaseUrl: config.signalKBaseUrl,
    signalKFallbackBaseUrl: config.signalKFallbackBaseUrl,
  })
  const currentState = currentStates[switchId]?.state ?? getSwitchState(switchId)

  const result = await sendSignalKToggleCommand(
    {
      signalKBaseUrl: config.signalKBaseUrl,
      signalKFallbackBaseUrl: config.signalKFallbackBaseUrl,
      signalKWriteBaseUrl: config.signalKWriteBaseUrl,
      signalKWriteClientId: config.signalKWriteClientId,
      signalKWriteToken: config.signalKWriteToken,
    },
    switchId,
  )

  if (result.success) {
    const nextState = currentState === 'on' ? 'off' : currentState === 'off' ? 'on' : 'unknown'
    setSwitchState(switchId, nextState, 'optimistic-toggle')
    return {
      ...result,
      state: nextState,
    }
  }

  throw createError({
    statusCode: result.statusCode || 502,
    statusMessage: result.message || 'Command failed',
  })
})
