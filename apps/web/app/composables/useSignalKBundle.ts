import type { MaybeRefOrGetter } from 'vue'
import { useSignalK } from '~/composables/useSignalK'
import type { SignalKBundleKey } from '~/utils/signalk-bundles'

interface UseSignalKBundleOptions {
  enabled?: MaybeRefOrGetter<boolean>
}

export function useSignalKBundle(
  bundleKey: SignalKBundleKey,
  options: UseSignalKBundleOptions = {},
) {
  const signalK = useSignalK()
  // eslint-disable-next-line narduk/no-composable-conditional-hooks -- bundle enablement is a reactive option, not a conditional hook call
  const enabled = computed(() => toValue(options.enabled) ?? true)

  let scopeActive = false
  let held = false

  function acquire() {
    if (held) return
    held = true
    signalK.acquireBundle(bundleKey)
  }

  function release() {
    if (!held) return
    held = false
    signalK.releaseBundle(bundleKey)
  }

  function syncHeldState() {
    if (scopeActive && enabled.value) {
      acquire()
      return
    }

    release()
  }

  onMounted(() => {
    scopeActive = true
    syncHeldState()
  })

  onActivated(() => {
    scopeActive = true
    syncHeldState()
  })

  onDeactivated(() => {
    scopeActive = false
    syncHeldState()
  })

  onUnmounted(() => {
    scopeActive = false
    syncHeldState()
  })

  watch(
    enabled,
    () => {
      syncHeldState()
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    release()
  })

  return {
    isHeld: computed(() => held),
    acquire,
    release,
  }
}
