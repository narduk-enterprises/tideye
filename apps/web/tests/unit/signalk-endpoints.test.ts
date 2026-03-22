import { describe, expect, it } from 'vitest'
import {
  normalizeBaseUrl,
  resolveSignalKClientEndpoints,
  resolveSignalKServerBaseUrls,
} from '~/utils/signalk-endpoints'

describe('resolveSignalKClientEndpoints', () => {
  it('orders dev, local, remote in development', () => {
    const endpoints = resolveSignalKClientEndpoints({
      remoteBaseUrl: 'https://signalk-public.tideye.com/',
      localBaseUrl: 'http://signalk-local.tideye.com/',
      devBaseUrl: 'http://bee.tideye.com:3000/',
      isDev: true,
      pageProtocol: 'http:',
    })

    expect(endpoints.map((endpoint) => endpoint.kind)).toEqual(['dev', 'local', 'remote'])
    expect(endpoints[0]?.baseUrl).toBe('http://bee.tideye.com:3000')
    expect(endpoints[1]?.baseUrl).toBe('http://signalk-local.tideye.com')
  })

  it('upgrades the local browser endpoint on secure pages', () => {
    const endpoints = resolveSignalKClientEndpoints({
      remoteBaseUrl: 'https://signalk-public.tideye.com',
      localBaseUrl: 'http://signalk-local.tideye.com',
      isDev: false,
      pageProtocol: 'https:',
    })

    expect(endpoints.map((endpoint) => endpoint.kind)).toEqual(['local', 'remote'])
    expect(endpoints[0]?.baseUrl).toBe('https://signalk-local.tideye.com')
    expect(endpoints[0]?.probeUrl).toBe('https://signalk-local.tideye.com/signalk/v1/api/')
  })

  it('dedupes normalized endpoint URLs', () => {
    const endpoints = resolveSignalKClientEndpoints({
      remoteBaseUrl: 'https://signalk-public.tideye.com/',
      localBaseUrl: 'https://signalk-public.tideye.com',
      isDev: false,
      pageProtocol: 'https:',
    })

    expect(endpoints).toHaveLength(2)
    expect(endpoints[0]?.baseUrl).toBe('https://signalk-public.tideye.com')
  })
})

describe('resolveSignalKServerBaseUrls', () => {
  it('prefers remote/write ordering for server access by default', () => {
    expect(
      resolveSignalKServerBaseUrls({
        writeBaseUrl: 'https://write.example.com/',
        remoteBaseUrl: 'https://remote.example.com/',
        localBaseUrl: 'http://local.example.com/',
        preferLocal: false,
      }),
    ).toEqual([
      'https://write.example.com',
      'https://remote.example.com',
      'http://local.example.com',
    ])
  })

  it('can prefer local ordering when requested', () => {
    expect(
      resolveSignalKServerBaseUrls({
        remoteBaseUrl: 'https://remote.example.com',
        localBaseUrl: 'http://local.example.com',
        preferLocal: true,
      }),
    ).toEqual(['http://local.example.com', 'https://remote.example.com'])
  })
})

describe('normalizeBaseUrl', () => {
  it('removes trailing slashes', () => {
    expect(normalizeBaseUrl('https://signalk-public.tideye.com/')).toBe(
      'https://signalk-public.tideye.com',
    )
  })
})
