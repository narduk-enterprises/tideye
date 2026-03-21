import { storeToRefs } from 'pinia'
import { useSignalKStore } from '~/stores/signalk'

export function useSignalKData() {
  const signalKStore = useSignalKStore()
  const { vessel } = storeToRefs(signalKStore)

  const getBatteryData = () => computed(() => vessel.value?.electrical?.batteries?.tideyeBmv)

  const getSolarData = () => computed(() => vessel.value?.electrical?.solar)

  const getInverterData = () => computed(() => vessel.value?.electrical?.inverters)

  const getChargerData = () => computed(() => vessel.value?.electrical?.chargers)

  const getWindData = () => computed(() => vessel.value?.environment?.wind)

  const getTankData = () =>
    computed(() => ({
      freshWater: vessel.value?.tanks?.freshWater,
      fuel: vessel.value?.tanks?.fuel,
    }))

  const getWaterTempData = () => computed(() => vessel.value?.environment?.water?.temperature)

  const getDepthData = () => computed(() => vessel.value?.environment?.depth)

  const getEntertainmentData = () => computed(() => vessel.value?.entertainment)

  const getNavigationData = () => computed(() => vessel.value?.navigation)

  const getSteeringData = () => computed(() => vessel.value?.steering)

  const getPropulsionData = () => computed(() => vessel.value?.propulsion)

  const getAirTemperatureData = () =>
    computed(() => ({
      outside: vessel.value?.environment?.outside?.temperature,
      inside: vessel.value?.environment?.inside?.temperature,
    }))

  const getBarometricPressureData = () =>
    computed(() => ({
      outside: vessel.value?.environment?.outside?.pressure,
      inside: vessel.value?.environment?.inside?.pressure,
    }))

  const getCurrentData = () => computed(() => vessel.value?.environment?.current)

  const getTideData = () => computed(() => vessel.value?.environment?.tide)

  const getGNSSData = () => computed(() => vessel.value?.navigation?.gnss)

  const getAttitudeData = () => computed(() => vessel.value?.navigation?.attitude)

  const getNotificationsData = () => computed(() => vessel.value?.notifications)

  const getDesignData = () => computed(() => vessel.value?.design)

  const getEnvironmentData = () =>
    computed(() => ({
      outside: vessel.value?.environment?.outside,
      inside: vessel.value?.environment?.inside,
      weather: vessel.value?.environment?.weather,
    }))

  return {
    vessel,
    getBatteryData,
    getSolarData,
    getInverterData,
    getChargerData,
    getWindData,
    getTankData,
    getWaterTempData,
    getDepthData,
    getEntertainmentData,
    getNavigationData,
    getSteeringData,
    getPropulsionData,
    getAirTemperatureData,
    getBarometricPressureData,
    getCurrentData,
    getTideData,
    getGNSSData,
    getAttitudeData,
    getNotificationsData,
    getDesignData,
    getEnvironmentData,
  }
}
