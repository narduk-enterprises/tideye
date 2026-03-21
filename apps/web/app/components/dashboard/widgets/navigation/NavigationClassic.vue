<script setup lang="ts">
import { computed } from 'vue'
import { useSignalKData } from '~/composables/useSignalKData'
import WidgetContainer from '../shared/WidgetContainer.vue'

const { getNavigationData, getGNSSData, getAttitudeData } = useSignalKData()
const navigationData = getNavigationData()
const gnssData = getGNSSData()
const attitudeData = getAttitudeData()

const navigation = computed(() => ({
  heading: navigationData.value?.headingTrue?.value?.toFixed(0) ?? '0',
  headingMagnetic: navigationData.value?.headingMagnetic?.value?.toFixed(0) ?? null,
  stw: (navigationData.value?.speedThroughWater?.value ?? 0).toFixed(1),
  sog: navigationData.value?.speedOverGround?.value?.toFixed(1) ?? null,
  cog: navigationData.value?.courseOverGroundTrue?.value?.toFixed(0) ?? null,
  cogMagnetic: navigationData.value?.courseOverGroundMagnetic?.value?.toFixed(0) ?? null,
  trip: (navigationData.value?.trip?.log?.value ?? 0).toFixed(1),
  log: navigationData.value?.log?.value?.toFixed(1) ?? null,
  position: {
    latitude: navigationData.value?.position?.value?.latitude?.toFixed(4) ?? '0.0000',
    longitude: navigationData.value?.position?.value?.longitude?.toFixed(4) ?? '0.0000',
  },
  gnss: {
    satellites: gnssData.value?.satellites?.value ?? null,
    type: gnssData.value?.type?.value ?? null,
    methodQuality: gnssData.value?.methodQuality?.value ?? null,
    integrity: gnssData.value?.integrity?.value ?? null,
    horizontalDilution: gnssData.value?.horizontalDilution?.value ?? null,
  },
  attitude: {
    pitch: attitudeData.value?.value?.pitch?.value ?? null,
    roll: attitudeData.value?.value?.roll?.value ?? null,
    yaw: attitudeData.value?.value?.yaw?.value ?? null,
  },
}))
</script>

<template>
  <WidgetContainer title="Navigation">
    <div class="navigation-display">
      <div class="heading-section">
        <div class="heading primary-value">{{ navigation.heading }}°</div>
        <div v-if="navigation.headingMagnetic" class="heading-magnetic">
          Mag: {{ navigation.headingMagnetic }}°
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric">
          <span class="unit-label">STW</span>
          <span class="secondary-value">{{ navigation.stw }} kts</span>
        </div>
        <div v-if="navigation.sog" class="metric">
          <span class="unit-label">SOG</span>
          <span class="secondary-value">{{ navigation.sog }} kts</span>
        </div>
        <div v-if="navigation.cog" class="metric">
          <span class="unit-label">COG</span>
          <span class="secondary-value">{{ navigation.cog }}°</span>
        </div>
        <div v-if="navigation.cogMagnetic" class="metric">
          <span class="unit-label">COG (Mag)</span>
          <span class="secondary-value">{{ navigation.cogMagnetic }}°</span>
        </div>
      </div>

      <div
        v-if="navigation.attitude.pitch !== null || navigation.attitude.roll !== null"
        class="attitude-section"
      >
        <div class="section-label">Attitude</div>
        <div class="attitude-grid">
          <div v-if="navigation.attitude.pitch !== null" class="attitude-item">
            <span class="attitude-label">Pitch</span>
            <span class="attitude-value">{{ navigation.attitude.pitch.toFixed(1) }}°</span>
          </div>
          <div v-if="navigation.attitude.roll !== null" class="attitude-item">
            <span class="attitude-label">Roll</span>
            <span class="attitude-value">{{ navigation.attitude.roll.toFixed(1) }}°</span>
          </div>
        </div>
      </div>

      <div v-if="navigation.gnss.satellites !== null || navigation.gnss.type" class="gnss-section">
        <div class="section-label">GNSS</div>
        <div class="gnss-grid">
          <div v-if="navigation.gnss.satellites !== null" class="gnss-item">
            <span class="gnss-label">Satellites</span>
            <span class="gnss-value">{{ navigation.gnss.satellites }}</span>
          </div>
          <div v-if="navigation.gnss.type" class="gnss-item">
            <span class="gnss-label">Type</span>
            <span class="gnss-value">{{ navigation.gnss.type }}</span>
          </div>
          <div v-if="navigation.gnss.methodQuality" class="gnss-item">
            <span class="gnss-label">Quality</span>
            <span class="gnss-value">{{ navigation.gnss.methodQuality }}</span>
          </div>
        </div>
      </div>

      <div class="position">
        <span class="unit-label">Position</span>
        <span class="secondary-value"
          >{{ navigation.position.latitude }}°N {{ navigation.position.longitude }}°W</span
        >
      </div>

      <div class="trip-log">
        <div class="trip-item">
          <span class="unit-label">Trip</span>
          <span class="secondary-value">{{ navigation.trip }} nm</span>
        </div>
        <div v-if="navigation.log" class="trip-item">
          <span class="unit-label">Log</span>
          <span class="secondary-value">{{ navigation.log }} nm</span>
        </div>
      </div>
    </div>
  </WidgetContainer>
</template>

<style scoped>
.navigation-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.heading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.heading {
  font-size: 3rem;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  color: var(--color-text-primary);
}

.heading-magnetic {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-family: var(--font-mono, monospace);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.unit-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.secondary-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
}

.attitude-section,
.gnss-section {
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.section-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.attitude-grid,
.gnss-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.attitude-item,
.gnss-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.attitude-label,
.gnss-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.attitude-value,
.gnss-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono, monospace);
}

.position {
  text-align: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.trip-log {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.trip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
</style>
