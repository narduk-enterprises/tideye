<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'
import { formatMediaTime } from '~/utils/timeFormatting'

const { getEntertainmentData } = useSignalKData()
const entertainmentData = getEntertainmentData()

// Add debug logging helper
const logDebug = (label: string, data: any) => {
  //console.debug(`[Entertainment] ${label}:`, data);
}

// Enhanced data validation with logging
const entertainment = computed(() => {
  const data = entertainmentData.value
  logDebug('Raw Entertainment Data', data)
  return data
})

const currentSource = computed(() => {
  try {
    const sourceId = entertainment.value?.device?.fusion1?.output?.zone1?.source?.value
    logDebug('Source ID', sourceId)

    if (!sourceId) return null
    const sourceKey = sourceId.split('.').pop()
    logDebug('Source Key', sourceKey)

    const source = entertainment.value?.device?.fusion1?.avsource?.[sourceKey as any]
    logDebug('Current Source Data', source)
    return source
  } catch (error) {
    console.warn('[Entertainment] Error getting current source:', error)
    return null
  }
})

const track = computed(() => {
  const trackData = currentSource.value?.track
  logDebug('Track Data', trackData)
  return trackData
})

// Enhanced safe getters with logging
const safeTrackName = computed(() => {
  const name = track.value?.name?.value
  logDebug('Raw Track Name', name)

  if (!name || typeof name !== 'string') {
    console.warn('[Entertainment] Invalid track name:', name)
    return 'No Track'
  }

  const trimmed = name.trim()
  logDebug('Processed Track Name', trimmed)
  return trimmed || 'No Track'
})

const safeArtistName = computed(() => {
  const name = track.value?.artistName?.value
  logDebug('Raw Artist Name', name)

  if (!name || typeof name !== 'string') {
    console.warn('[Entertainment] Invalid artist name:', name)
    return ''
  }

  const trimmed = name.trim()
  logDebug('Processed Artist Name', trimmed)
  return trimmed
})

// Store last valid progress value
const lastValidProgress = ref(0)
const lastValidTime = ref('0:00')

// Helper to check if time value is reasonable
const isReasonableTime = (seconds: number | undefined | null): boolean => {
  if (!seconds || isNaN(seconds) || seconds < 0 || seconds > 1800) {
    return false
  }
  return true
}

const formatTime = (seconds: number | undefined | null) => {
  logDebug('Raw Time Value', seconds)

  if (!isReasonableTime(seconds)) {
    logDebug('Ignoring unreasonable time value:', seconds)
    return lastValidTime.value
  }

  const formatted = formatMediaTime(seconds!)
  logDebug('Formatted Time', formatted)

  // Update last valid time
  lastValidTime.value = formatted
  return formatted
}

const progressPercentage = computed(() => {
  const elapsed = track.value?.elapsedTime?.value
  const total = track.value?.length?.value

  logDebug('Progress Values', { elapsed, total })

  if (!isReasonableTime(elapsed) || !isReasonableTime(total)) {
    logDebug('Using last valid progress:', lastValidProgress.value)
    return lastValidProgress.value
  }

  const progress = Math.min(100, (elapsed! / total!) * 100)
  logDebug('Calculated Progress', progress)

  // Update last valid progress

  return progress
})

// Watch for track changes to reset progress if needed
watch(
  () => track.value?.name?.value,
  (newTrack, oldTrack) => {
    if (newTrack !== oldTrack) {
      lastValidProgress.value = 0
      lastValidTime.value = '0:00'
    }
  },
)

const activeZoneNames = computed(() => {
  try {
    const zones = entertainment.value?.device?.fusion1?.output || {}
    logDebug('Raw Zones Data', zones)

    const activeZones = Object.entries(zones)
      .filter(([zoneName, zone]) => {
        const volume = Number((zone as any)?.volume?.master?.value)
        const isMuted = (zone as any)?.isMuted?.value
        logDebug(`Zone ${zoneName}`, { volume, isMuted })
        return !isNaN(volume) && volume > 0 && isMuted === false
      })
      .map(([_, zone]) => (zone as any)?.source?.name?.value)
      .filter((name) => name && typeof name === 'string')
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 3)

    logDebug('Processed Active Zones', activeZones)
    return activeZones
  } catch (error) {
    console.warn('[Entertainment] Error processing zones:', error)
    return []
  }
})

