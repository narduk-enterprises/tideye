<script setup lang="ts">
import { useSignalK } from '~/composables/useSignalK'
import { formatDuration } from '~/utils/timeFormatting'
import { computed } from 'vue'

const signalK = useSignalK()

// Battery computations
const batteryLevel = computed(() => {
  const level = signalK.batteries.value?.tideyeBmv?.capacity?.stateOfCharge?.value
  return level ? (level * 100).toFixed(1) : '0.0'
})

const batteryVoltage = computed(() => {
  const voltage = signalK.batteries.value?.tideyeBmv?.voltage?.value
  return voltage ? voltage.toFixed(1) : '0.0'
})

const batteryCurrent = computed(() => {
  const current = signalK.batteries.value?.tideyeBmv?.current?.value
  return current ? Math.abs(current).toFixed(0) : '0'
})

const timeRemaining = computed(() => {
  const time = signalK.batteries.value?.tideyeBmv?.capacity?.timeRemaining?.value
  return formatDuration(time)
})

// Wind computation
const windSpeed = computed(() => {
  const speed = signalK.wind.value?.speedTrue?.value
  return speed ? (speed * 1.94384).toFixed(1) : '0.0'
})

// Tank Levels
const freshWaterTanks = computed(() => signalK.tanks.value?.freshWater as any[] | undefined)
const fuelTanks = computed(() => signalK.tanks.value?.fuel as any[] | undefined)

const tankLevels = computed(() => ({
  portWater: (freshWaterTanks.value?.[0]?.currentLevel?.value || 0) * 100,
  starboardWater: (freshWaterTanks.value?.[1]?.currentLevel?.value || 0) * 100,
  portFuel: (fuelTanks.value?.[0]?.currentLevel?.value || 0) * 100,
  starboardFuel: (fuelTanks.value?.[1]?.currentLevel?.value || 0) * 100,
}))

// Depth and Temperature
const depth = computed(() => {
  const d = signalK.depth.value?.belowTransducer?.value
  return d ? (d * 3.28084).toFixed(1) : '0.0'
})

const waterTemp = computed(() => {
  const temp = signalK.water.value?.temperature?.value
  return temp ? (((temp - 273.15) * 9) / 5 + 32).toFixed(1) : '0.0'
})

// Position computations
const latitude = computed(() => {
  const lat = signalK.navigation.value?.position?.value?.latitude
  return lat ? lat.toFixed(4) : '0.0000'
})

const longitude = computed(() => {
  const lon = signalK.navigation.value?.position?.value?.longitude
  return lon ? Math.abs(lon).toFixed(4) : '0.0000'
})

// Entertainment computations
const nowPlaying = computed(() => {
  const track = signalK.entertainment.value?.device?.fusion1?.avsource?.source11?.track
  return {
    title: track?.name?.value || '',
    artist: track?.artistName?.value || '',
  }
})
</script>

