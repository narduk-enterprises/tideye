import { defineStore } from 'pinia'
import type { AISVessel } from '~/types/map'
import type { SignalKDelta, SignalKModel } from '~/types/signalk/signalk-types'
import type { UnitPreferences } from '~/utils/unitConversions'
import {
  AIS_FLUSH_INTERVAL_MS,
  CONNECT_TIMEOUT_MS,
  DELTA_UPDATE_INTERVAL_MS,
  ENDPOINT_PROBE_TIMEOUT_MS,
  IDLE_DISCONNECT_DELAY_MS,
  LOCAL_UPGRADE_CHECK_INTERVAL_MS,
  RECONNECT_DELAY_MS,
  STALE_AIS_TIMEOUT_MS,
} from '~/config/signalk'
import {
  buildSignalKSubscriptionCommands,
  createEmptySignalKBundleCounts,
  createSignalKBundleManager,
  type SignalKBundleKey,
} from '~/utils/signalk-bundles'
import {
  cloneSignalKSlice,
  collectTouchedSelfSlices,
  filterSignalKDelta,
  type SignalKSelfSliceKey,
} from '~/utils/signalk-delta'
import {
  resolveSignalKClientEndpoints,
  type SignalKConnectionEndpointKind,
  type SignalKEndpoint,
} from '~/utils/signalk-endpoints'
import {
  transitionSignalKTransportState,
  type SignalKConnectionEvent,
  type SignalKTransportState,
} from '~/utils/signalk-state'

type Present<T> = Exclude<T, null | undefined>
type EnvironmentState = Present<SignalKModel['environment']>
type ElectricalState = Present<SignalKModel['electrical']>

export interface SignalKSelfState {
  navigation: Present<SignalKModel['navigation']> | null
  wind: Present<EnvironmentState['wind']> | null
  depth: Present<EnvironmentState['depth']> | null
  water: Present<EnvironmentState['water']> | null
  outside: Present<EnvironmentState['outside']> | null
  inside: Present<EnvironmentState['inside']> | null
  current: Present<EnvironmentState['current']> | null
  tide: Present<EnvironmentState['tide']> | null
  steering: Present<SignalKModel['steering']> | null
  propulsion: Present<SignalKModel['propulsion']> | null
  batteries: Present<ElectricalState['batteries']> | null
  solar: Present<ElectricalState['solar']> | null
  inverters: Present<ElectricalState['inverters']> | null
  chargers: Present<ElectricalState['chargers']> | null
  tanks: Present<SignalKModel['tanks']> | null
  notifications: Present<SignalKModel['notifications']> | null
  entertainment: Present<SignalKModel['entertainment']> | null
}

const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  length: 'ft',
  speed: 'knot',
  temperature: 'F',
  pressure: 'kPa',
  angle: 'deg',
  volume: 'gal',
  mass: 'lb',
}

const INITIAL_TRANSPORT_STATE: SignalKTransportState = {
  connectionState: 'idle',
  activeEndpointKind: 'none',
  lastError: null,
}

