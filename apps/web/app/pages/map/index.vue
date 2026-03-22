<script setup lang="ts">
import '~/assets/css/map-page.css'
import { useVesselPosition } from '~/composables/useVesselPosition'
import { useMapVessels } from '~/composables/useMapVessels'
import { useAISOverlay } from '~/composables/useAISOverlay'
import type { MapVesselItem } from '~/types/map'

definePageMeta({ keepalive: true })

usePageSeo(
  'Live Map',
  'Real-time vessel position and tracking on an interactive marine chart.',
)

// Vessel data from SignalK
const { lat, lng, hasPosition, heading, cog, sog, stw, satellites } = useVesselPosition()

// Self-vessel only — passed to AppMapKit items
const { selfItems } = useMapVessels()

// AIS vessels — managed directly on the MapKit map (not via AppMapKit items)
const {
  showOtherVessels,
  showVectors,
  showLabels,
  aisCount,
  start: startAIS,
  stop: stopAIS,
} = useAISOverlay()

/**
 * Self-vessel pin factory — one DOM element (ship SVG + pulse ring).
 */
function createSelfPinElement(item: MapVesselItem, _isSelected: boolean) {
  const el = document.createElement('div')
  el.className = 'vessel-map-pin vessel-self'
  el.style.cssText = 'position: relative; width: 40px; height: 40px;'

  const pulse = document.createElement('div')
  pulse.className = 'vessel-pulse-ring'
  el.appendChild(pulse)

  const svgWrapper = document.createElement('div')
  svgWrapper.className = 'vessel-svg-wrapper'
  svgWrapper.style.transform = `rotate(${item.heading ?? 0}deg)`
  svgWrapper.innerHTML = `
    <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L24 26 Q24 30 16 30 Q8 30 8 26 Z"
        fill="var(--te-nav)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="16" cy="18" r="2" fill="white" opacity="0.8"/>
    </svg>
  `
  el.appendChild(svgWrapper)

  const stop = watch(heading, (h) => {
    svgWrapper.style.transform = `rotate(${h}deg)`
  })

  return { element: el, cleanup: stop }
}

// Format helpers
const formatDeg = (v: number | null) => (v != null ? `${v.toFixed(0)}°` : '—')
const formatKts = (v: number | null) => (v != null ? `${v.toFixed(1)} kts` : '—')
const formatSats = (v: number | null) => (v != null ? `${v}` : '—')

// Persist map region to localStorage
const { savedRegion, onRegionChange } = useMapRegion()

// Static fallback center — use saved region or current position snapshot, not reactive GPS
const fallbackCenter = (() => {
  if (savedRegion) return { lat: savedRegion.centerLat, lng: savedRegion.centerLng }
  if (lat.value != null && lng.value != null) return { lat: lat.value, lng: lng.value }
  return { lat: 27.5, lng: -89.5 }
})()

// Map ref for programmatic panning
const mapRef = ref<{
  setRegion: (center: { lat: number; lng: number }, span?: { lat: number; lng: number }) => void
} | null>(null)

function centerOnSelf() {
  if (lat.value != null && lng.value != null && mapRef.value) {
    mapRef.value.setRegion({ lat: lat.value, lng: lng.value }, { lat: 0.01, lng: 0.012 })
  }
}

// Auto-center on first GPS fix — but only if there's no saved region
// (so HMR reloads keep the map where you were testing)
watch(
  hasPosition,
  (ready) => {
    if (ready && !savedRegion) centerOnSelf()
  },
  { once: true },
)

// Start AIS overlay after the map component renders
// (needs mapkit.maps[0] to be available)
const mapReady = ref(false)
watch(mapRef, (ref) => {
  if (ref && !mapReady.value) {
    mapReady.value = true
    // Always restore saved region (zoom + center) so HMR reloads keep position
    if (savedRegion) {
      ref.setRegion(
        { lat: savedRegion.centerLat, lng: savedRegion.centerLng },
        { lat: savedRegion.latDelta, lng: savedRegion.lngDelta },
      )
    }
    // Small delay to ensure MapKit has created the map instance
    setTimeout(() => startAIS(), 500)
  }
})

// KeepAlive lifecycle: pause/resume AIS overlay when navigating away/back
onActivated(() => {
  if (mapReady.value) startAIS()
})

onDeactivated(() => stopAIS())

onUnmounted(() => stopAIS())
</script>

<template>
  <div class="map-page">
    <!-- Map: self-vessel via AppMapKit, AIS vessels managed directly -->
    <ClientOnly>
      <AppMapKit
        ref="mapRef"
        :items="selfItems"
        :create-pin-element="createSelfPinElement"
        :fallback-center="fallbackCenter"
        :annotation-size="{ width: 40, height: 40 }"
        :zoom-span="{ lat: 0.01, lng: 0.012 }"
        :bounding-padding="0.2"
        :is-rotation-enabled="true"
        :shows-points-of-interest="true"
        :preserve-region="true"
        @region-change="onRegionChange"
      />

      <template #fallback>
        <div class="map-loading">
          <UIcon name="i-lucide-loader" class="animate-spin text-2xl text-muted" />
          <p class="text-muted mt-2">Loading map…</p>
        </div>
      </template>
    </ClientOnly>

    <!-- Map controls overlay (top-right) -->
    <div class="map-controls">
      <UButton
        icon="i-lucide-crosshair"
        color="neutral"
        variant="outline"
        size="sm"
        class="control-btn"
        :disabled="!hasPosition"
        @click="centerOnSelf"
      />
      <UButton
        :icon="'i-lucide-ship'"
        :color="showOtherVessels ? 'primary' : 'neutral'"
        :variant="showOtherVessels ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showOtherVessels = !showOtherVessels"
      >
        AIS {{ aisCount > 0 ? `(${aisCount})` : '' }}
      </UButton>
      <UButton
        v-if="showOtherVessels"
        icon="i-lucide-move-right"
        :color="showVectors ? 'primary' : 'neutral'"
        :variant="showVectors ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showVectors = !showVectors"
      >
        Vectors
      </UButton>
      <UButton
        v-if="showOtherVessels"
        icon="i-lucide-tag"
        :color="showLabels ? 'primary' : 'neutral'"
        :variant="showLabels ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showLabels = !showLabels"
      >
        Labels
      </UButton>
    </div>

    <!-- Stats overlay -->
    <div class="stats-overlay">
      <div class="stat-group">
        <div class="stat">
          <span class="stat-label">SOG</span>
          <span class="stat-value">{{ formatKts(sog) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">COG</span>
          <span class="stat-value">{{ formatDeg(cog) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">HDG</span>
          <span class="stat-value">{{ formatDeg(heading) }}</span>
        </div>
        <div v-if="stw !== null" class="stat">
          <span class="stat-label">STW</span>
          <span class="stat-value">{{ formatKts(stw) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">SAT</span>
          <span class="stat-value">{{ formatSats(satellites) }}</span>
        </div>
      </div>

      <!-- No position warning -->
      <div v-if="!hasPosition" class="no-position">
        <UIcon name="i-lucide-satellite-dish" class="text-lg" />
        <span>Waiting for GPS fix…</span>
      </div>
    </div>
  </div>
</template>
