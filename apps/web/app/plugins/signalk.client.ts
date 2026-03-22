/**
 * Global SignalK Client Plugin
 *
 * Initializes the SignalK WebSocket connection on app startup so vessel data
 * is available on every page (dashboard, map, passages, etc.) — not just
 * the dashboard.
 */
import { useSignalKStore } from '~/stores/signalk'

export default defineNuxtPlugin(() => {
  const signalKStore = useSignalKStore()
  signalKStore.initClient()
})