export const useSignalKStore = defineStore('signalk', () => {
  const runtimeConfig = useRuntimeConfig()

  const client = shallowRef<any>(null)
  const api = shallowRef<any>(null)

  const transport = shallowRef<SignalKTransportState>({ ...INITIAL_TRANSPORT_STATE })
  const connectionState = computed(() => transport.value.connectionState)
  const activeEndpointKind = computed(() => transport.value.activeEndpointKind)
  const lastError = computed(() => transport.value.lastError)
  const lastDeltaAt = ref<number | null>(null)
  const activeSignalKBaseUrl = ref<string | null>(null)

  const navigation = shallowRef<SignalKSelfState['navigation']>(null)
  const wind = shallowRef<SignalKSelfState['wind']>(null)
  const depth = shallowRef<SignalKSelfState['depth']>(null)
  const water = shallowRef<SignalKSelfState['water']>(null)
  const outside = shallowRef<SignalKSelfState['outside']>(null)
  const inside = shallowRef<SignalKSelfState['inside']>(null)
  const current = shallowRef<SignalKSelfState['current']>(null)
  const tide = shallowRef<SignalKSelfState['tide']>(null)
  const steering = shallowRef<SignalKSelfState['steering']>(null)
  const propulsion = shallowRef<SignalKSelfState['propulsion']>(null)
  const batteries = shallowRef<SignalKSelfState['batteries']>(null)
  const solar = shallowRef<SignalKSelfState['solar']>(null)
  const inverters = shallowRef<SignalKSelfState['inverters']>(null)
  const chargers = shallowRef<SignalKSelfState['chargers']>(null)
  const tanks = shallowRef<SignalKSelfState['tanks']>(null)
  const notifications = shallowRef<SignalKSelfState['notifications']>(null)
  const entertainment = shallowRef<SignalKSelfState['entertainment']>(null)

  const selfState = computed<SignalKModel>(() => ({
    navigation: navigation.value ?? undefined,
    environment: {
      wind: wind.value ?? undefined,
      depth: depth.value ?? undefined,
      water: water.value ?? undefined,
      outside: outside.value ?? undefined,
      inside: inside.value ?? undefined,
      current: current.value ?? undefined,
      tide: tide.value ?? undefined,
    },
    steering: steering.value ?? undefined,
    propulsion: propulsion.value ?? undefined,
    electrical: {
      batteries: batteries.value ?? undefined,
      solar: solar.value ?? undefined,
      inverters: inverters.value ?? undefined,
      chargers: chargers.value ?? undefined,
    },
    tanks: tanks.value ?? undefined,
    notifications: notifications.value ?? undefined,
    entertainment: entertainment.value ?? undefined,
  }))

  const otherVessels = shallowRef<Map<string, AISVessel>>(new Map())
  const otherVesselsList = computed(() => Array.from(otherVessels.value.values()))
  const showOtherVessels = ref(false)
  const totalUpdates = ref(0)
  const unitPreferences = ref<UnitPreferences>({ ...DEFAULT_UNIT_PREFERENCES })
  const bundleCounts = shallowRef(createEmptySignalKBundleCounts())

  const deltaListeners = new Set<(delta: SignalKDelta) => void>()
  const pathDebounces = new Map<string, number>()
  const _aisPending = new Map<string, AISVessel>()
  const _aisMetadataCache = new Map<
    string,
    {
      name: string | null
      shipType: number | null
      destination: string | null
      callSign: string | null
      length: number | null
      beam: number | null
      draft: number | null
    }
  >()

  let selfModel: any = null
  let wiredSignalKClient: any = null
  let initInFlight: Promise<void> | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let staleCleanupInterval: ReturnType<typeof setInterval> | null = null
  let aisFlushInterval: ReturnType<typeof setInterval> | null = null
  let localUpgradeInterval: ReturnType<typeof setInterval> | null = null
  let allowReconnect = false
  let appliedSubscriptionSignature = ''
  let aisNamesLoadedForConnection = false

  const bundleManager = createSignalKBundleManager({
    idleDisconnectMs: IDLE_DISCONNECT_DELAY_MS,
    onFirstAcquire: () => {
      allowReconnect = true
      void ensureConnected()
    },
    onIdleDisconnect: () => {
      void disconnectToIdle()
    },
  })

  function updateTransport(
    event: SignalKConnectionEvent,
    payload: {
      endpointKind?: SignalKConnectionEndpointKind
      error?: string | null
    } = {},
  ) {
    transport.value = transitionSignalKTransportState(transport.value, event, payload)
  }

  function syncBundleCounts() {
    bundleCounts.value = bundleManager.snapshotCounts()
  }

  function clearSelfSlices() {
    navigation.value = null
    wind.value = null
    depth.value = null
    water.value = null
    outside.value = null
    inside.value = null
    current.value = null
    tide.value = null
    steering.value = null
    propulsion.value = null
    batteries.value = null
    solar.value = null
    inverters.value = null
    chargers.value = null
    tanks.value = null
    notifications.value = null
    entertainment.value = null
  }

  function readSelfSlice(sliceKey: SignalKSelfSliceKey) {
    switch (sliceKey) {
      case 'navigation':
        return selfModel?.navigation ?? null
      case 'wind':
        return selfModel?.environment?.wind ?? null
      case 'depth':
        return selfModel?.environment?.depth ?? null
      case 'water':
        return selfModel?.environment?.water ?? null
      case 'outside':
        return selfModel?.environment?.outside ?? null
      case 'inside':
        return selfModel?.environment?.inside ?? null
      case 'current':
        return selfModel?.environment?.current ?? null
      case 'tide':
        return selfModel?.environment?.tide ?? null
      case 'steering':
        return selfModel?.steering ?? null
      case 'propulsion':
        return selfModel?.propulsion ?? null
      case 'batteries':
        return selfModel?.electrical?.batteries ?? null
      case 'solar':
        return selfModel?.electrical?.solar ?? null
      case 'inverters':
        return selfModel?.electrical?.inverters ?? null
      case 'chargers':
        return selfModel?.electrical?.chargers ?? null
      case 'tanks':
        return selfModel?.tanks ?? null
      case 'notifications':
        return selfModel?.notifications ?? null
      case 'entertainment':
        return selfModel?.entertainment ?? null
    }
  }

  function writeSelfSlice(sliceKey: SignalKSelfSliceKey) {
    const nextValue = cloneSignalKSlice(readSelfSlice(sliceKey))

    switch (sliceKey) {
      case 'navigation':
        navigation.value = nextValue as SignalKSelfState['navigation']
        break
      case 'wind':
        wind.value = nextValue as SignalKSelfState['wind']
        break
      case 'depth':
        depth.value = nextValue as SignalKSelfState['depth']
        break
      case 'water':
        water.value = nextValue as SignalKSelfState['water']
        break
      case 'outside':
        outside.value = nextValue as SignalKSelfState['outside']
        break
      case 'inside':
        inside.value = nextValue as SignalKSelfState['inside']
        break
      case 'current':
        current.value = nextValue as SignalKSelfState['current']
        break
      case 'tide':
        tide.value = nextValue as SignalKSelfState['tide']
        break
      case 'steering':
        steering.value = nextValue as SignalKSelfState['steering']
        break
      case 'propulsion':
        propulsion.value = nextValue as SignalKSelfState['propulsion']
        break
      case 'batteries':
        batteries.value = nextValue as SignalKSelfState['batteries']
        break
      case 'solar':
        solar.value = nextValue as SignalKSelfState['solar']
        break
      case 'inverters':
        inverters.value = nextValue as SignalKSelfState['inverters']
        break
      case 'chargers':
        chargers.value = nextValue as SignalKSelfState['chargers']
        break
      case 'tanks':
        tanks.value = nextValue as SignalKSelfState['tanks']
        break
      case 'notifications':
        notifications.value = nextValue as SignalKSelfState['notifications']
        break
      case 'entertainment':
        entertainment.value = nextValue as SignalKSelfState['entertainment']
        break
    }
  }

  function syncAllSelfSlices() {
    if (!selfModel) {
      clearSelfSlices()
      return
    }

    writeSelfSlice('navigation')
    writeSelfSlice('wind')
    writeSelfSlice('depth')
    writeSelfSlice('water')
    writeSelfSlice('outside')
    writeSelfSlice('inside')
    writeSelfSlice('current')
    writeSelfSlice('tide')
    writeSelfSlice('steering')
    writeSelfSlice('propulsion')
    writeSelfSlice('batteries')
    writeSelfSlice('solar')
    writeSelfSlice('inverters')
    writeSelfSlice('chargers')
    writeSelfSlice('tanks')
    writeSelfSlice('notifications')
    writeSelfSlice('entertainment')
  }

  function syncTouchedSelfSlices(touchedSlices: Set<SignalKSelfSliceKey>) {
    for (const sliceKey of touchedSlices) {
      writeSelfSlice(sliceKey)
    }
  }

  function getClientEndpoints(): SignalKEndpoint[] {
    return resolveSignalKClientEndpoints({
      remoteBaseUrl: runtimeConfig.public.signalKRemoteBaseUrl,
      localBaseUrl: runtimeConfig.public.signalKLocalBaseUrl,
      devBaseUrl: runtimeConfig.public.signalKDevBaseUrl,
      isDev: import.meta.dev,
      pageProtocol: window.location.protocol === 'https:' ? 'https:' : 'http:',
    })
  }

  async function canReachEndpoint(
    endpoint: SignalKEndpoint,
    timeoutMs = ENDPOINT_PROBE_TIMEOUT_MS,
  ): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(endpoint.probeUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response.ok
    } catch {
      return false
    }
  }

  async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
        }),
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }

  function clearReconnectTimer() {
    if (!reconnectTimeout) return
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  function stopRuntimeIntervals() {
    if (staleCleanupInterval) {
      clearInterval(staleCleanupInterval)
      staleCleanupInterval = null
    }
    if (aisFlushInterval) {
      clearInterval(aisFlushInterval)
      aisFlushInterval = null
    }
    if (localUpgradeInterval) {
      clearInterval(localUpgradeInterval)
      localUpgradeInterval = null
    }
  }

  function resetSignalKDataState() {
    api.value = null
    selfModel = null
    activeSignalKBaseUrl.value = null
    lastDeltaAt.value = null
    totalUpdates.value = 0
    pathDebounces.clear()
    clearSelfSlices()
    _aisPending.clear()
    _aisMetadataCache.clear()
    otherVessels.value = new Map()
    appliedSubscriptionSignature = ''
    aisNamesLoadedForConnection = false
  }

  async function disconnectClient(target: any) {
    if (!target) return

    if (wiredSignalKClient === target) {
      target.off?.('delta', dispatchDelta)
      wiredSignalKClient = null
    }

    target.cleanupListeners?.()
    target.removeAllListeners?.()
    await target.disconnect?.()
  }

  function subscriptionSignature(commands: ReturnType<typeof buildSignalKSubscriptionCommands>) {
    return JSON.stringify(commands)
  }

  function syncSubscriptions() {
    const activeClient = client.value
    if (!activeClient) return

    const commands = buildSignalKSubscriptionCommands(bundleCounts.value)
    const nextSignature = subscriptionSignature(commands)
    if (nextSignature === appliedSubscriptionSignature) {
      return
    }

    activeClient.unsubscribe?.()
    for (const command of commands) {
      activeClient.subscribe(command)
    }

    appliedSubscriptionSignature = nextSignature

    if (bundleCounts.value.ais > 0 && !aisNamesLoadedForConnection) {
      aisNamesLoadedForConnection = true
      void fetchAISNames()
    }
  }

  function startAISFlush() {
    if (aisFlushInterval) return
    aisFlushInterval = setInterval(flushAIS, AIS_FLUSH_INTERVAL_MS)
  }

  function flushAIS() {
    if (_aisPending.size === 0) return
    const next = new Map(otherVessels.value)
    for (const [id, vessel] of _aisPending) {
      next.set(id, vessel)
    }
    otherVessels.value = next
    _aisPending.clear()
  }

  function cleanupStaleVessels() {
    const now = Date.now()
    const next = new Map(otherVessels.value)
    let changed = false

    for (const [id, vessel] of next) {
      if (now - vessel.lastUpdate > STALE_AIS_TIMEOUT_MS) {
        next.delete(id)
        changed = true
      }
    }

    if (changed) {
      otherVessels.value = next
    }
  }

  function startStaleCleanup() {
    if (staleCleanupInterval) return
    staleCleanupInterval = setInterval(cleanupStaleVessels, 60_000)
  }

  function startLocalUpgradeChecks() {
    if (localUpgradeInterval) {
      clearInterval(localUpgradeInterval)
      localUpgradeInterval = null
    }

    if (!import.meta.client || activeEndpointKind.value !== 'remote') return

    localUpgradeInterval = setInterval(async () => {
      if (!bundleManager.hasActiveBundles() || initInFlight) {
        return
      }

      const localEndpoint = getClientEndpoints().find((endpoint) => endpoint.kind === 'local')
      if (!localEndpoint) return

      if (await canReachEndpoint(localEndpoint, 2_000)) {
        await reconnectToPreferredEndpoint()
      }
    }, LOCAL_UPGRADE_CHECK_INTERVAL_MS)
  }

  async function reconnectToPreferredEndpoint() {
    if (initInFlight) {
      await initInFlight
      return
    }

    const previousClient = client.value
    client.value = null
    stopRuntimeIntervals()
    resetSignalKDataState()
    await disconnectClient(previousClient)
    await ensureConnected()
  }

  function scheduleReconnect(reason?: unknown) {
    if (
      !allowReconnect ||
      reconnectTimeout ||
      !bundleManager.hasActiveBundles() ||
      !import.meta.client
    ) {
      return
    }

    updateTransport('retry-scheduled', {
      endpointKind: activeEndpointKind.value,
      error: toErrorMessage(reason),
    })

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null
      void ensureConnected()
    }, RECONNECT_DELAY_MS)
  }

  function bindConnectionLifecycle(nextClient: any, endpoint: SignalKEndpoint) {
    const handleConnectionLoss = async (reason?: unknown) => {
      if (client.value !== nextClient) return

      client.value = null
      stopRuntimeIntervals()
      resetSignalKDataState()
      updateTransport('disconnect', {
        endpointKind: endpoint.kind,
        error: toErrorMessage(reason),
      })
      await disconnectClient(nextClient)
      scheduleReconnect(reason ?? `${endpoint.label} disconnected`)
    }

    nextClient.on('disconnect', () => {
      void handleConnectionLoss(`${endpoint.label} disconnected`)
    })
    nextClient.on('error', (error: unknown) => {
      void handleConnectionLoss(error)
    })
  }

  function subscribeDelta(callback: (delta: SignalKDelta) => void) {
    deltaListeners.add(callback)
    return () => {
      deltaListeners.delete(callback)
    }
  }

  function updateSelfFromDelta(delta: SignalKDelta) {
    if (!selfModel) return

    const currentTime = Date.now()
    const filteredDelta = filterSignalKDelta(
      delta,
      pathDebounces,
      currentTime,
      DELTA_UPDATE_INTERVAL_MS,
    )

    if (!filteredDelta) {
      return
    }

    const touchedSlices = collectTouchedSelfSlices(filteredDelta)
    selfModel.updateFromSignalK(filteredDelta)
    syncTouchedSelfSlices(touchedSlices)
    totalUpdates.value += 1
  }

  function updateOtherVessel(context: string, delta: SignalKDelta) {
    const vesselId = context.replace('vessels.', '')
    const existing = _aisPending.get(vesselId) ?? otherVessels.value.get(vesselId)
    const target: AISVessel = existing || {
      id: vesselId,
      name: null,
      mmsi: null,
      shipType: null,
      lat: null,
      lng: null,
      cog: null,
      sog: null,
      heading: null,
      lastUpdate: Date.now(),
      destination: null,
      callSign: null,
      length: null,
      beam: null,
      draft: null,
      navState: null,
    }

    if (!existing) {
      const cached = _aisMetadataCache.get(vesselId)
      if (cached) {
        if (cached.name && !target.name) target.name = cached.name
        if (cached.shipType != null && target.shipType == null) target.shipType = cached.shipType
        if (cached.destination && !target.destination) target.destination = cached.destination
        if (cached.callSign && !target.callSign) target.callSign = cached.callSign
        if (cached.length != null && target.length == null) target.length = cached.length
        if (cached.beam != null && target.beam == null) target.beam = cached.beam
        if (cached.draft != null && target.draft == null) target.draft = cached.draft
      }
    }

    for (const update of delta.updates || []) {
      for (const value of update.values || []) {
        switch (value.path) {
          case 'navigation.position':
            if (
              (value.value as Record<string, number> | undefined)?.latitude != null &&
              (value.value as Record<string, number> | undefined)?.longitude != null
            ) {
              target.lat = Number((value.value as Record<string, number>).latitude)
              target.lng = Number((value.value as Record<string, number>).longitude)
            }
            break
          case 'navigation.courseOverGroundTrue':
            if (value.value != null) target.cog = (Number(value.value) * 180) / Math.PI
            break
          case 'navigation.speedOverGround':
            if (value.value != null) target.sog = Number(value.value) * 1.94384
            break
          case 'navigation.headingTrue':
            if (value.value != null) target.heading = (Number(value.value) * 180) / Math.PI
            break
          case 'name':
            if (typeof value.value === 'string') target.name = value.value
            break
          case 'design.aisShipType':
            if ((value.value as Record<string, unknown> | undefined)?.id != null) {
              target.shipType = Number((value.value as Record<string, unknown>).id)
            } else if (typeof value.value === 'number') target.shipType = value.value
            break
        }
      }
    }

    const mmsiMatch = vesselId.match(/mmsi:(\d+)/)
    if (mmsiMatch) {
      target.mmsi = mmsiMatch[1] ?? null
    }

    target.lastUpdate = Date.now()
    _aisPending.set(vesselId, target)
  }

  function handleDelta(delta: SignalKDelta) {
    const context = delta.context || ''
    const selfMmsi = selfModel?.mmsi

    if (context === 'vessels.self' || (selfMmsi && context.includes(selfMmsi))) {
      updateSelfFromDelta(delta)
      return
    }

    if (context.startsWith('vessels.')) {
      updateOtherVessel(context, delta)
    }
  }

  function dispatchDelta(delta: SignalKDelta) {
    lastDeltaAt.value = Date.now()
    handleDelta(delta)

    for (const callback of deltaListeners) {
      try {
        callback(delta)
      } catch (error) {
        console.error('[SignalK] delta listener error', error)
      }
    }
  }

  async function fetchAISNames() {
    if (!api.value || !activeSignalKBaseUrl.value) return

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(`${activeSignalKBaseUrl.value}/signalk/v1/api/vessels`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) return

      const vessels = await response.json()
      for (const [contextKey, rawData] of Object.entries(vessels as Record<string, any>)) {
        if (contextKey === 'self') continue

        const data = rawData as any
        const name: string | null = data?.name ?? null
        const shipType: number | null = data?.design?.aisShipType?.value?.id ?? null
        const destination: string | null = data?.navigation?.destination?.commonName?.value ?? null
        const callSign: string | null = data?.communication?.callsignVhf?.value ?? null
        const length: number | null = data?.design?.length?.value?.overall ?? null
        const beam: number | null =
          typeof data?.design?.beam?.value === 'number' ? data.design.beam.value : null
        const draft: number | null =
          data?.design?.draft?.value?.current ?? data?.design?.draft?.value?.maximum ?? null

        _aisMetadataCache.set(contextKey, {
          name,
          shipType,
          destination,
          callSign,
          length,
          beam,
          draft,
        })

        const existing = otherVessels.value.get(contextKey)
        if (existing) {
          if (name && !existing.name) existing.name = name
          if (shipType != null && existing.shipType == null) existing.shipType = shipType
          if (destination && !existing.destination) existing.destination = destination
          if (callSign && !existing.callSign) existing.callSign = callSign
          if (length != null && existing.length == null) existing.length = length
          if (beam != null && existing.beam == null) existing.beam = beam
          if (draft != null && existing.draft == null) existing.draft = draft
        }
      }
    } catch {
      // Fall back to delta-driven naming if the REST fetch fails.
    }
  }

  async function connectToEndpoint(endpoint: SignalKEndpoint, ClientCtor: any, VesselCtor: any) {
    const nextClient = new ClientCtor({
      hostname: endpoint.hostname,
      port: endpoint.port,
      useTLS: endpoint.useTLS,
      notifications: false,
      reconnect: false,
      autoConnect: false,
      maxRetries: 1,
    })

    try {
      await withTimeout(
        nextClient.connect(),
        CONNECT_TIMEOUT_MS,
        `Timed out connecting to ${endpoint.label} SignalK`,
      )

      const nextApi = (await withTimeout(
        nextClient.API(),
        CONNECT_TIMEOUT_MS,
        `Timed out preparing ${endpoint.label} SignalK API`,
      )) as any

      const response = await withTimeout(
        nextApi.self(),
        CONNECT_TIMEOUT_MS,
        `Timed out loading ${endpoint.label} SignalK vessel data`,
      )

      if (!response) {
        throw new Error(`SignalK ${endpoint.label} did not return vessel data`)
      }

      bindConnectionLifecycle(nextClient, endpoint)

      client.value = nextClient
      api.value = nextApi
      selfModel = new VesselCtor(response, unitPreferences.value)
      activeSignalKBaseUrl.value = endpoint.baseUrl
      lastDeltaAt.value = Date.now()
      appliedSubscriptionSignature = ''
      aisNamesLoadedForConnection = false
      updateTransport('connect-success', { endpointKind: endpoint.kind })
      syncAllSelfSlices()
      startStaleCleanup()
      startAISFlush()
      syncSubscriptions()
      startLocalUpgradeChecks()

      if (wiredSignalKClient !== nextClient) {
        nextClient.on('delta', dispatchDelta)
        wiredSignalKClient = nextClient
      }
    } catch (error) {
      await disconnectClient(nextClient)
      throw error
    }
  }

  async function ensureConnected() {
    if (!import.meta.client || !allowReconnect || !bundleManager.hasActiveBundles()) {
      return
    }

    if (client.value || initInFlight) {
      return initInFlight ?? Promise.resolve()
    }

    initInFlight = (async () => {
      clearReconnectTimer()
      stopRuntimeIntervals()
      resetSignalKDataState()

      const { Client } = await import('@signalk/client')
      const { Vessel } = await import('~/types/signalk/vessel')
      const endpoints = getClientEndpoints()

      let lastConnectError: unknown = null
      updateTransport('connect-start', { endpointKind: endpoints[0]?.kind ?? 'none' })

      for (const endpoint of endpoints) {
        try {
          if (endpoint.kind !== 'remote' && !(await canReachEndpoint(endpoint))) {
            lastConnectError = new Error(`SignalK ${endpoint.label} unavailable`)
            continue
          }

          await connectToEndpoint(endpoint, Client, Vessel)
          return
        } catch (error) {
          lastConnectError = error
        }
      }

      updateTransport('connect-failure', {
        endpointKind: activeEndpointKind.value,
        error: toErrorMessage(lastConnectError),
      })
      scheduleReconnect(lastConnectError)
    })()

    try {
      await initInFlight
    } finally {
      initInFlight = null
    }
  }

  async function disconnectToIdle() {
    clearReconnectTimer()
    stopRuntimeIntervals()

    const activeClient = client.value
    client.value = null
    resetSignalKDataState()
    updateTransport('idle')
    await disconnectClient(activeClient)
  }

  function bootstrap() {
    allowReconnect = true
  }

  function acquireBundle(bundleKey: SignalKBundleKey) {
    bundleManager.acquire(bundleKey)
    syncBundleCounts()
    syncSubscriptions()
  }

  function releaseBundle(bundleKey: SignalKBundleKey) {
    bundleManager.release(bundleKey)
    syncBundleCounts()
    syncSubscriptions()
  }

  function setUnitPreferences(preferences: Partial<UnitPreferences>) {
    unitPreferences.value = { ...unitPreferences.value, ...preferences }
    selfModel?.updateUnitPreferences?.(unitPreferences.value)
  }

  async function cleanup() {
    allowReconnect = false
    clearReconnectTimer()
    bundleManager.reset()
    syncBundleCounts()
    await disconnectToIdle()
  }

  function selectSelfSlice<K extends SignalKSelfSliceKey>(sliceKey: K) {
    switch (sliceKey) {
      case 'navigation':
        return navigation
      case 'wind':
        return wind
      case 'depth':
        return depth
      case 'water':
        return water
      case 'outside':
        return outside
      case 'inside':
        return inside
      case 'current':
        return current
      case 'tide':
        return tide
      case 'steering':
        return steering
      case 'propulsion':
        return propulsion
      case 'batteries':
        return batteries
      case 'solar':
        return solar
      case 'inverters':
        return inverters
      case 'chargers':
        return chargers
      case 'tanks':
        return tanks
      case 'notifications':
        return notifications
      case 'entertainment':
        return entertainment
    }
  }

  return {
    connectionState,
    activeEndpointKind,
    lastDeltaAt,
    lastError,
    selfState,
    navigation,
    wind,
    depth,
    water,
    outside,
    inside,
    current,
    tide,
    steering,
    propulsion,
    batteries,
    solar,
    inverters,
    chargers,
    tanks,
    notifications,
    entertainment,
    otherVessels,
    otherVesselsList,
    showOtherVessels,
    totalUpdates,
    bundleCounts,
    bootstrap,
    cleanup,
    acquireBundle,
    releaseBundle,
    selectSelfSlice,
    setUnitPreferences,
    subscribeDelta,
  }
})

function toErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}
