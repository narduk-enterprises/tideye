import { defineStore } from 'pinia'
import type { UnitPreferences } from '~/utils/unitConversions'
import type { AISVessel } from '~/types/map'
import { CircularBuffer } from '~/utils/CircularBuffer'
import {
  AIS_FLUSH_INTERVAL_MS,
  AIS_SUBSCRIPTIONS,
  BUFFER_SIZE,
  LOCAL_CHECK_INTERVAL,
  LOCAL_SERVER,
  SELF_SUBSCRIPTIONS,
  STALE_VESSEL_TIMEOUT,
  UPDATE_INTERVAL,
} from '~/config/signalk'

export const useSignalKStore = defineStore('signalk', () => {
  const client = shallowRef<any>(null)

  const api = shallowRef<any>(null)

  const vessel = shallowRef<any>(null)

  const otherVessels = ref<Map<string, AISVessel>>(new Map())
  const showOtherVessels = ref(false)

  /** Flat array of AIS vessels for rendering on the map */
  const otherVesselsList = computed(() => Array.from(otherVessels.value.values()))

  // ── AIS Update Throttling ──────────────────────────────────
  // Accumulate AIS deltas in a plain (non-reactive) Map, then flush
  // to the reactive ref every AIS_FLUSH_INTERVAL_MS. This reduces Vue
  // reactivity triggers from ~380/s to ~0.5/s.
  const _aisPending = new Map<string, AISVessel>() // non-reactive buffer
  let _aisFlushInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Metadata cache populated by fetchAISNames() REST call.
   * Used by updateOtherVessel() to populate name/shipType on first delta.
   */
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

  function _flushAIS() {
    if (_aisPending.size === 0) return
    const merged = new Map(otherVessels.value)
    for (const [id, v] of _aisPending) {
      merged.set(id, v)
    }
    otherVessels.value = merged
    _aisPending.clear()
  }

  function _startAISFlush() {
    if (_aisFlushInterval) return
    _aisFlushInterval = setInterval(_flushAIS, AIS_FLUSH_INTERVAL_MS)
  }

  // Stale vessel cleanup interval
  let staleCleanupInterval: ReturnType<typeof setInterval> | null = null

  const windSpeedsBuffer = new CircularBuffer<number>(BUFFER_SIZE)
  const timesBuffer = new CircularBuffer<Date>(BUFFER_SIZE)

  const windSpeeds = computed(() => windSpeedsBuffer.getAll())
  const times = computed(() => timesBuffer.getAll())

  const totalUpdates = ref<number>(0)
  const unitPreferences = ref<UnitPreferences>({
    length: 'ft',
    speed: 'knot',
    temperature: 'F',
    pressure: 'kPa',
    angle: 'deg',
    volume: 'gal',
    mass: 'lb',
  })

  const windSpeed = computed(() => {
    const speeds = windSpeeds.value
    return speeds.length > 0 ? speeds.at(-1) : 0
  })

  const lastUpdateTime = ref<number>(0)
  const pathDebounces = new Map<string, number>()

  const isLocalSignalK = ref(false)
  const activeSignalKBaseUrl = ref('https://signalk-public.tideye.com')

  type SignalKEndpointKind = 'dev' | 'local' | 'remote'

  interface SignalKEndpoint {
    kind: SignalKEndpointKind
    label: string
    hostname: string
    port: number
    useTLS: boolean
    baseUrl: string
  }

  // SignalK server endpoints
  const DEV_SERVER = 'http://bee.tideye.com:3000'
  const LOCAL_HTTP_SERVER = 'http://signalk-local.tideye.com'
  const LOCAL_HTTPS_SERVER = 'https://signalk-local.tideye.com'
  const REMOTE_SERVER = 'https://signalk-public.tideye.com'
  const CONNECT_TIMEOUT_MS = 6_000
  const RECONNECT_DELAY_MS = 5_000

  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let initInFlight: Promise<void> | null = null
  let allowReconnect = false
  let localCheckInterval: ReturnType<typeof setInterval> | null = null

  function getSignalKEndpoints(): SignalKEndpoint[] {
    if (import.meta.dev) {
      return [
        {
          kind: 'dev',
          label: 'dev',
          hostname: 'bee.tideye.com',
          port: 3000,
          useTLS: false,
          baseUrl: DEV_SERVER,
        },
      ]
    }

    const localEndpoint: SignalKEndpoint =
      window.location.protocol === 'https:'
        ? {
            kind: 'local',
            label: 'local',
            hostname: 'signalk-local.tideye.com',
            port: 443,
            useTLS: true,
            baseUrl: LOCAL_HTTPS_SERVER,
          }
        : {
            kind: 'local',
            label: 'local',
            hostname: 'signalk-local.tideye.com',
            port: 80,
            useTLS: false,
            baseUrl: LOCAL_HTTP_SERVER,
          }

    return [
      localEndpoint,
      {
        kind: 'remote',
        label: 'internet',
        hostname: 'signalk-public.tideye.com',
        port: 443,
        useTLS: true,
        baseUrl: REMOTE_SERVER,
      },
    ]
  }

  async function isLocalServerAvailable() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const response = await fetch(`${LOCAL_SERVER}/signalk/v1/api/`, {
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
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  function stopLiveIntervals() {
    if (staleCleanupInterval) {
      clearInterval(staleCleanupInterval)
      staleCleanupInterval = null
    }
    if (_aisFlushInterval) {
      clearInterval(_aisFlushInterval)
      _aisFlushInterval = null
    }
    if (localCheckInterval) {
      clearInterval(localCheckInterval)
      localCheckInterval = null
    }
  }

  function resetSignalKDataState() {
    api.value = null
    vessel.value = null
    isLocalSignalK.value = false
    activeSignalKBaseUrl.value = REMOTE_SERVER
    _aisPending.clear()
    _aisMetadataCache.clear()
    otherVessels.value = new Map()
    windSpeedsBuffer.clear()
    timesBuffer.clear()
    totalUpdates.value = 0
    lastUpdateTime.value = 0
    pathDebounces.clear()
  }

  async function disconnectClient(target: any) {
    if (!target) return
    target.cleanupListeners?.()
    await target.disconnect?.()
  }

  function scheduleReconnect(reason?: unknown) {
    if (!allowReconnect || reconnectTimeout || !import.meta.client) {
      return
    }

    if (reason) {
      console.warn('SignalK connection lost, retrying with fallback', reason)
    }

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null
      void initClient()
    }, RECONNECT_DELAY_MS)
  }

  function bindConnectionLifecycle(nextClient: any, endpoint: SignalKEndpoint) {
    const handleConnectionLoss = (reason?: unknown) => {
      if (client.value !== nextClient) {
        return
      }

      client.value = null
      stopLiveIntervals()
      resetSignalKDataState()
      void disconnectClient(nextClient)
      scheduleReconnect(reason || `${endpoint.label} disconnected`)
    }

    nextClient.on('disconnect', () => handleConnectionLoss(`${endpoint.label} disconnected`))
    nextClient.on('error', (error: unknown) => handleConnectionLoss(error))
  }

  const subscribeToSelfUpdates = () => {
    // Subscribe to own vessel data
    const selfSubs = { context: 'vessels.self', subscribe: [...SELF_SUBSCRIPTIONS] }
    client.value?.subscribe(selfSubs)

    // Subscribe to AIS targets (other vessels) — position, name, heading, speed
    const aisSubs = {
      context: 'vessels.*',
      subscribe: [...AIS_SUBSCRIPTIONS],
    }
    client.value?.subscribe(aisSubs)

    // Route deltas to the correct handler based on context
    client.value?.on('delta', handleDelta)
  }

  const updateVessel = (delta: any) => {
    if (!vessel.value) return

    const currentTime = Date.now()

    const updatesToProcess = delta.updates.flatMap((update: any) =>
      update.values.filter((value: any) => {
        const lastUpdate = pathDebounces.get(value.path) || 0
        if (currentTime - lastUpdate >= UPDATE_INTERVAL) {
          pathDebounces.set(value.path, currentTime)
          return true
        }
        return false
      }),
    )

    if (updatesToProcess.length > 0) {
      vessel.value.updateFromSignalK({
        ...delta,
        updates: [
          {
            ...delta.updates[0],
            values: updatesToProcess,
          },
        ],
      })
      // shallowRef doesn't track deep mutations — notify Vue manually
      triggerRef(vessel)
      totalUpdates.value++
      lastUpdateTime.value = currentTime
    }
  }

  /** Route a delta to self-vessel or AIS handler based on context */
  const handleDelta = (delta: any) => {
    const context: string = delta.context || ''
    if (context === 'vessels.self' || context.includes(vessel.value?.mmsi || '__none__')) {
      updateVessel(delta)
    } else if (context.startsWith('vessels.')) {
      updateOtherVessel(context, delta)
    }
  }

  /** Upsert an AIS target from a SignalK delta */
  const updateOtherVessel = (context: string, delta: any) => {
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

    // Merge cached metadata from REST API fetch (if available)
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
      for (const v of update.values || []) {
        switch (v.path) {
          case 'navigation.position':
            if (v.value?.latitude != null && v.value?.longitude != null) {
              target.lat = v.value.latitude
              target.lng = v.value.longitude
            }
            break
          case 'navigation.courseOverGroundTrue':
            if (v.value != null) target.cog = (v.value * 180) / Math.PI
            break
          case 'navigation.speedOverGround':
            if (v.value != null) target.sog = v.value * 1.94384 // m/s → knots
            break
          case 'navigation.headingTrue':
            if (v.value != null) target.heading = (v.value * 180) / Math.PI
            break
          case 'name':
            if (typeof v.value === 'string') target.name = v.value
            break
          case 'design.aisShipType':
            if (v.value?.id != null) target.shipType = Number(v.value.id)
            else if (typeof v.value === 'number') target.shipType = v.value
            break
        }
      }
    }

    // Extract MMSI from context if present
    const mmsiMatch = vesselId.match(/mmsi:(\d+)/)
    if (mmsiMatch) target.mmsi = mmsiMatch[1] ?? null

    target.lastUpdate = Date.now()
    // Buffer in non-reactive map — flushed every 2s
    _aisPending.set(vesselId, target)
  }

  /**
   * One-time fetch of vessel names from the SignalK REST API.
   * AIS vessel names arrive infrequently via deltas (~every 6 min for class B).
   * This seeds our name cache so callouts show real names immediately.
   */
  const fetchAISNames = async () => {
    if (!api.value) return
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const resp = await fetch(`${activeSignalKBaseUrl.value}/signalk/v1/api/vessels`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!resp.ok) return
      const vessels = await resp.json()

      // vessels is an object keyed by SignalK vessel context (e.g. "urn:mrn:imo:mmsi:367596340")
      for (const [contextKey, data] of Object.entries(vessels as Record<string, any>)) {
        if (contextKey === 'self') continue

        const vesselId = contextKey
        const vData = data as any
        const name: string | null = vData?.name ?? null
        const shipType: number | null = vData?.design?.aisShipType?.value?.id ?? null
        const destination: string | null = vData?.navigation?.destination?.commonName?.value ?? null
        const callSign: string | null = vData?.communication?.callsignVhf?.value ?? null
        const length: number | null = vData?.design?.length?.value?.overall ?? null
        const beam: number | null =
          typeof vData?.design?.beam?.value === 'number' ? vData.design.beam.value : null
        const draft: number | null =
          vData?.design?.draft?.value?.current ?? vData?.design?.draft?.value?.maximum ?? null

        // Always cache the metadata for later use by updateOtherVessel
        _aisMetadataCache.set(vesselId, {
          name,
          shipType,
          destination,
          callSign,
          length,
          beam,
          draft,
        })

        // Update existing vessel in reactive map
        const existing = otherVessels.value.get(vesselId)
        if (existing) {
          if (name && !existing.name) existing.name = name
          if (shipType != null && existing.shipType == null) existing.shipType = shipType
          if (destination && !existing.destination) existing.destination = destination
          if (callSign && !existing.callSign) existing.callSign = callSign
          if (length != null && existing.length == null) existing.length = length
          if (beam != null && existing.beam == null) existing.beam = beam
          if (draft != null && existing.draft == null) existing.draft = draft
        }

        // Also update pending buffer
        const pending = _aisPending.get(vesselId)
        if (pending) {
          if (name && !pending.name) pending.name = name
          if (shipType != null && pending.shipType == null) pending.shipType = shipType
          if (destination && !pending.destination) pending.destination = destination
          if (callSign && !pending.callSign) pending.callSign = callSign
          if (length != null && pending.length == null) pending.length = length
          if (beam != null && pending.beam == null) pending.beam = beam
          if (draft != null && pending.draft == null) pending.draft = draft
        }
      }
    } catch {
      // Silently ignore — names will come through deltas eventually
    }
  }

  async function connectToEndpoint(
    endpoint: SignalKEndpoint,
    Client: any,
    Vessel: any,
  ): Promise<boolean> {
    const nextClient = new Client({
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

      const nextApi: { self: () => Promise<unknown> } = await withTimeout(
        nextClient.API(),
        CONNECT_TIMEOUT_MS,
        `Timed out preparing ${endpoint.label} SignalK API`,
      )

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
      vessel.value = new Vessel(response, unitPreferences.value)
      activeSignalKBaseUrl.value = endpoint.baseUrl
      isLocalSignalK.value = endpoint.kind === 'local' || endpoint.kind === 'dev'

      subscribeToSelfUpdates()
      startStaleCleanup()
      _startAISFlush()
      void fetchAISNames()

      return true
    } catch (error) {
      await disconnectClient(nextClient)
      throw error
    }
  }

  const initClient = async () => {
    // Only runs on the client side
    if (!import.meta.client) return

    if (initInFlight) {
      return initInFlight
    }

    allowReconnect = true

    initInFlight = (async () => {
      clearReconnectTimer()
      stopLiveIntervals()

      const previousClient = client.value
      client.value = null
      resetSignalKDataState()
      await disconnectClient(previousClient)

      const { Client } = await import('@signalk/client')
      const { Vessel } = await import('~/types/signalk/vessel')

      const endpoints = getSignalKEndpoints()
      let lastError: unknown = null

      for (const [index, endpoint] of endpoints.entries()) {
        try {
          await connectToEndpoint(endpoint, Client, Vessel)
          return
        } catch (error) {
          lastError = error
          const hasFallback = index < endpoints.length - 1

          if (hasFallback) {
            console.warn(`SignalK ${endpoint.label} endpoint unavailable, trying fallback`, error)
          }
        }
      }

      console.warn('SignalK connection error:', lastError)
      scheduleReconnect(lastError)
    })()

    try {
      await initInFlight
    } finally {
      initInFlight = null
    }

    if (!import.meta.dev && !isLocalSignalK.value) {
      localCheckInterval = setInterval(
        async () => {
          if (await isLocalServerAvailable()) {
            await cleanup()
            await initClient()
          }
        },
        LOCAL_CHECK_INTERVAL,
      )
    }
  }

  const setUnitPreferences = (preferences: Partial<UnitPreferences>) => {
    unitPreferences.value = { ...unitPreferences.value, ...preferences }
    vessel.value?.updateUnitPreferences?.(unitPreferences.value)
  }

  /** Remove AIS targets that haven't been updated in STALE_VESSEL_TIMEOUT */
  const cleanupStaleVessels = () => {
    const now = Date.now()
    for (const [id, v] of otherVessels.value) {
      if (now - v.lastUpdate > STALE_VESSEL_TIMEOUT) {
        otherVessels.value.delete(id)
      }
    }
  }

  const startStaleCleanup = () => {
    if (staleCleanupInterval) return
    staleCleanupInterval = setInterval(cleanupStaleVessels, 60_000)
  }

  const cleanup = async () => {
    allowReconnect = false
    clearReconnectTimer()
    stopLiveIntervals()

    const activeClient = client.value
    client.value = null
    resetSignalKDataState()
    await disconnectClient(activeClient)
  }

  return {
    vessel,
    windSpeeds,
    windSpeed,
    times,
    initClient,
    otherVessels,
    otherVesselsList,
    showOtherVessels,
    totalUpdates,
    setUnitPreferences,
    cleanup,
    isLocalSignalK,
  }
})
