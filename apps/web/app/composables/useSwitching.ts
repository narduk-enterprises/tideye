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

/** Raymarine-style light panel: nav row, then helm row */
const LIGHT_ORDER = [
  'nav_lights',
  'steaming_lights',
  'anchor_lights',
  'external_helm_light',
  'external_helm_red_light',
  'compass_light_external_helm',
] as const

const PUMP_ORDER = ['water_pressure_pump_stbd', 'water_pressure_pump_port'] as const

export function useSwitching() {
  const switches = ref<Record<string, SwitchState>>({})
  const loading = ref<Record<string, boolean>>({})
  const error = ref<string | null>(null)
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null

  const fetchStates = async () => {
    try {
      const data = await $fetch<Record<string, SwitchState>>('/api/switching/state')
      const merged: Record<string, SwitchState> = {}

      for (const [switchId, nextState] of Object.entries(data)) {
        const currentState = switches.value[switchId]
        merged[switchId] =
          nextState.state === 'unknown' && currentState && currentState.state !== 'unknown'
            ? { ...nextState, state: currentState.state }
            : nextState
      }

      switches.value = merged
      error.value = null
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; message?: string }
      console.warn('[Switching] Failed to fetch states:', e.message || err)
      error.value = e.data?.message || e.message || 'Failed to load switch states'
    }
  }

  const toggleSwitch = async (switchId: string) => {
    const sw = switches.value[switchId]
    if (!sw || !sw.writable) return

    loading.value = { ...loading.value, [switchId]: true }
    error.value = null

    try {
      const result = await $fetch<ToggleResult>('/api/switching/command', {
        method: 'POST',
        body: { switchId },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      const nextState =
        result?.state === 'on' || result?.state === 'off'
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

      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        fetchStates().catch(() => {})
      }, 1500)
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; statusMessage?: string; message?: string }
      error.value =
        e.data?.message || e.statusMessage || e.message || `Failed to toggle ${sw.label}`
    } finally {
      loading.value = { ...loading.value, [switchId]: false }
    }
  }

  const isLoading = (switchId: string) => computed(() => !!loading.value[switchId])

  const lights = computed(() =>
    Object.entries(switches.value)
      .filter(([, sw]) => sw.category === 'light')
      .sort(([leftId], [rightId]) => orderFor(leftId, LIGHT_ORDER) - orderFor(rightId, LIGHT_ORDER))
      .map(([id, sw]) => ({ id, ...sw })),
  )

  const pumps = computed(() =>
    Object.entries(switches.value)
      .filter(([, sw]) => sw.category === 'pump')
      .sort(([leftId], [rightId]) => orderFor(leftId, PUMP_ORDER) - orderFor(rightId, PUMP_ORDER))
      .map(([id, sw]) => ({ id, ...sw })),
  )

  return {
    switches,
    lights,
    pumps,
    loading,
    error,
    fetchStates,
    toggleSwitch,
    isLoading,
  }
}

function orderFor(id: string, order: readonly string[]) {
  const index = order.indexOf(id)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}
