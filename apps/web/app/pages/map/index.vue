<script setup lang="ts">
import '~/assets/css/map-page.css'
import { useVesselPosition } from '~/composables/useVesselPosition'
import { useMapVessels } from '~/composables/useMapVessels'
import { useAISOverlay, CATEGORIES, FILTERABLE_CATEGORIES } from '~/composables/useAISOverlay'
import { useMapFeatures } from '~/composables/useMapFeatures'
import { useSignalKStore } from '~/stores/signalk'
import type { MapVesselItem } from '~/types/map'

definePageMeta({ keepalive: true })

usePageSeo('Live Map', 'Real-time vessel position and tracking on an interactive marine chart.')

// Vessel data from SignalK
const { lat, lng, hasPosition, heading, cog, sog, stw, satellites } = useVesselPosition()

// Self-vessel only — passed to AppMapKit items
const { selfItems } = useMapVessels()

// AIS vessels — managed directly on the MapKit map (not via AppMapKit items)
const {
  showOtherVessels,
  showVectors,
  showLabels,
  showTrails,
  aisCount,
  activeTypeFilters,
  typeCounts,
  dangerousVesselIds,
  toggleTypeFilter,
  clearTypeFilters,
  centerOnVessel,
  start: startAIS,
  stop: stopAIS,
} = useAISOverlay()

// Vessel list sidebar
const showVesselList = ref(false)
const signalKStore = useSignalKStore()

// Map features — range rings, heading line, anchor watch, waypoints, measurement, etc.
const {
  showRangeRings,
  showHeadingLine,
  showSelfTrail,
  anchorActive,
  anchorBreach,
  setAnchor,
  clearAnchor,
  measureMode,
  measureResult,
  toggleMeasureMode,
  addMeasurePoint,
  clearMeasure,
  mapType,
  setMapType,
  depthFt,
  depthSeverity,
  waterTempF,
  windSpeedKts,
  windAngleDeg,
  start: startFeatures,
  stop: stopFeatures,
} = useMapFeatures()

// Filter panel toggle
const showFilterPanel = ref(false)
const hasActiveFilters = computed(() => activeTypeFilters.size > 0)

// Fullscreen
const isFullscreen = ref(false)
function toggleFullscreen() {
  if (import.meta.client) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
      isFullscreen.value = true
    } else {
      document.exitFullscreen?.()
      isFullscreen.value = false
    }
  }
}

const mapTypeToggleIcon = computed(() =>
  mapType.value === 'satellite'
    ? 'i-lucide-satellite'
    : mapType.value === 'hybrid'
      ? 'i-lucide-layers'
      : 'i-lucide-map',
)

function cycleMapType() {
  if (mapType.value === 'standard') setMapType('satellite')
  else if (mapType.value === 'satellite') setMapType('hybrid')
  else setMapType('standard')
}

// Sync fullscreen state with browser
onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

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
const formatDepth = (v: number | null) => (v != null ? `${v.toFixed(1)} ft` : '—')
const formatTemp = (v: number | null) => (v != null ? `${v.toFixed(1)}°F` : '—')

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

// Map click — handle measurement and waypoint drops
function onMapClick(coords: { lat: number; lng: number }) {
  if (measureMode.value) {
    addMeasurePoint(coords.lat, coords.lng)
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

// Start AIS overlay + features after the map component renders
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
    setTimeout(() => {
      startAIS()
      startFeatures()
    }, 500)
  }
})

// KeepAlive lifecycle: pause/resume AIS overlay when navigating away/back
onActivated(() => {
  if (mapReady.value) {
    startAIS()
    startFeatures()
  }
})

onDeactivated(() => {
  stopAIS()
  stopFeatures()
})

onUnmounted(() => {
  stopAIS()
  stopFeatures()
})
</script>

