import { SWITCH_MAP } from './empirbus'
import type { SwitchId } from './empirbus'

export interface SignalKWriteConfig {
  signalKBaseUrl?: string
  signalKFallbackBaseUrl?: string
  signalKWriteBaseUrl?: string
  signalKWriteClientId?: string
  signalKWriteToken?: string
}

export interface SignalKWriteAccessStatus {
  status: 'unconfigured' | 'pending' | 'approved' | 'denied' | 'error'
  source: 'runtime-config' | 'storage' | 'request'
  clientId: string
  description: string
  baseUrl: string
  requestId: string | null
  href: string | null
  hasToken: boolean
  token: string | null
  message: string | null
}

interface PersistedAccessState {
  status: SignalKWriteAccessStatus['status']
  source: 'storage' | 'request'
  clientId: string
  description: string
  baseUrl: string
  requestId: string | null
  href: string | null
  token: string | null
  message: string | null
  requestedAt: string | null
  approvedAt: string | null
  checkedAt: string | null
}

interface SignalKToggleResult {
  success: boolean
  statusCode: number
  message: string
  response: Record<string, any> | null
}

const STORAGE_KEY = 'switching:signalk-device-access'
const DEFAULT_WRITE_BASE_URL = 'https://signalk-public.tideye.com'
const DEFAULT_CLIENT_ID = 'tideye-switching-ui'
const DEFAULT_DESCRIPTION = 'Tideye switching UI server access'
const SIGNALK_ACCESS_REQUEST_PATH = '/signalk/v1/access/requests'
const SIGNALK_REQUEST_STATUS_PREFIX = '/signalk/v1/requests/'
const SIGNALK_LEOPARD_PATH_PREFIX = '/signalk/v1/api/vessels/self/electrical/switches/leopard'

export async function getSignalKWriteAccessStatus(
  config: SignalKWriteConfig = {},
): Promise<SignalKWriteAccessStatus> {
  const runtimeToken = normalizeString(config.signalKWriteToken)
  const baseUrl = resolveSignalKWriteBaseUrl(config)
  const clientId = normalizeString(config.signalKWriteClientId) || DEFAULT_CLIENT_ID

  if (runtimeToken) {
    return {
      status: 'approved',
      source: 'runtime-config',
      clientId,
      description: DEFAULT_DESCRIPTION,
      baseUrl,
      requestId: null,
      href: null,
      hasToken: true,
      token: runtimeToken,
      message: 'Using SignalK write token from runtime config',
    }
  }

  const persisted = await readPersistedAccessState()
  if (!persisted) {
    return {
      status: 'unconfigured',
      source: 'storage',
      clientId,
      description: DEFAULT_DESCRIPTION,
      baseUrl,
      requestId: null,
      href: null,
      hasToken: false,
      token: null,
      message: 'No SignalK device token configured',
    }
  }

  if (persisted.requestId && !persisted.token) {
    return await refreshPersistedRequestStatus(config, persisted)
  }

  return {
    status: persisted.status,
    source: persisted.source,
    clientId: persisted.clientId,
    description: persisted.description,
    baseUrl: persisted.baseUrl,
    requestId: persisted.requestId,
    href: persisted.href,
    hasToken: Boolean(persisted.token),
    token: persisted.token,
    message: persisted.message,
  }
}

