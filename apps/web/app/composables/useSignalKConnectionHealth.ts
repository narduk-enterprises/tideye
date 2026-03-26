import { useSignalK } from '~/composables/useSignalK'
import { DELTA_STALE_MS } from '~/config/signalk'

export function useSignalKConnectionHealth() {
  const signalK = useSignalK()
  const now = ref(Date.now())

  const timer = setInterval(() => {
    now.value = Date.now()
  }, 1_000)

  onBeforeUnmount(() => {
    clearInterval(timer)
  })

  const isStale = computed(() => {
    if (signalK.lastDeltaAt.value == null) return true
    return now.value - signalK.lastDeltaAt.value > DELTA_STALE_MS
  })

  const isConnected = computed(
    () => signalK.connectionState.value === 'connected' && !isStale.value,
  )

  return {
    isConnected,
    isStale,
    connectionState: signalK.connectionState,
    lastDeltaAt: signalK.lastDeltaAt,
  }
}
