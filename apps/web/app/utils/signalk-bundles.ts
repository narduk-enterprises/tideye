import type { SubscriptionPath } from '@signalk/client'
import {
  AIS_SUBSCRIPTIONS,
  DASHBOARD_SELF_SUBSCRIPTIONS,
  MAP_CORE_SELF_SUBSCRIPTIONS,
  MAP_ENVIRONMENT_SELF_SUBSCRIPTIONS,
} from '~/config/signalk'

export const SIGNALK_BUNDLE_KEYS = ['dashboard', 'map-core', 'map-environment', 'ais'] as const

export type SignalKBundleKey = (typeof SIGNALK_BUNDLE_KEYS)[number]

export type SignalKBundleCounts = Record<SignalKBundleKey, number>

export function createEmptySignalKBundleCounts(): SignalKBundleCounts {
  return {
    dashboard: 0,
    'map-core': 0,
    'map-environment': 0,
    ais: 0,
  }
}

export function buildSignalKSubscriptionCommands(bundleCounts: SignalKBundleCounts) {
  const selfSubscriptions = new Map<string, SubscriptionPath>()

  if (bundleCounts.dashboard > 0) {
    addSubscriptionGroup(selfSubscriptions, DASHBOARD_SELF_SUBSCRIPTIONS)
  }

  if (bundleCounts['map-core'] > 0) {
    addSubscriptionGroup(selfSubscriptions, MAP_CORE_SELF_SUBSCRIPTIONS)
  }

  if (bundleCounts['map-environment'] > 0) {
    addSubscriptionGroup(selfSubscriptions, MAP_ENVIRONMENT_SELF_SUBSCRIPTIONS)
  }

  const commands: Array<{ context: string; subscribe: SubscriptionPath[] }> = []

  if (selfSubscriptions.size > 0) {
    commands.push({
      context: 'vessels.self',
      subscribe: Array.from(selfSubscriptions.values()),
    })
  }

  if (bundleCounts.ais > 0) {
    commands.push({
      context: 'vessels.*',
      subscribe: [...AIS_SUBSCRIPTIONS],
    })
  }

  return commands
}

interface CreateSignalKBundleManagerOptions {
  idleDisconnectMs: number
  onFirstAcquire?: () => void
  onIdleDisconnect?: () => void
}

export function createSignalKBundleManager(options: CreateSignalKBundleManagerOptions) {
  const counts = createEmptySignalKBundleCounts()
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  function totalActiveCount() {
    return SIGNALK_BUNDLE_KEYS.reduce((sum, key) => sum + counts[key], 0)
  }

  function snapshotCounts(): SignalKBundleCounts {
    return { ...counts }
  }

  function hasActiveBundles() {
    return totalActiveCount() > 0
  }

  function cancelIdleDisconnect() {
    if (!idleTimer) return
    clearTimeout(idleTimer)
    idleTimer = null
  }

  function scheduleIdleDisconnectIfNeeded() {
    if (hasActiveBundles() || idleTimer) return
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (!hasActiveBundles()) {
        options.onIdleDisconnect?.()
      }
    }, options.idleDisconnectMs)
  }

  function acquire(bundleKey: SignalKBundleKey) {
    const wasIdle = !hasActiveBundles()
    counts[bundleKey] += 1
    cancelIdleDisconnect()
    if (wasIdle) {
      options.onFirstAcquire?.()
    }
  }

  function release(bundleKey: SignalKBundleKey) {
    if (counts[bundleKey] === 0) return
    counts[bundleKey] -= 1
    scheduleIdleDisconnectIfNeeded()
  }

  function reset() {
    cancelIdleDisconnect()
    for (const key of SIGNALK_BUNDLE_KEYS) {
      counts[key] = 0
    }
  }

  return {
    acquire,
    release,
    reset,
    hasActiveBundles,
    cancelIdleDisconnect,
    snapshotCounts,
  }
}

function addSubscriptionGroup(
  bucket: Map<string, SubscriptionPath>,
  paths: ReadonlyArray<SubscriptionPath>,
) {
  for (const entry of paths) {
    bucket.set(entry.path, entry)
  }
}
