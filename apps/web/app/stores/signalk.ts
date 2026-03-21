import { defineStore } from 'pinia'
import type { UnitPreferences } from '~/utils/unitConversions'

// Circular buffer for windspeed history
class CircularBuffer<T> {
  private buffer: (T | undefined)[]
  private pointer: number = 0

  constructor(private capacity: number) {
    this.buffer = new Array<T | undefined>(capacity)
  }

  push(item: T): void {
    this.buffer[this.pointer] = item
    this.pointer = (this.pointer + 1) % this.capacity
  }

  getAll(): T[] {
    const validItems = this.buffer.filter((item): item is T => item !== undefined)
    const splitIndex = validItems.length >= this.capacity ? this.pointer : 0
    return [...validItems.slice(splitIndex), ...validItems.slice(0, splitIndex)]
  }

  clear(): void {
    this.buffer = new Array<T | undefined>(this.capacity)
    this.pointer = 0
  }
}

export const useSignalKStore = defineStore('signalk', () => {
  const client = ref<any>(null)

  const api = ref<any>(null)

  const vessel = ref<any>(null)

  const otherVessels = ref<Map<string, any>>(new Map())

  const BUFFER_SIZE = 100
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
  const UPDATE_INTERVAL = 250
  const pathDebounces = new Map<string, number>()

  const isLocalSignalK = ref(false)

  // SignalK server endpoints
  const LOCAL_SERVER = 'https://signalk-local.tideye.com'
  const REMOTE_SERVER = 'https://signalk-public.tideye.com'

  let localCheckInterval: ReturnType<typeof setInterval> | null = null

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

  const selectiveSubscriptions: any[] = [
    { path: 'navigation.position', policy: 'instant' },
    { path: 'navigation.headingTrue', policy: 'instant' },
    { path: 'navigation.headingMagnetic', policy: 'instant' },
    { path: 'navigation.speedThroughWater', policy: 'instant' },
    { path: 'navigation.speedOverGround', policy: 'instant' },
    { path: 'navigation.courseOverGroundTrue', policy: 'instant' },
    { path: 'navigation.courseOverGroundMagnetic', policy: 'instant' },
    { path: 'navigation.attitude', policy: 'instant' },
    { path: 'navigation.gnss.*', policy: 'instant' },
    { path: 'navigation.trip.log', policy: 'instant' },
    { path: 'navigation.log', policy: 'instant' },
    { path: 'navigation.magneticVariation', policy: 'instant' },
    { path: 'navigation.destination.*', policy: 'instant' },
    { path: 'navigation.anchor.*', policy: 'instant' },
    { path: 'environment.wind.speedApparent', policy: 'instant' },
    { path: 'environment.wind.angleApparent', policy: 'instant' },
    { path: 'environment.wind.speedTrue', policy: 'instant' },
    { path: 'environment.wind.directionTrue', policy: 'instant' },
    { path: 'environment.wind.speedOverGround', policy: 'instant' },
    { path: 'environment.wind.angleTrueGround', policy: 'instant' },
    { path: 'environment.wind.angleTrueWater', policy: 'instant' },
    { path: 'environment.wind.directionMagnetic', policy: 'instant' },
    { path: 'environment.water.temperature', policy: 'instant' },
    { path: 'environment.water.salinity', policy: 'instant' },
    { path: 'environment.depth.belowSurface', policy: 'instant' },
    { path: 'environment.depth.belowKeel', policy: 'instant' },
    { path: 'environment.depth.belowTransducer', policy: 'instant' },
    { path: 'environment.outside.*', policy: 'instant' },
    { path: 'environment.inside.*', policy: 'instant' },
    { path: 'environment.current.*', policy: 'instant' },
    { path: 'environment.tide.*', policy: 'instant' },
    { path: 'environment.weather.*', policy: 'instant' },
    { path: 'steering.rudderAngle', policy: 'instant' },
    { path: 'steering.autopilot.*', policy: 'instant' },
    { path: 'propulsion.*', policy: 'instant' },
    { path: 'electrical.batteries.*', policy: 'instant' },
    { path: 'electrical.solar.*', policy: 'instant' },
    { path: 'electrical.inverters.*', policy: 'instant' },
    { path: 'electrical.chargers.*', policy: 'instant' },
    { path: 'tanks.*', policy: 'instant' },
    { path: 'design.*', policy: 'instant' },
    { path: 'notifications.*', policy: 'instant' },
    { path: 'entertainment.*', policy: 'instant' },
  ]

  const subscribeToSelfUpdates = () => {
    const subs = { context: 'vessels.self', subscribe: selectiveSubscriptions }
    client.value?.subscribe(subs)
    client.value?.on('delta', handleAllSelfUpdates)
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
      totalUpdates.value++
      lastUpdateTime.value = currentTime
    }
  }

  const handleAllSelfUpdates = (delta: any) => {
    updateVessel(delta)
  }

  const initClient = async () => {
    // Only runs on the client side
    if (!import.meta.client) return

    // Dynamically import SignalK client
    const { Client } = await import('@signalk/client')
    const { Vessel } = await import('~/types/signalk/vessel')

    const isLocal = await isLocalServerAvailable()
    const hostname = isLocal ? 'signalk-local.tideye.com' : 'signalk-public.tideye.com'
    isLocalSignalK.value = isLocal

    try {
      client.value = new Client({
        hostname,
        port: 443,
        useTLS: true,
        reconnect: true,
        autoConnect: true,
      })

      client.value.on('connect', () => {
        subscribeToSelfUpdates()
      })

      await client.value.connect()
      api.value = await client.value.API()

      const response = await api.value.self()
      if (response) {
        vessel.value = new Vessel(response, unitPreferences.value)
      }
    } catch (error) {
      console.warn('SignalK connection error:', error)
    }

    // Periodically check for local server if using remote
    if (!isLocal) {
      localCheckInterval = setInterval(
        async () => {
          if (await isLocalServerAvailable()) {
            await cleanup()
            await initClient()
          }
        },
        5 * 60 * 1000,
      )
    }
  }

  const setUnitPreferences = (preferences: Partial<UnitPreferences>) => {
    unitPreferences.value = { ...unitPreferences.value, ...preferences }
    vessel.value?.updateUnitPreferences?.(unitPreferences.value)
  }

  const cleanup = async () => {
    if (localCheckInterval) {
      clearInterval(localCheckInterval)
      localCheckInterval = null
    }
    if (client.value) {
      client.value.cleanupListeners?.()
      await client.value.disconnect?.()
      client.value = null
    }
    api.value = null
    vessel.value = null
    windSpeedsBuffer.clear()
    timesBuffer.clear()
    totalUpdates.value = 0
    lastUpdateTime.value = 0
  }

  return {
    vessel,
    windSpeeds,
    windSpeed,
    times,
    initClient,
    fetchVessel: async () => {
      /* no-op for now */
    },
    subscribeToAllUpdates: subscribeToSelfUpdates,
    otherVessels,
    totalUpdates,
    setUnitPreferences,
    cleanup,
    isLocalSignalK,
  }
})
