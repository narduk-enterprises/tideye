import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_NAME = process.env.APP_NAME?.trim()
  ? process.env.APP_NAME.trim().replace(/^tideye$/i, 'Tideye')
  : 'Tideye'

const appBackendPreset =
  process.env.APP_BACKEND_PRESET === 'managed-supabase' ? 'managed-supabase' : 'default'
const configuredAuthBackend = process.env.AUTH_BACKEND
const supabaseUrl = process.env.AUTH_AUTHORITY_URL || process.env.SUPABASE_URL || ''
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_AUTH_ANON_KEY ||
  ''
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || ''
const authBackend =
  configuredAuthBackend === 'supabase' || configuredAuthBackend === 'local'
    ? configuredAuthBackend
    : supabaseUrl && supabasePublishableKey
      ? 'supabase'
      : 'local'
const authAuthorityUrl = supabaseUrl
const appOrmTablesEntry =
  process.env.NUXT_DATABASE_BACKEND === 'postgres'
    ? './server/database/pg-app-schema.ts'
    : './server/database/app-schema.ts'

function parseAuthProviders(value: string | undefined) {
  return (value || 'apple,email')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider, index, providers) => provider && providers.indexOf(provider) === index)
}

const authProviders =
  authBackend === 'supabase' ? parseAuthProviders(process.env.AUTH_PROVIDERS) : ['email']
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  alias: {
    '#server/app-orm-tables': fileURLToPath(new URL(appOrmTablesEntry, import.meta.url)),
  },

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['nitro-cloudflare-dev', '@pinia/nuxt'],

  css: ['~/assets/css/widgets.css'],

  nitro: {
    cloudflareDev: {
      configPath: resolve(__dirname, 'wrangler.json'),
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: Number(process.env.NUXT_PORT || 3000),
  },

  runtimeConfig: {
    appBackendPreset,
    authBackend,
    authAuthorityUrl,
    authAnonKey: supabasePublishableKey,
    authServiceRoleKey: supabaseServiceRoleKey,
    authStorageKey: process.env.AUTH_STORAGE_KEY || 'web-auth',
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey,
    // Apple Maps Server API (reverse geocode for voyage titles via /api/passages/:id/places)
    mapkitServerApiKey: process.env.MAPKIT_SERVER_API_KEY || '',
    appleTeamId: process.env.APPLE_TEAM_ID || '',
    appleKeyId: process.env.APPLE_KEY_ID || '',
    appleSecretKey: process.env.APPLE_SECRET_KEY || '',
    // Server-only (admin API routes)
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    // EmpirBus/YDWG switching (server-only, local network)
    ydwgHost: process.env.YDWG_HOST || '198.18.7.68',
    ydwgPort: process.env.YDWG_PORT || '1457',
    signalKBaseUrl: process.env.SIGNALK_BASE_URL || 'https://signalk-public.tideye.com',
    signalKFallbackBaseUrl:
      process.env.SIGNALK_FALLBACK_BASE_URL || 'http://signalk-local.tideye.com',
    signalKWriteBaseUrl:
      process.env.SIGNALK_WRITE_BASE_URL ||
      process.env.SIGNALK_BASE_URL ||
      'https://signalk-public.tideye.com',
    signalKWriteClientId: process.env.SIGNALK_WRITE_CLIENT_ID || 'tideye-switching-ui',
    signalKWriteToken: process.env.SIGNALK_WRITE_TOKEN || '',
    /** Dev-only: local JSON playback bundles (see /api/passages/:id/playback) */
    passageExportOutDir: process.env.PASSAGE_EXPORT_OUT_DIR || '',
    public: {
      appUrl: process.env.SITE_URL || 'https://tideye.nard.uk',
      appName: APP_NAME,
      // Analytics (client-side tracking)
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
      /** MastCam / other embedded live views (CSP frame-src) */
      cspFrameSrc: process.env.CSP_FRAME_SRC || 'https://mastcam.tideye.com https://mfd.tideye.com',
      /** SignalK client connections (local HTTP + public HTTPS/WSS) */
      cspConnectSrc:
        process.env.CSP_CONNECT_SRC ||
        'http://signalk-local.tideye.com,https://signalk-local.tideye.com,wss://signalk-local.tideye.com,https://signalk-public.tideye.com,wss://signalk-public.tideye.com,http://bee.tideye.com:3000,ws://bee.tideye.com:3000',
      signalKRemoteBaseUrl:
        process.env.NUXT_PUBLIC_SIGNALK_REMOTE_BASE_URL ||
        process.env.SIGNALK_BASE_URL ||
        'https://signalk-public.tideye.com',
      signalKLocalBaseUrl:
        process.env.NUXT_PUBLIC_SIGNALK_LOCAL_BASE_URL ||
        process.env.SIGNALK_FALLBACK_BASE_URL ||
        'http://signalk-local.tideye.com',
      signalKDevBaseUrl:
        process.env.NUXT_PUBLIC_SIGNALK_DEV_BASE_URL || 'http://bee.tideye.com:3000',
      /** Video-stream blob workers */
      cspWorkerSrc: process.env.CSP_WORKER_SRC || 'blob:',
    },
  },

  site: {
    url: process.env.SITE_URL || 'https://tideye.nard.uk',
    name: APP_NAME,
    description: 'Tideye — powered by Nuxt 4 and Cloudflare Workers.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: APP_NAME,
      url: process.env.SITE_URL || 'https://tideye.nard.uk',
      logo: '/favicon.svg',
    },
  },

  image: {
    cloudflare: {
      baseURL: process.env.SITE_URL || 'https://tideye.nard.uk',
    },
  },
})
