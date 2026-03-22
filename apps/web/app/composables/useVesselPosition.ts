import { useSignalKData } from '~/composables/useSignalKData'

/**
 * useVesselPosition — reactive vessel position, heading, and speed from SignalK.
 *
 * Angles are converted from SignalK radians to degrees.
 * Speed is converted from m/s to knots.
 */
export function useVesselPosition() {
  const { getNavigationData } = useSignalKData()
  const nav = getNavigationData()

  const lat = computed(() => nav.value?.position?.value?.latitude ?? null)
  const lng = computed(() => nav.value?.position?.value?.longitude ?? null)
  const hasPosition = computed(() => lat.value !== null && lng.value !== null)

  // SignalK heading is in radians → convert to degrees
  const headingTrue = computed(() => {
    const rad = nav.value?.headingTrue?.value
    return rad != null ? (rad * 180) / Math.PI : null
  })

  const headingMagnetic = computed(() => {
    const rad = nav.value?.headingMagnetic?.value
    return rad != null ? (rad * 180) / Math.PI : null
  })

  // Use true heading first, fall back to magnetic, then COG
  const heading = computed(() => headingTrue.value ?? headingMagnetic.value ?? cog.value ?? 0)

  // Course Over Ground (radians → degrees)
  const cog = computed(() => {
    const rad = nav.value?.courseOverGroundTrue?.value
    return rad != null ? (rad * 180) / Math.PI : null
  })

  // Speed Over Ground (m/s → knots)
  const sog = computed(() => {
    const ms = nav.value?.speedOverGround?.value
    return ms != null ? ms * 1.94384 : null
  })

  // Speed Through Water (m/s → knots)
  const stw = computed(() => {
    const ms = nav.value?.speedThroughWater?.value
    return ms != null ? ms * 1.94384 : null
  })

  // GNSS quality
  const satellites = computed(() => nav.value?.gnss?.satellites?.value ?? null)

  return {
    lat,
    lng,
    hasPosition,
    heading,
    headingTrue,
    headingMagnetic,
    cog,
    sog,
    stw,
    satellites,
  }
}
