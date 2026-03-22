export interface SwitchState {
  label: string
  state: 'on' | 'off' | 'unknown'
  writable: boolean
  category: string
}

interface ToggleResult {
  message?: string
  state?: 'on' | 'off' | 'unknown'
}

export function useSwitching() {
  const switches = ref<Record<string, SwitchState>>({})
  const loading = ref<Record<string, boolean>>({})
  const error = ref<string | null>(null)
  const lastAction = ref<string | null>(null)
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null

  const fetchStates = async () => {
    try {
      // eslint-disable-next-line nuxt-guardrails/no-raw-fetch -- composable, not a store; CSRF not needed on GET
      const data = await $fetch<Record<string, SwitchState>>('/api/switching/state')
      switches.value = data
      error.value = null
    } catch (err: any) {
      console.warn('[Switching] Failed to fetch states:', err.message || err)
      error.value = err.data?.message || err.message || 'Failed to load switch states'
    }
  }

  const toggleSwitch = async (switchId: string) => {
    const sw = switches.value[switchId]
    if (!sw || !sw.writable) return

    loading.value = { ...loading.value, [switchId]: true }
    error.value = null
    lastAction.value = null

    try {
      // eslint-disable-next-line nuxt-guardrails/no-raw-fetch -- composable, not a store; CSRF header added manually
      const result = await $fetch<ToggleResult>('/api/switching/command', {
        method: 'POST',
        body: { switchId },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      const nextState
        = result?.state === 'on' || result?.state === 'off'
          ? result.state
          : sw.state === 'on'
            ? 'off'
            : sw.state === 'off'
              ? 'on'
              : 'unknown'

      switches.value = {
        ...switches.value,
        [switchId]: { ...sw, state: nextState },
      }
      lastAction.value = result?.message || `Sent toggle for ${sw.label}`

      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        fetchStates().catch(() => {})
      }, 1500)
    } catch (err: any) {
      const msg = err.data?.message || err.statusMessage || err.message || `Failed to toggle ${sw.label}`
      error.value = msg
    } finally {
      loading.value = { ...loading.value, [switchId]: false }
    }
  }

  const isLoading = (switchId: string) => computed(() => !!loading.value[switchId])

  const lights = computed(() =>
    Object.entries(switches.value)
      .filter(([, sw]) => sw.category === 'light')
      .map(([id, sw]) => ({ id, ...sw })),
  )

  const pumps = computed(() =>
    Object.entries(switches.value)
      .filter(([, sw]) => sw.category === 'pump')
      .map(([id, sw]) => ({ id, ...sw })),
  )

  return {
    switches,
    lights,
    pumps,
    loading,
    error,
    lastAction,
    fetchStates,
    toggleSwitch,
    isLoading,
  }
}
