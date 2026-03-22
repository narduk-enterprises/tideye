import { storeToRefs } from 'pinia'
import { useSignalKStore } from '~/stores/signalk'

export function useSignalKData() {
  const signalKStore = useSignalKStore()
  const { vessel } = storeToRefs(signalKStore)

  /** Factory: creates a getter returning a computed over a vessel sub-path. */
  function accessor<T>(fn: (v: any) => T): () => ComputedRef<T | undefined> {
    return () => computed(() => (vessel.value ? fn(vessel.value) : undefined))
  }

  return {
    vessel,
    getBatteryData: accessor((v) => v.electrical?.batteries?.tideyeBmv),
    getSolarData: accessor((v) => v.electrical?.solar),
    getInverterData: accessor((v) => v.electrical?.inverters),
    getChargerData: accessor((v) => v.electrical?.chargers),
    getWindData: accessor((v) => v.environment?.wind),
    getTankData: accessor((v) => ({
      freshWater: v.tanks?.freshWater,
      fuel: v.tanks?.fuel,
    })),
    getWaterTempData: accessor((v) => v.environment?.water?.temperature),
    getDepthData: accessor((v) => v.environment?.depth),
    getEntertainmentData: accessor((v) => v.entertainment),
    getNavigationData: accessor((v) => v.navigation),
    getSteeringData: accessor((v) => v.steering),
    getPropulsionData: accessor((v) => v.propulsion),
    getAirTemperatureData: accessor((v) => ({
      outside: v.environment?.outside?.temperature,
      inside: v.environment?.inside?.temperature,
    })),
    getBarometricPressureData: accessor((v) => ({
      outside: v.environment?.outside?.pressure,
      inside: v.environment?.inside?.pressure,
    })),
    getCurrentData: accessor((v) => v.environment?.current),
    getTideData: accessor((v) => v.environment?.tide),
    getGNSSData: accessor((v) => v.navigation?.gnss),
    getAttitudeData: accessor((v) => v.navigation?.attitude),
    getNotificationsData: accessor((v) => v.notifications),
    getDesignData: accessor((v) => v.design),
    getEnvironmentData: accessor((v) => ({
      outside: v.environment?.outside,
      inside: v.environment?.inside,
      weather: v.environment?.weather,
    })),
  }
}
