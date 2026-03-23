import { z } from 'zod'
import { definePublicMutation, withValidatedBody } from '#layer/server/utils/mutation'

const bodySchema = z.object({
  switchId: z.string().min(1),
})

const SWITCH_COMMAND_RATE = {
  namespace: 'tideye-switch-command',
  maxRequests: 60,
  windowMs: 60_000,
}

export default definePublicMutation(
  {
    rateLimit: SWITCH_COMMAND_RATE,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, body }) => {
    const { switchId } = body

    if (!SWITCH_MAP[switchId]) {
      throw createError({ statusCode: 404, statusMessage: `Unknown switch: ${switchId}` })
    }

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
  },
)
