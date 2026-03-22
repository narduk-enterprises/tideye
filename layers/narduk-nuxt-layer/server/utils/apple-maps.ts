/**
 * Apple Maps Server API utilities.
 *
 * Handles developer token generation (ES256 JWT via Apple signing credentials)
 * and access token exchange for authenticated API calls.
 *
 * Pattern extracted from hoods/server/api/neighborhoods.get.ts.
 */

import { grokChat } from './xai'

export interface AppleMapsCreds {
  mapkitServerApiKey: string
  appleTeamId: string
  appleKeyId: string
  appleSecretKey: string
}

let cachedDeveloperToken = ''
let cachedDeveloperTokenExpiresAt = 0

const DEVELOPER_TOKEN_REFRESH_WINDOW_MS = 60_000
const CONTEXTUAL_SEARCH_QUERIES = [
  'marina',
  'harbor',
  'harbour',
  'port',
  'anchorage',
  'bay',
  'inlet',
  'cay',
  'island',
  'settlement',
  'town',
  'village',
  'sound',
  'channel',
  'river',
  'creek',
]
const GENERIC_CONTEXTUAL_LABELS = new Set([
  'the bahamas',
  'bahamas',
  'united states',
  'united states of america',
  'usa',
  'north atlantic ocean',
  'atlantic ocean',
  'caribbean sea',
  'gulf of america',
  'gulf of mexico',
])
const XAI_CONTEXT_MODEL = process.env.XAI_CONTEXT_MODEL || 'grok-4-0709'
const contextualAiCache = new Map<string, string | null>()

function normalizePrivateKey(secretKey: string) {
  return secretKey.includes('\\n') ? secretKey.replaceAll('\\n', '\n') : secretKey
}

function decodeJwtPayload(token: string) {
  try {
    const payloadSegment = token.split('.')[1]
    if (!payloadSegment) return null

    let normalized = payloadSegment.replaceAll('-', '+').replaceAll('_', '/')
    while (normalized.length % 4 !== 0) {
      normalized += '='
    }

    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as Record<string, unknown>
  } catch (err) {
    console.warn('[AppleMaps] Failed to decode JWT payload', err)
    return null
  }
}

function tokenExpiresAt(token: string) {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)
  return Number.isFinite(exp) ? exp * 1000 : 0
}

function isTokenFresh(token: string, refreshWindowMs: number) {
  const expiresAt = tokenExpiresAt(token)
  return expiresAt > Date.now() + refreshWindowMs
}

function hasSigningCredentials(config: AppleMapsCreds) {
  return Boolean(config.appleTeamId && config.appleKeyId && config.appleSecretKey)
}

export async function getDeveloperToken(config: AppleMapsCreds) {
  const configuredToken = config.mapkitServerApiKey.trim()
  if (configuredToken && isTokenFresh(configuredToken, DEVELOPER_TOKEN_REFRESH_WINDOW_MS)) {
    return configuredToken
  }

  const now = Date.now()
  if (
    cachedDeveloperToken &&
    cachedDeveloperTokenExpiresAt > now + DEVELOPER_TOKEN_REFRESH_WINDOW_MS
  ) {
    return cachedDeveloperToken
  }

  if (!hasSigningCredentials(config)) {
    if (configuredToken) {
      return configuredToken
    }
    throw new Error('Missing Apple Maps developer credentials')
  }

  const { SignJWT, importPKCS8 } = await import('jose')
  const privateKey = await importPKCS8(normalizePrivateKey(config.appleSecretKey), 'ES256')
  const nowSeconds = Math.floor(now / 1000)
  const expiresInSeconds = 60 * 30
  const expiresAtSeconds = nowSeconds + expiresInSeconds

  const token = await new SignJWT({ appid: 'food-trucks' })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: config.appleKeyId })
    .setIssuer(config.appleTeamId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAtSeconds)
    .sign(privateKey)

  cachedDeveloperToken = token
  cachedDeveloperTokenExpiresAt = expiresAtSeconds * 1000

  return token
}

// --- Maps Server API access token (exchange at /v1/token) ---

let cachedMapsAccessToken = ''
let cachedMapsAccessTokenExpiresAt = 0

/**
 * Exchange a Maps Auth / developer JWT for a short-lived access token used by
 * Geocode, Reverse Geocode, Search, and ETA endpoints.
 *
 * For access tokens from runtime config (no JWT argument), use
 * `getAppleMapsAccessToken` in `appleMapToken.ts` instead.
 */