// Check if track is playing
const isPlaying = computed(() => currentSource.value?.playbackState?.value === 'Playing')

// Add shouldScroll computed property
const shouldScroll = computed(() => {
  const name = safeTrackName.value
  return name.length > 25
})

// Safe source name
const sourceDisplayName = computed(() => {
  const name = currentSource.value?.name?.value
  return name && typeof name === 'string' ? name.trim() : 'No Source'
})
</script>

<template>
  <WidgetContainer title="NOW PLAYING">
    <div class="widget-container">
      <div class="player-content">
        <div class="main-info">
          <!-- Album Art -->
          <div class="artwork-section">
            <div class="artwork-placeholder" :class="{ playing: isPlaying }">
              <i class="fas fa-music"></i>
            </div>
          </div>

          <!-- Track Info -->
          <div class="track-info">
            <div class="track-name" :class="{ scrolling: shouldScroll }" :title="safeTrackName">
              {{ safeTrackName }}
            </div>
            <div class="track-artist" v-if="safeArtistName">
              {{ safeArtistName }}
            </div>
          </div>
        </div>

        <!-- Progress Bar - Always show -->
        <div class="progress-section">
          <div class="time-display">
            {{ formatTime(track?.elapsedTime?.value) }}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
          </div>
        </div>

        <!-- Source & Zones -->
        <div class="footer-info">
          <div class="source">{{ sourceDisplayName }}</div>
          <div class="zones" v-if="activeZoneNames.length">
            {{ activeZoneNames.join(', ') }}
          </div>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.player-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.75rem;
  gap: 0.75rem;
  max-width: 280px;
  margin: 0 auto;
  position: relative;
}

.main-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

.artwork-section {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  background: var(--te-widget-bg);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--te-widget-shadow);
}

.artwork-placeholder i {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.2);
}

.track-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.track-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--te-value);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 0.8rem;
  color: var(--te-unit);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.progress-section {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.time-display {
  font-size: 0.75rem;
  font-family: var(--te-font-data);
  color: var(--te-label);
  min-width: 3.5rem;
}

.progress-bar {
  flex: 1;
  height: 2px;
  background: color-mix(in srgb, var(--te-value) 8%, transparent);
  border-radius: 1px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--color-success);
  transition: width 1s linear;
}

.footer-info {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--te-label);
}

.source {
  font-weight: 500;
}

.zones {
  font-weight: 500;
}

/* Add error state styles */
.track-name.error {
  color: var(--te-label);
  font-style: italic;
}

/* Ensure text truncation works reliably */
.track-name,
.track-artist,
.source,
.zones {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Prevent layout shifts */
.main-info {
  min-height: 48px;
}

.progress-section {
  min-height: 18px;
}

.footer-info {
  min-height: 16px;
}

@keyframes scroll-text {
  0%,
  15% {
    transform: translateX(0);
  } /* Pause at start */
  85%,
  100% {
    transform: translateX(calc(-100% + 100px));
  } /* Scroll to end */
}

.track-name.scrolling {
  animation: scroll-text 12s linear infinite;
  display: inline-block;
  white-space: nowrap;
  padding-right: 2rem;
  will-change: transform;
}

/* Update the fade-out effect */
.track-info::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 1.5rem;
  background: linear-gradient(to right, transparent, var(--widget-bg, #1a1a1a) 100%);
  pointer-events: none;
}

/* Add container masking */
.widget-container {
  overflow: hidden;
  mask-image: linear-gradient(to right, black 0%, black 98%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 0%, black 98%, transparent 100%);
}
</style>
