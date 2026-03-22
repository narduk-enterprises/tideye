import { storeToRefs } from 'pinia'
import { useSignalKStore } from '~/stores/signalk'
import type { SignalKDelta } from '~/types/signalk/signalk-types'
import type { SignalKSelfSliceKey } from '~/utils/signalk-delta'

export function useSignalK() {
  const store = useSignalKStore()
  const {
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
  } = storeToRefs(store)

  function selectSelfSlice<K extends SignalKSelfSliceKey>(sliceKey: K) {
    return store.selectSelfSlice(sliceKey)
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
    bootstrap: store.bootstrap,
    cleanup: store.cleanup,
    acquireBundle: store.acquireBundle,
    releaseBundle: store.releaseBundle,
    selectSelfSlice,
    setUnitPreferences: store.setUnitPreferences,
    subscribeDelta: (callback: (delta: SignalKDelta) => void) => store.subscribeDelta(callback),
  }
}