export async function exchangeAppleMapsAuthJwtForAccessToken(
  developerJwt: string,
): Promise<string> {
  const now = Date.now()
  if (cachedMapsAccessToken && now < cachedMapsAccessTokenExpiresAt) {
    return cachedMapsAccessToken
  }

  const res = await $fetch<{ accessToken?: string; expiresInSeconds?: number }>(
    'https://maps-api.apple.com/v1/token',
    {
      headers: { Authorization: `Bearer ${developerJwt}` },
    },
  )

  const at = res.accessToken
  if (!at) {
    throw new Error('Apple Maps /v1/token response missing accessToken')
  }

  cachedMapsAccessToken = at
  const sec = res.expiresInSeconds ?? 300
  cachedMapsAccessTokenExpiresAt = now + Math.max(60, sec) * 1000 - 30_000
  return at
}

// --- Search API ---

export interface AppleMapsSearchResult {
  name?: string
  displayName?: string
  formattedAddressLines?: string[]
  coordinate?: {
    latitude?: number | string
    longitude?: number | string
  }
  structuredAddress?: {
    administrativeArea?: string
    administrativeAreaCode?: string
    locality?: string
    subLocality?: string
    postCode?: string
    thoroughfare?: string
    subThoroughfare?: string
    fullThoroughfare?: string
    areasOfInterest?: string[]
    dependentLocalities?: string[]
  }
  poiCategory?: string
  country?: string
  countryCode?: string
}

interface AppleMapsSearchResponse {
  results?: AppleMapsSearchResult[]
  displayMapRegion?: {
    northLatitude?: number
    southLatitude?: number
    eastLongitude?: number
    westLongitude?: number
  }
}

export interface SearchOptions {
  query: string
  searchLocation?: { lat: number; lng: number }
  searchRegion?: { north: number; east: number; south: number; west: number }
  includePoiCategories?: string
  limit?: number
  resultTypeFilter?: string
  limitToCountries?: string
  lang?: string
}

export async function searchPlaces(
  accessToken: string,
  options: SearchOptions,
): Promise<AppleMapsSearchResult[]> {
  const url = new URL('https://maps-api.apple.com/v1/search')
  url.searchParams.set('q', options.query)
  if (options.resultTypeFilter) {
    url.searchParams.set('resultTypeFilter', options.resultTypeFilter)
  }
  if (options.limitToCountries) {
    url.searchParams.set('limitToCountries', options.limitToCountries)
  }
  url.searchParams.set('lang', options.lang || 'en-US')

  if (options.limit) {
    url.searchParams.set('limit', String(options.limit))
  }

  if (options.searchLocation) {
    url.searchParams.set(
      'searchLocation',
      `${options.searchLocation.lat},${options.searchLocation.lng}`,
    )
  }

  if (options.searchRegion) {
    const { north, east, south, west } = options.searchRegion
    url.searchParams.set('searchRegion', `${north},${east},${south},${west}`)
  }

  if (options.includePoiCategories) {
    url.searchParams.set('includePoiCategories', options.includePoiCategories)
  }

  const response = await $fetch<AppleMapsSearchResponse>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return response.results ?? []
}

/** Reverse geocode a coordinate using an access token from {@link exchangeAppleMapsAuthJwtForAccessToken}. */
export async function reverseGeocodeCoordinate(
  accessToken: string,
  lat: number,
  lng: number,
  lang = 'en-US',
): Promise<AppleMapsSearchResult | null> {
  const url = new URL('https://maps-api.apple.com/v1/reverseGeocode')
  url.searchParams.set('loc', `${lat},${lng}`)
  url.searchParams.set('lang', lang)

  const response = await $fetch<AppleMapsSearchResponse>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  return response.results?.[0] ?? null
}

/**
 * Developer credentials → access token → reverse geocode (convenience for server routes).
 */
export async function reverseGeocodeWithServerApi(
  creds: AppleMapsCreds,
  lat: number,
  lng: number,
): Promise<AppleMapsSearchResult | null> {
  const dev = await getDeveloperToken(creds)
  const access = await exchangeAppleMapsAuthJwtForAccessToken(dev)
  return reverseGeocodeCoordinate(access, lat, lng)
}