export async function createSignalKWriteAccessRequest(
  config: SignalKWriteConfig = {},
): Promise<SignalKWriteAccessStatus> {
  const current = await getSignalKWriteAccessStatus(config)
  if (current.status === 'approved' || current.status === 'pending') {
    return current
  }

  const baseUrl = resolveSignalKWriteBaseUrl(config)
  const clientId = normalizeString(config.signalKWriteClientId) || DEFAULT_CLIENT_ID
  const description = DEFAULT_DESCRIPTION

  const response = await fetch(`${baseUrl}${SIGNALK_ACCESS_REQUEST_PATH}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      description,
      permissions: 'readwrite',
    }),
  })

  const payload = await readJson(response)
  const message = getErrorMessage(payload) || `SignalK access request failed with ${response.status}`

  if (!response.ok) {
    const failedStatus: SignalKWriteAccessStatus = {
      status: 'error',
      source: 'request',
      clientId,
      description,
      baseUrl,
      requestId: payload?.requestId || null,
      href: payload?.href || null,
      hasToken: false,
      token: null,
      message,
    }
    await writePersistedAccessState({
      status: 'error',
      source: 'request',
      clientId,
      description,
      baseUrl,
      requestId: failedStatus.requestId,
      href: failedStatus.href,
      token: null,
      message,
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      checkedAt: new Date().toISOString(),
    })
    return failedStatus
  }

  const persisted: PersistedAccessState = {
    status: payload?.state === 'PENDING' ? 'pending' : 'error',
    source: 'request',
    clientId,
    description,
    baseUrl,
    requestId: payload?.requestId || null,
    href: payload?.href || null,
    token: payload?.accessRequest?.token || null,
    message: payload?.state === 'PENDING' ? 'SignalK access request pending approval' : message,
    requestedAt: new Date().toISOString(),
    approvedAt: payload?.accessRequest?.token ? new Date().toISOString() : null,
    checkedAt: new Date().toISOString(),
  }

  await writePersistedAccessState(persisted)
  return {
    status: persisted.status,
    source: persisted.source,
    clientId: persisted.clientId,
    description: persisted.description,
    baseUrl: persisted.baseUrl,
    requestId: persisted.requestId,
    href: persisted.href,
    hasToken: Boolean(persisted.token),
    token: persisted.token,
    message: persisted.message,
  }
}

export async function sendSignalKToggleCommand(
  config: SignalKWriteConfig,
  switchId: string,
): Promise<SignalKToggleResult> {
  const def = SWITCH_MAP[switchId as SwitchId]
  if (!def) {
    return {
      success: false,
      statusCode: 404,
      message: `Unknown switch: ${switchId}`,
      response: null,
    }
  }

  const access = await getSignalKWriteAccessStatus(config)
  if (!access.hasToken || !access.token) {
    return {
      success: false,
      statusCode: 428,
      message:
        access.status === 'pending'
          ? 'SignalK write access request is still pending approval'
          : 'SignalK write token is not configured',
      response: access as unknown as Record<string, any>,
    }
  }

  const response = await fetch(
    `${access.baseUrl}${SIGNALK_LEOPARD_PATH_PREFIX}/${def.signalKId}/toggle`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${access.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: true }),
    },
  )

  const payload = await readJson(response)
  const putResult = payload?.put
  const message
    = putResult?.message
      || payload?.message
      || (response.ok ? `Sent ${def.label} toggle via SignalK` : `SignalK write failed with ${response.status}`)

  return {
    success: response.ok,
    statusCode: response.status,
    message,
    response: payload,
  }
}

async function refreshPersistedRequestStatus(
  config: SignalKWriteConfig,
  persisted: PersistedAccessState,
): Promise<SignalKWriteAccessStatus> {
  if (!persisted.requestId) {
    return {
      status: persisted.status,
      source: persisted.source,
      clientId: persisted.clientId,
      description: persisted.description,
      baseUrl: persisted.baseUrl,
      requestId: null,
      href: persisted.href,
      hasToken: Boolean(persisted.token),
      token: persisted.token,
      message: persisted.message,
    }
  }

  const response = await fetch(`${resolveSignalKWriteBaseUrl(config)}${SIGNALK_REQUEST_STATUS_PREFIX}${persisted.requestId}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    return {
      status: 'error',
      source: 'request',
      clientId: persisted.clientId,
      description: persisted.description,
      baseUrl: persisted.baseUrl,
      requestId: persisted.requestId,
      href: persisted.href,
      hasToken: Boolean(persisted.token),
      token: persisted.token,
      message: `Unable to refresh SignalK access request (${response.status})`,
    }
  }

  const payload = await readJson(response)
  const permission = payload?.accessRequest?.permission
  const token = normalizeString(payload?.accessRequest?.token)
  const nextStatus: PersistedAccessState['status']
    = permission === 'APPROVED'
      ? 'approved'
      : permission === 'DENIED'
        ? 'denied'
        : payload?.state === 'PENDING'
          ? 'pending'
          : 'error'

  const nextState: PersistedAccessState = {
    ...persisted,
    status: nextStatus,
    token: token || persisted.token,
    message:
      permission === 'APPROVED'
        ? 'SignalK write access approved'
        : permission === 'DENIED'
          ? 'SignalK write access denied'
          : payload?.state === 'PENDING'
            ? 'SignalK access request pending approval'
            : persisted.message,
    approvedAt: permission === 'APPROVED' ? new Date().toISOString() : persisted.approvedAt,
    checkedAt: new Date().toISOString(),
  }

  await writePersistedAccessState(nextState)
  return {
    status: nextState.status,
    source: nextState.source,
    clientId: nextState.clientId,
    description: nextState.description,
    baseUrl: nextState.baseUrl,
    requestId: nextState.requestId,
    href: nextState.href,
    hasToken: Boolean(nextState.token),
    token: nextState.token,
    message: nextState.message,
  }
}

async function readPersistedAccessState(): Promise<PersistedAccessState | null> {
  const storage = useStorage('data')
  return (await storage.getItem<PersistedAccessState>(STORAGE_KEY)) || null
}

async function writePersistedAccessState(state: PersistedAccessState) {
  const storage = useStorage('data')
  await storage.setItem(STORAGE_KEY, state)
}

function resolveSignalKWriteBaseUrl(config: SignalKWriteConfig): string {
  const candidates = [
    config.signalKWriteBaseUrl,
    config.signalKBaseUrl,
    config.signalKFallbackBaseUrl,
    DEFAULT_WRITE_BASE_URL,
  ]

  for (const candidate of candidates) {
    const value = normalizeString(candidate)
    if (value) {
      return value.endsWith('/') ? value.slice(0, -1) : value
    }
  }

  return DEFAULT_WRITE_BASE_URL
}

async function readJson(response: Response): Promise<Record<string, any> | null> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as Record<string, any>
  } catch {
    return { message: text }
  }
}

function getErrorMessage(payload: Record<string, any> | null): string | null {
  if (!payload) return null
  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message
  }
  if (typeof payload.error === 'string' && payload.error.length > 0) {
    return payload.error
  }
  return null
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
