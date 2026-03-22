import { createSocket } from 'node:dgram'

export interface SwitchDef {
  label: string
  commandCode: number
  stateCode: number | null
  internalId: number | null
  writable: boolean
  category: 'light' | 'pump'
  payload: number[]
  signalKId: string
}

export interface SignalKSwitchConfig {
  signalKBaseUrl?: string
  signalKFallbackBaseUrl?: string
}

export interface SwitchStateSnapshot {
  label: string
  state: 'on' | 'off' | 'unknown'
  writable: boolean
  category: 'light' | 'pump'
}

const DEFAULT_SIGNALK_BASE_URL = 'https://signalk-public.tideye.com'
const DEFAULT_SIGNALK_FALLBACK_BASE_URL = 'http://signalk-local.tideye.com'
const SIGNALK_LEOPARD_SWITCHES_PATH = '/signalk/v1/api/vessels/self/electrical/switches/leopard'

export const SWITCH_MAP: Record<string, SwitchDef> = {
  external_helm_light: {
    label: 'External Helm Light',
    commandCode: 0x3a,
    stateCode: 0x3b,
    internalId: 0x0b,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'externalHelmLight',
  },
  external_helm_red_light: {
    label: 'External Helm Red Light',
    commandCode: 0x33,
    stateCode: 0x34,
    internalId: 0x0a,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'externalHelmRedLight',
  },
  compass_light_external_helm: {
    label: 'Compass Light',
    commandCode: 0x2e,
    stateCode: 0x2d,
    internalId: 0x0c,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'compassLightExternalHelm',
  },
  nav_lights: {
    label: 'Nav Lights',
    commandCode: 0x29,
    stateCode: null,
    internalId: 0x08,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'navLights',
  },
  anchor_lights: {
    label: 'Anchor Lights',
    commandCode: 0x2a,
    stateCode: 0x2a,
    internalId: null,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'anchorLights',
  },
  steaming_lights: {
    label: 'Steaming Lights',
    commandCode: 0x39,
    stateCode: 0x38,
    internalId: 0x14,
    writable: true,
    category: 'light',
    payload: [0x00, 0x00, 0x01, 0xff],
    signalKId: 'steamingLights',
  },
  water_pressure_pump_stbd: {
    label: 'Water Pressure Pump — Stbd',
    commandCode: 0x1f,
    stateCode: 0x1f,
    internalId: 0x03,
    writable: true,
    category: 'pump',
    payload: [0x00, 0x01, 0x01, 0xff],
    signalKId: 'waterPressurePumpStbd',
  },
  water_pressure_pump_port: {
    label: 'Water Pressure Pump — Port',
    commandCode: 0x1e,
    stateCode: null,
    internalId: 0x00,
    writable: false,
    category: 'pump',
    payload: [0x00, 0x01, 0x01, 0xff],
    signalKId: 'waterPressurePumpPort',
  },
}

export type SwitchId = keyof typeof SWITCH_MAP

type UiState = 'on' | 'off' | 'unknown'

const switchStates = new Map<string, { state: UiState; source: string; updatedAt: string | null }>()

for (const id of Object.keys(SWITCH_MAP)) {
  switchStates.set(id, { state: 'unknown', source: 'default', updatedAt: null })
}

export async function getSwitchStates(
  config: SignalKSwitchConfig = {},
): Promise<Record<string, SwitchStateSnapshot>> {
  const signalKTree = await fetchSignalKSwitchTree(config)
  const result: Record<string, SwitchStateSnapshot> = {}

  for (const [id, def] of Object.entries(SWITCH_MAP)) {
    const node = signalKTree?.[def.signalKId]
    const signalKState = toUiState(node?.state?.value)
    const cached = switchStates.get(id)
    const mergedState = signalKState !== 'unknown' ? signalKState : (cached?.state ?? 'unknown')

    if (signalKState !== 'unknown') {
      setSwitchState(id, signalKState, 'signalk')
    }

    result[id] = {
      label: getSignalKLabel(node) || def.label,
      state: mergedState,
      writable: getSignalKWritable(node, def.writable),
      category: def.category,
    }
  }

  return result
}

export function getSwitchState(id: string): UiState {
  return switchStates.get(id)?.state ?? 'unknown'
}

export function setSwitchState(id: string, state: UiState, source: string = 'cache') {
  switchStates.set(id, {
    state,
    source,
    updatedAt: new Date().toISOString(),
  })
}

