import type { Ref } from 'vue'
import { useSignalK } from '~/composables/useSignalK'

export function useSignalKData() {
  const signalK = useSignalK()

  function accessor(slice: Ref<any>, selector: (value: any) => any) {
    return () => computed(() => (slice.value ? selector(slice.value) : undefined))
  }

  return {
    getBatteryData: accessor(signalK.batteries, (value) => value?.tideyeBmv),
    getSolarData: accessor(signalK.solar, (value) => value),
    getInverterData: accessor(signalK.inverters, (value) => value),
    getChargerData: accessor(signalK.chargers, (value) => value),
    getWindData: accessor(signalK.wind, (value) => value),
    getTankData: accessor(signalK.tanks, (value) => ({
      freshWater: value?.freshWater,
      fuel: value?.fuel,
    })),
    getWaterTempData: accessor(signalK.water, (value) => value?.temperature),
    getDepthData: accessor(signalK.depth, (value) => value),
    getEntertainmentData: accessor(signalK.entertainment, (value) => value),
    getNavigationData: accessor(signalK.navigation, (value) => value),
    getSteeringData: accessor(signalK.steering, (value) => value),
    getPropulsionData: accessor(signalK.propulsion, (value) => value),
    getAirTemperatureData: () =>
      computed(() => ({
        outside: signalK.outside.value?.temperature,
        inside: signalK.inside.value?.temperature,
      })),
    getBarometricPressureData: () =>
      computed(() => ({
        outside: signalK.outside.value?.pressure,
        inside: signalK.inside.value?.pressure,
      })),
    getCurrentData: accessor(signalK.current, (value) => value),
    getTideData: accessor(signalK.tide, (value) => value),
    getGNSSData: accessor(signalK.navigation, (value) => value?.gnss),
    getAttitudeData: accessor(signalK.navigation, (value) => value?.attitude),
    getNotificationsData: accessor(signalK.notifications, (value) => value),
    getEnvironmentData: () =>
      computed(() => ({
        outside: signalK.outside.value,
        inside: signalK.inside.value,
        weather: undefined,
      })),
  }
}