<template>
  <div class="primary-stats-bar">
    <!-- Battery Stats - Always visible -->
    <div class="stat-group battery">
      <div class="stat">
        <div class="stat-label">BATTERY</div>
        <div class="stat-value">{{ batteryLevel }}%</div>
        <div class="stat-details">{{ batteryVoltage }}v {{ batteryCurrent }}A</div>
        <div class="time-remaining">{{ timeRemaining }}</div>
      </div>
    </div>

    <!-- Wind - Priority 1 -->
    <div class="stat-group wind">
      <div class="stat">
        <div class="stat-label">TRUE WIND</div>
        <div class="stat-value">{{ windSpeed }} kts</div>
      </div>
    </div>

    <!-- Tank Levels - Priority 2 -->
    <div class="stat-group tanks">
      <div class="tanks-container">
        <div class="tank-group">
          <div class="tank-label">WATER</div>
          <div class="tank-bars">
            <div class="tank-item">
              <div class="tank-bar">
                <div class="tank-fill" :style="{ height: `${tankLevels.portWater}%` }"></div>
              </div>
              <div class="tank-percent">{{ tankLevels.portWater.toFixed(0) }}%</div>
              <div class="tank-sublabel">P</div>
            </div>
            <div class="tank-item">
              <div class="tank-bar">
                <div class="tank-fill" :style="{ height: `${tankLevels.starboardWater}%` }"></div>
              </div>
              <div class="tank-percent">{{ tankLevels.starboardWater.toFixed(0) }}%</div>
              <div class="tank-sublabel">S</div>
            </div>
          </div>
        </div>
        <div class="tank-group">
          <div class="tank-label">FUEL</div>
          <div class="tank-bars">
            <div class="tank-item">
              <div class="tank-bar">
                <div class="tank-fill fuel" :style="{ height: `${tankLevels.portFuel}%` }"></div>
              </div>
              <div class="tank-percent">{{ tankLevels.portFuel.toFixed(0) }}%</div>
              <div class="tank-sublabel">P</div>
            </div>
            <div class="tank-item">
              <div class="tank-bar">
                <div
                  class="tank-fill fuel"
                  :style="{ height: `${tankLevels.starboardFuel}%` }"
                ></div>
              </div>
              <div class="tank-percent">{{ tankLevels.starboardFuel.toFixed(0) }}%</div>
              <div class="tank-sublabel">S</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Depth -->
    <div class="stat-group depth">
      <div class="stat">
        <div class="stat-label">DEPTH</div>
        <div class="stat-value">{{ depth }}ft</div>
      </div>
    </div>

    <!-- Water Temperature -->
    <div class="stat-group temp">
      <div class="stat">
        <div class="stat-label">WATER TEMP</div>
        <div class="stat-value">{{ waterTemp }}°F</div>
      </div>
    </div>

    <!-- Position - Priority 1 -->
    <div class="stat-group position">
      <div class="stat">
        <div class="stat-label">POSITION</div>
        <div class="stat-value">{{ latitude }}°N</div>
        <div class="stat-value">{{ longitude }}°W</div>
      </div>
    </div>

    <!-- Now Playing - Lowest priority -->
    <div class="stat-group now-playing" v-if="nowPlaying.title">
      <div class="stat">
        <div class="stat-label">NOW PLAYING</div>
        <div class="track-info">
          <div class="track-title">{{ nowPlaying.title }}</div>
          <div class="track-artist">{{ nowPlaying.artist }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.primary-stats-bar {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-family: monospace;
  flex-wrap: wrap;
  gap: 1rem;
  min-height: 3rem;
  align-items: flex-start;
}

.stat-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-label {
  font-size: 0.7rem;
  color: var(--te-ok);
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1;
  margin: 0;
  padding: 0;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  line-height: 1;
}

.stat-details {
  font-size: 0.8rem;
  opacity: 0.8;
  line-height: 1;
}

.time-remaining {
  font-size: 0.8rem;
  color: var(--te-ok);
  line-height: 1;
}

.depth,
.temp {
  flex-shrink: 1;
  min-width: 90px;
  margin: 0 0.5rem;
}

@media (max-width: 768px) {
  .depth .stat-value,
  .temp .stat-value {
    font-size: 1rem;
  }
}

@media (max-width: 576px) {
  .depth .stat-value,
  .temp .stat-value {
    font-size: 0.9rem;
  }
}

.battery,
.wind,
.position {
  flex-shrink: 0;
}

.tanks {
  flex-shrink: 1;
  min-width: 120px;
}

.environment {
  flex-shrink: 1;
}

.now-playing {
  flex-grow: 1;
  flex-shrink: 1;
  min-width: 150px;
}

/* Compact styles for narrow viewports */
@media (max-width: 768px) {
  .primary-stats-bar {
    padding: 0.25rem 0.5rem;
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .stat-details,
  .time-remaining {
    font-size: 0.7rem;
  }

  .tank-bar {
    width: 0.5rem;
  }

  .now-playing {
    display: none;
  }
}

@media (max-width: 576px) {
  .tanks {
    display: none;
  }

  .environment .stat-value {
    font-size: 0.9rem;
  }
}

.tanks-container {
  display: flex;
  gap: 1rem;
  margin-top: 0;
}

.tank-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tank-label {
  font-size: 0.7rem;
  color: var(--te-ok);
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1;
  position: static;
  margin: 0;
  padding: 0;
}

.tank-bars {
  display: flex;
  gap: 0.5rem;
  height: 3rem;
}

.tank-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.tank-bar {
  width: 0.75rem;
  height: 3rem;
  background: color-mix(in srgb, var(--te-value) 8%, transparent);
  border-radius: 2px;
  position: relative;
}

.tank-sublabel {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 0.2rem;
}

.tank-fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: #4caf50;
  border-radius: 2px;
  transition: height 0.3s;
}

.tank-fill.fuel {
  background: #ffa000;
}

.tank-percent {
  font-size: 0.7rem;
  color: white;
  line-height: 1;
}

.now-playing {
  max-width: 200px;
  overflow: hidden;
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.track-title {
  font-size: 0.9rem;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 0.8rem;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