async function fetchSignalKSwitchTree(config: SignalKSwitchConfig) {
  for (const baseUrl of getSignalKBaseUrls(config)) {
    try {
      const response = await fetchWithTimeout(
        `${normaliseBaseUrl(baseUrl)}${SIGNALK_LEOPARD_SWITCHES_PATH}`,
        2500,
      )

      if (!response.ok) {
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalK API response shape is dynamic
      return (await response.json()) as Record<string, any>
    } catch {
      continue
    }
  }

  return null
}

function getSignalKBaseUrls(config: SignalKSwitchConfig): string[] {
  const candidates = [
    config.signalKBaseUrl || DEFAULT_SIGNALK_BASE_URL,
    config.signalKFallbackBaseUrl || DEFAULT_SIGNALK_FALLBACK_BASE_URL,
  ]

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalK response node shape is dynamic
function getSignalKLabel(node: any): string | null {
  if (
    typeof node?.meta?.displayName?.value === 'string' &&
    node.meta.displayName.value.length > 0
  ) {
    return node.meta.displayName.value
  }
  if (typeof node?.name?.value === 'string' && node.name.value.length > 0) {
    return node.name.value
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalK response node shape is dynamic
function getSignalKWritable(node: any, fallback: boolean): boolean {
  if (typeof node?.meta?.leopard?.writable?.value === 'boolean') {
    return node.meta.leopard.writable.value
  }
  return fallback
}

function toUiState(value: unknown): UiState {
  if (value === true || value === 'on' || value === 1) {
    return 'on'
  }
  if (value === false || value === 'off' || value === 0) {
    return 'off'
  }
  return 'unknown'
}

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

let txnCounter = 0x30
let sequenceBaseCounter = 0x00

function nextTxn(): number {
  const txn = txnCounter
  txnCounter = (txnCounter + 1) & 0xff
  return txn
}

function nextSequenceBase(): number {
  const sequenceBase = sequenceBaseCounter
  sequenceBaseCounter = (sequenceBaseCounter + 0x20) & 0xff
  return sequenceBase
}

export function buildToggleCommand(switchId: string): { lines: string[]; txn: number } {
  const def = SWITCH_MAP[switchId]
  if (!def) throw new Error(`Unknown switch: ${switchId}`)
  if (!def.writable) throw new Error(`Switch ${switchId} is read-only`)

  const txn = nextTxn()
  const sequenceBase = nextSequenceBase()
  const line1 = `1DEF0004 ${sequenceBase.toString(16).toUpperCase().padStart(2, '0')} 13 30 99 FF FF 82 1A`
  const line2 = `1DEF0004 ${((sequenceBase + 1) & 0xff).toString(16).toUpperCase().padStart(2, '0')} 06 FE FF FF 02 ${txn.toString(16).toUpperCase().padStart(2, '0')} 00`
  const codeHex = def.commandCode.toString(16).toUpperCase().padStart(2, '0')
  const payloadHex = def.payload
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
  const line3 = `1DEF0004 ${((sequenceBase + 2) & 0xff).toString(16).toUpperCase().padStart(2, '0')} 01 05 ${codeHex} ${payloadHex}`

  return { lines: [line1, line2, line3], txn }
}

export interface SendResult {
  success: boolean
  switchId: string
  txn: number
  timestamp: string
  rawLines: string[]
  error?: string
}

export async function sendCommand(
  host: string,
  port: number,
  switchId: string,
): Promise<SendResult> {
  const timestamp = new Date().toISOString()
  let command: { lines: string[]; txn: number }

  try {
    command = buildToggleCommand(switchId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[EmpirBus] ${timestamp} build failed for ${switchId}: ${message}`)
    return { success: false, switchId, txn: 0, timestamp, rawLines: [], error: message }
  }

  console.log(
    `[EmpirBus] ${timestamp} send ${switchId} txn=0x${command.txn.toString(16).toUpperCase()} target=${host}:${port}`,
  )

  return new Promise((resolve) => {
    const socket = createSocket('udp4')
    const payload = Buffer.from(command.lines.join('\r\n') + '\r\n', 'ascii')

    socket.on('error', (error) => {
      socket.close()
      resolve({
        success: false,
        switchId,
        txn: command.txn,
        timestamp,
        rawLines: command.lines,
        error: error.message,
      })
    })

    socket.send(payload, 0, payload.length, port, host, (error) => {
      socket.close()
      if (error) {
        resolve({
          success: false,
          switchId,
          txn: command.txn,
          timestamp,
          rawLines: command.lines,
          error: error.message,
        })
        return
      }

      resolve({
        success: true,
        switchId,
        txn: command.txn,
        timestamp,
        rawLines: command.lines,
      })
    })
  })
}
