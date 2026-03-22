import { describe, expect, it, vi } from 'vitest'
import {
  buildSignalKSubscriptionCommands,
  createEmptySignalKBundleCounts,
  createSignalKBundleManager,
} from '~/utils/signalk-bundles'

describe('buildSignalKSubscriptionCommands', () => {
  it('returns no subscriptions when no bundles are active', () => {
    expect(buildSignalKSubscriptionCommands(createEmptySignalKBundleCounts())).toEqual([])
  })

  it('dedupes self subscriptions across active bundles', () => {
    const commands = buildSignalKSubscriptionCommands({
      dashboard: 0,
      'map-core': 1,
      'map-environment': 1,
      ais: 0,
    })

    expect(commands).toHaveLength(1)
    expect(commands[0]?.context).toBe('vessels.self')

    const paths = commands[0]?.subscribe.map((entry) => entry.path) ?? []
    expect(paths.filter((path) => path === 'navigation.position')).toHaveLength(1)
    expect(paths).toContain('environment.wind.speedTrue')
  })

  it('adds a separate AIS subscription command only when AIS is active', () => {
    const commands = buildSignalKSubscriptionCommands({
      dashboard: 0,
      'map-core': 1,
      'map-environment': 0,
      ais: 1,
    })

    expect(commands.map((command) => command.context)).toEqual(['vessels.self', 'vessels.*'])
  })
})

describe('createSignalKBundleManager', () => {
  it('connects on first acquire, ignores duplicate acquires, and idles after final release', () => {
    vi.useFakeTimers()

    const onFirstAcquire = vi.fn()
    const onIdleDisconnect = vi.fn()
    const manager = createSignalKBundleManager({
      idleDisconnectMs: 15_000,
      onFirstAcquire,
      onIdleDisconnect,
    })

    manager.acquire('dashboard')
    manager.acquire('dashboard')
    manager.acquire('ais')

    expect(onFirstAcquire).toHaveBeenCalledTimes(1)
    expect(manager.snapshotCounts()).toEqual({
      dashboard: 2,
      'map-core': 0,
      'map-environment': 0,
      ais: 1,
    })

    manager.release('dashboard')
    manager.release('dashboard')
    manager.release('ais')

    vi.advanceTimersByTime(14_999)
    expect(onIdleDisconnect).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onIdleDisconnect).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