<template>
  <div class="map-page" :class="{ 'map-fullscreen': isFullscreen }">
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
        @map-click="onMapClick"
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
        icon="i-lucide-filter"
        :color="hasActiveFilters ? 'primary' : 'neutral'"
        :variant="hasActiveFilters ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showFilterPanel = !showFilterPanel"
      />
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
      <UButton
        v-if="showOtherVessels"
        icon="i-lucide-clock"
        :color="showTrails ? 'primary' : 'neutral'"
        :variant="showTrails ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showTrails = !showTrails"
      >
        Trails
      </UButton>
      <UButton
        v-if="showOtherVessels"
        icon="i-lucide-list"
        :color="showVesselList ? 'primary' : 'neutral'"
        :variant="showVesselList ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showVesselList = !showVesselList"
      />
      <span v-if="dangerousVesselIds.size > 0" class="cpa-warning-badge">
        ⚠ {{ dangerousVesselIds.size }} CPA
      </span>
    </div>

    <!-- Navigation tools (top-left) -->
    <div class="nav-tools">
      <UButton
        icon="i-lucide-target"
        :color="showRangeRings ? 'primary' : 'neutral'"
        :variant="showRangeRings ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showRangeRings = !showRangeRings"
      />
      <UButton
        icon="i-lucide-compass"
        :color="showHeadingLine ? 'primary' : 'neutral'"
        :variant="showHeadingLine ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showHeadingLine = !showHeadingLine"
      />
      <UButton
        icon="i-lucide-route"
        :color="showSelfTrail ? 'primary' : 'neutral'"
        :variant="showSelfTrail ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="showSelfTrail = !showSelfTrail"
      />
      <UButton
        :icon="anchorActive ? 'i-lucide-anchor' : 'i-lucide-anchor'"
        :color="anchorActive ? (anchorBreach ? 'error' : 'success') : 'neutral'"
        :variant="anchorActive ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        :class="{ 'anchor-breach-pulse': anchorBreach }"
        @click="anchorActive ? clearAnchor() : setAnchor()"
      />
      <UButton
        icon="i-lucide-ruler"
        :color="measureMode ? 'primary' : 'neutral'"
        :variant="measureMode ? 'solid' : 'outline'"
        size="sm"
        class="control-btn"
        @click="toggleMeasureMode()"
      />
    </div>

    <!-- Map type + fullscreen (bottom-right) -->
    <div class="map-type-controls">
      <UButton
        :icon="mapTypeToggleIcon"
        color="neutral"
        variant="outline"
        size="sm"
        class="control-btn"
        @click="cycleMapType"
      />
      <UButton
        :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
        color="neutral"
        variant="outline"
        size="sm"
        class="control-btn"
        @click="toggleFullscreen"
      />
    </div>

    <!-- Vessel type filter panel -->
    <Transition name="filter-slide">
      <div v-if="showFilterPanel && showOtherVessels" class="filter-panel">
        <div class="filter-panel-header">
          <span class="filter-panel-title">Filter by Type</span>
          <UButton
            v-if="hasActiveFilters"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="clearTypeFilters"
          >
            Clear
          </UButton>
        </div>
        <div class="filter-chips">
          <div
            v-for="key in FILTERABLE_CATEGORIES"
            :key="key"
            class="filter-chip"
            :class="{ active: activeTypeFilters.has(key) }"
            :style="
              activeTypeFilters.has(key)
                ? {
                    background: CATEGORIES[key].color + '18',
                    borderColor: CATEGORIES[key].color + '60',
                    color: CATEGORIES[key].color,
                  }
                : {}
            "
            @click="toggleTypeFilter(key)"
          >
            <span class="filter-chip-dot" :style="{ background: CATEGORIES[key].color }" />
            <span class="filter-chip-label">{{ CATEGORIES[key].label }}</span>
            <span v-if="(typeCounts[key] ?? 0) > 0" class="filter-chip-count">{{
              typeCounts[key]
            }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Measurement result HUD -->
    <Transition name="filter-slide">
      <div v-if="measureResult" class="measure-hud">
        <div class="measure-hud-row">
          <span class="measure-hud-label">DIST</span>
          <span class="measure-hud-value">{{
            measureResult.distNM < 1
              ? `${(measureResult.distNM * 2025.372).toFixed(0)} yd`
              : `${measureResult.distNM.toFixed(2)} NM`
          }}</span>
        </div>
        <div class="measure-hud-row">
          <span class="measure-hud-label">BRG</span>
          <span class="measure-hud-value"
            >{{ measureResult.bearing.toFixed(0) }}° {{ measureResult.cardinal }}</span
          >
        </div>
        <div v-if="measureResult.etaMinutes != null" class="measure-hud-row">
          <span class="measure-hud-label">ETA</span>
          <span class="measure-hud-value">{{
            measureResult.etaMinutes < 60
              ? `${measureResult.etaMinutes.toFixed(0)} min`
              : `${(measureResult.etaMinutes / 60).toFixed(1)} hr`
          }}</span>
        </div>
        <UButton size="xs" variant="ghost" color="neutral" class="mt-1" @click="clearMeasure"
          >Clear</UButton
        >
      </div>
    </Transition>

    <!-- Anchor breach warning -->
    <Transition name="filter-slide">
      <div v-if="anchorBreach" class="anchor-breach-warning">
        <UIcon name="i-lucide-alert-triangle" class="text-base" />
        <span>Anchor drag detected!</span>
      </div>
    </Transition>

    <!-- Wind rose overlay (bottom-left) -->
    <div v-if="windSpeedKts != null || windAngleDeg != null" class="wind-rose-overlay">
      <MapWindRose
        :wind-angle-deg="windAngleDeg"
        :wind-speed-kts="windSpeedKts"
        :heading-deg="heading"
      />
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
        <div v-if="depthFt !== null" class="stat">
          <span class="stat-label">DPT</span>
          <span
            class="stat-value"
            :class="{
              'depth-danger': depthSeverity === 'danger',
              'depth-warning': depthSeverity === 'warning',
            }"
            >{{ formatDepth(depthFt) }}</span
          >
        </div>
        <div v-if="waterTempF !== null" class="stat">
          <span class="stat-label">H₂O</span>
          <span class="stat-value stat-value-temp">{{ formatTemp(waterTempF) }}</span>
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
    <!-- Vessel list sidebar -->
    <Transition name="sidebar-slide">
      <MapVesselList
        v-if="showVesselList && showOtherVessels"
        :vessels="signalKStore.otherVesselsList"
        :self-lat="lat"
        :self-lng="lng"
        @close="showVesselList = false"
        @select-vessel="
          (id: string) => {
            centerOnVessel(id)
            showVesselList = false
          }
        "
      />
    </Transition>
  </div>
</template>