function normalizeContextualLabel(value: unknown) {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (!cleaned) return null
  if (
    /^\d/.test(cleaned) ||
    /\b(?:st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|ln|lane|ct|court)\b/i.test(cleaned)
  ) {
    return null
  }
  return cleaned
}

function normalizeContextualKey(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replaceAll(/\s+/g, ' ').toLowerCase()
}

function isSpecificMarinePlaceLabel(value: string) {
  return /\b(?:marina|harbor|harbour|port|anchorage|bay|inlet|cay|island|sound|channel|river|creek|point|shoal)\b/i.test(
    value,
  )
}

function isGenericContextualLabel(value: string, result: AppleMapsSearchResult | null) {
  const key = normalizeContextualKey(value)
  if (!key) return true
  if (GENERIC_CONTEXTUAL_LABELS.has(key)) return true
  if (isSpecificMarinePlaceLabel(value)) return false

  const structured = result?.structuredAddress
  const genericMatch = [
    result?.country,
    structured?.administrativeArea,
    structured?.locality,
    structured?.subLocality,
  ].some((candidate) => normalizeContextualKey(candidate) === key)

  return genericMatch
}

function pickContextualLabelFromResult(result: AppleMapsSearchResult | null) {
  if (!result) return null

  const structured = result.structuredAddress
  const candidates = [
    result.name,
    structured?.areasOfInterest?.[0],
    structured?.subLocality,
    structured?.locality,
    structured?.dependentLocalities?.[0],
  ]

  for (const candidate of candidates) {
    const normalized = normalizeContextualLabel(candidate)
    if (normalized && !isGenericContextualLabel(normalized, result)) return normalized
  }

  return null
}

function smallSearchRegion(lat: number, lng: number, radiusNm: number) {
  const latDelta = radiusNm / 60
  const lonDelta = radiusNm / Math.max(1, 60 * Math.cos((lat * Math.PI) / 180))
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lonDelta,
    west: lng - lonDelta,
  }
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065
  const toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function pickNearbyContextualResult(
  results: AppleMapsSearchResult[],
  lat: number,
  lng: number,
): string | null {
  let best: string | null = null
  let bestScore = -Infinity
  for (const result of results) {
    const label = normalizeContextualLabel(result.name || result.displayName)
    const resLat = Number(result.coordinate?.latitude)
    const resLon = Number(result.coordinate?.longitude)
    if (!label || isGenericContextualLabel(label, result)) continue
    if (!Number.isFinite(resLat) || !Number.isFinite(resLon)) continue

    const distanceNm = haversineNm(lat, lng, resLat, resLon)
    const marineBoost = isSpecificMarinePlaceLabel(label) ? 4 : 0
    const score = marineBoost - distanceNm
    if (score > bestScore) {
      bestScore = score
      best = label
    }
  }
  return best
}

function summarizeAppleResult(result: AppleMapsSearchResult | null) {
  if (!result) return null
  const structured = result.structuredAddress
  const bits = [
    result.name || result.displayName || null,
    structured?.areasOfInterest?.[0] || null,
    structured?.subLocality || null,
    structured?.locality || null,
    structured?.administrativeArea || null,
    result.country || null,
  ].filter((value): value is string => Boolean(value && value.trim()))

  return bits.length ? bits.join(' | ') : null
}

function collectNearbyContextualCandidates(
  results: AppleMapsSearchResult[],
  lat: number,
  lng: number,
) {
  const seen = new Set<string>()
  const candidates: Array<{ label: string; distanceNm: number; poiCategory: string | null }> = []

  for (const result of results) {
    const label = normalizeContextualLabel(result.name || result.displayName)
    const resLat = Number(result.coordinate?.latitude)
    const resLon = Number(result.coordinate?.longitude)
    if (!label || isGenericContextualLabel(label, result)) continue
    if (!Number.isFinite(resLat) || !Number.isFinite(resLon)) continue

    const key = normalizeContextualKey(label)
    if (seen.has(key)) continue
    seen.add(key)

    candidates.push({
      label,
      distanceNm: haversineNm(lat, lng, resLat, resLon),
      poiCategory: typeof result.poiCategory === 'string' ? result.poiCategory : null,
    })
  }

  candidates.sort((left, right) => left.distanceNm - right.distanceNm)
  return candidates.slice(0, 12)
}

