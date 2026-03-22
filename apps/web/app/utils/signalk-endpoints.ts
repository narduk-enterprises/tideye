export type SignalKEndpointKind = 'dev' | 'local' | 'remote'
export type SignalKConnectionEndpointKind = SignalKEndpointKind | 'none'

export interface SignalKEndpoint {
  kind: SignalKEndpointKind
  label: string
  hostname: string
  port: number
  useTLS: boolean
  baseUrl: string
  probeUrl: string
}

interface ParsedBaseUrl {
  hostname: string
  port: number
  protocol: 'http:' | 'https:'
  useTLS: boolean
  baseUrl: string
}

interface ResolveSignalKClientEndpointsOptions {
  remoteBaseUrl: string
  localBaseUrl: string
  devBaseUrl?: string
  isDev: boolean
  pageProtocol: 'http:' | 'https:'
}

interface ResolveSignalKServerBaseUrlsOptions {
  remoteBaseUrl?: string
  localBaseUrl?: string
  writeBaseUrl?: string
  preferLocal?: boolean
}

export function resolveSignalKClientEndpoints(
  options: ResolveSignalKClientEndpointsOptions,
): SignalKEndpoint[] {
  const localBaseUrl = resolveBrowserLocalBaseUrl(options.localBaseUrl, options.pageProtocol)

  const localEndpoint = toSignalKEndpoint(localBaseUrl, 'local', 'local')
  const remoteEndpoint = toSignalKEndpoint(options.remoteBaseUrl, 'remote', 'internet')
  const endpoints =
    options.isDev && options.devBaseUrl
      ? [toSignalKEndpoint(options.devBaseUrl, 'dev', 'dev'), localEndpoint, remoteEndpoint]
      : [localEndpoint, remoteEndpoint]

  return dedupeEndpoints(endpoints)
}

export function resolveSignalKServerBaseUrls(
  options: ResolveSignalKServerBaseUrlsOptions,
): string[] {
  const ordered = options.preferLocal
    ? [options.writeBaseUrl, options.localBaseUrl, options.remoteBaseUrl]
    : [options.writeBaseUrl, options.remoteBaseUrl, options.localBaseUrl]

  return uniqueBaseUrls(ordered)
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function resolveBrowserLocalBaseUrl(
  baseUrl: string,
  pageProtocol: 'http:' | 'https:',
): string {
  const parsed = parseBaseUrl(baseUrl)
  if (pageProtocol !== 'https:' || parsed.protocol === 'https:') {
    return parsed.baseUrl
  }

  const securePort = parsed.port === 80 ? 443 : parsed.port
  return `https://${parsed.hostname}${securePort === 443 ? '' : `:${securePort}`}`
}

export function toSignalKEndpoint(
  baseUrl: string,
  kind: SignalKEndpointKind,
  label: string,
): SignalKEndpoint {
  const parsed = parseBaseUrl(baseUrl)
  return {
    kind,
    label,
    hostname: parsed.hostname,
    port: parsed.port,
    useTLS: parsed.useTLS,
    baseUrl: parsed.baseUrl,
    probeUrl: `${parsed.baseUrl}/signalk/v1/api/`,
  }
}

function parseBaseUrl(baseUrl: string): ParsedBaseUrl {
  const normalized = normalizeBaseUrl(baseUrl.trim())
  const parsed = new URL(normalized)
  const protocol = parsed.protocol === 'https:' ? 'https:' : 'http:'
  const useTLS = protocol === 'https:'
  const port = parsed.port ? Number(parsed.port) : useTLS ? 443 : 80

  return {
    hostname: parsed.hostname,
    port,
    protocol,
    useTLS,
    baseUrl: `${protocol}//${parsed.hostname}${parsed.port ? `:${port}` : port === 80 || port === 443 ? '' : `:${port}`}`,
  }
}

function dedupeEndpoints(endpoints: SignalKEndpoint[]): SignalKEndpoint[] {
  const seen = new Set<string>()
  const unique: SignalKEndpoint[] = []

  for (const endpoint of endpoints) {
    const key = `${endpoint.kind}:${endpoint.baseUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(endpoint)
  }

  return unique
}

function uniqueBaseUrls(urls: Array<string | undefined>): string[] {
  const unique = new Set<string>()

  for (const value of urls) {
    if (!value?.trim()) continue
    unique.add(normalizeBaseUrl(value.trim()))
  }

  return Array.from(unique)
}
