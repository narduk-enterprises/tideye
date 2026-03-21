// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
import { defineStore } from 'pinia'
import { SailingVessel } from '~/types/signalk/model'
import type { SignalKUpdate } from '~/types/signalk/model'

const SIGNALK_HOSTNAME = 'signalk-public.tideye.com'
const SIGNALK_VERSION = 'v1'
const SIGNALK_PORT = 443
const SIGNAL_K_REST_URL = `https://${SIGNALK_HOSTNAME}:${SIGNALK_PORT}/signalk/${SIGNALK_VERSION}/api/vessels/self`

export const useVesselStore = defineStore('vessel', {
  state: () => ({
    vessel: null as SailingVessel | null,
    positions: [] as { lat: number; lon: number; timestamp: string }[],
  }),
  actions: {
    addPosition(position: { lat: number; lon: number; timestamp: string }) {
      this.positions.push(position)
    },
    async fetchVessel() {
      if (this.vessel) return
      if (!import.meta.client) return

      try {
        const response = await fetch(SIGNAL_K_REST_URL)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        this.vessel = new SailingVessel(data)
      } catch (error) {
        console.error('Failed to fetch vessel:', error)
      }
    },
    getCenter() {
      if (!this.vessel) return {}
      return {
        lat: this.vessel?.navigation.position?.value.latitude || 0,
        lon: this.vessel?.navigation?.position.value.longitude || 0,
      }
    },

    setVessel(data: any) {
      this.vessel = new SailingVessel(data)
    },
    updateVesselFromSignalK(data: SignalKUpdate) {
      this.vessel?.updateFromSignalK(data)
    },
    getPositions() {
      return this.positions
    },
  },
})