function parseXaiContextualLabel(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return null

  const match = trimmed.match(/\{[\s\S]*\}/)
  const candidatePayload = match ? match[0] : trimmed

  try {
    const parsed = JSON.parse(candidatePayload) as { label?: string | null }
    const normalized = normalizeContextualLabel(parsed.label)
    return normalized && !GENERIC_CONTEXTUAL_LABELS.has(normalizeContextualKey(normalized))
      ? normalized
      : null
  } catch {
    const normalized = normalizeContextualLabel(trimmed.replace(/^label\s*:\s*/i, '').trim())
    return normalized && !GENERIC_CONTEXTUAL_LABELS.has(normalizeContextualKey(normalized))
      ? normalized
      : null
  }
}

async function disambiguateContextualLabelWithXai(
  lat: number,
  lng: number,
  reverse: AppleMapsSearchResult | null,
  nearbyResults: AppleMapsSearchResult[],
) {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) return null

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (contextualAiCache.has(cacheKey)) {
    return contextualAiCache.get(cacheKey) ?? null
  }

  const reverseSummary = summarizeAppleResult(reverse)
  const nearbyCandidates = collectNearbyContextualCandidates(nearbyResults, lat, lng)
  if (!nearbyCandidates.length) {
    contextualAiCache.set(cacheKey, null)
    return null
  }

  try {
    const content = await grokChat(
      apiKey,
      [
        {
          role: 'system',
          content:
            'You label sailing legs for cruisers. Return JSON only in the form {"label": string|null}. If the coordinate is offshore, choose the nearest familiar local place name sailors would actually use to describe that area. Prefer well-known cays, islands, anchorages, harbors, bays, marinas, settlements, or towns over obscure cuts, channels, or chart-only micro-features. Only use a cut or channel name when it is clearly the common cruising reference. Never return a country, state, address, or broad water body. Only return {"label": null} if no nearby specific place is available.',
        },
        {
          role: 'user',
          content: [
            `Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            reverseSummary ? `Apple reverse geocode: ${reverseSummary}` : null,
            nearbyCandidates.length
              ? `Nearby Apple candidates:\n${nearbyCandidates
                  .map((candidate) => {
                    const suffix = candidate.poiCategory
                      ? ` (${candidate.poiCategory}, ${candidate.distanceNm.toFixed(1)} nm)`
                      : ` (${candidate.distanceNm.toFixed(1)} nm)`
                    return `- ${candidate.label}${suffix}`
                  })
                  .join('\n')}`
              : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      XAI_CONTEXT_MODEL,
    )

    const label = parseXaiContextualLabel(content)
    contextualAiCache.set(cacheKey, label)
    return label
  } catch (error) {
    console.warn('[AppleMaps] xAI contextual label fallback failed', error)
    contextualAiCache.set(cacheKey, null)
    return null
  }
}

export async function resolveContextualPlaceLabel(
  accessToken: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  const reverse = await reverseGeocodeCoordinate(accessToken, lat, lng)
  const direct = pickContextualLabelFromResult(reverse)
  if (direct) return direct

  const region = smallSearchRegion(lat, lng, 10)
  const nearbyCandidates: AppleMapsSearchResult[] = []
  for (const query of CONTEXTUAL_SEARCH_QUERIES) {
    const nearby = await searchPlaces(accessToken, {
      query,
      searchLocation: { lat, lng },
      searchRegion: region,
      limit: 8,
      lang: 'en-US',
    })
    nearbyCandidates.push(...nearby)
    const best = pickNearbyContextualResult(nearby, lat, lng)
    if (best) return best
  }

  const broaderRegion = smallSearchRegion(lat, lng, 24)
  for (const query of CONTEXTUAL_SEARCH_QUERIES) {
    const nearby = await searchPlaces(accessToken, {
      query,
      searchLocation: { lat, lng },
      searchRegion: broaderRegion,
      limit: 8,
      lang: 'en-US',
    })
    nearbyCandidates.push(...nearby)
  }

  const aiLabel = await disambiguateContextualLabelWithXai(lat, lng, reverse, nearbyCandidates)
  if (aiLabel) return aiLabel

  return null
}

export async function resolveContextualPlaceLabelWithServerApi(
  creds: AppleMapsCreds,
  lat: number,
  lng: number,
): Promise<string | null> {
  const dev = await getDeveloperToken(creds)
  const access = await exchangeAppleMapsAuthJwtForAccessToken(dev)
  return resolveContextualPlaceLabel(access, lat, lng)
}
