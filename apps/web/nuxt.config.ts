import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

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
    public: {
      appUrl: process.env.SITE_URL || 'https://tideye.nard.uk',
      appName: process.env.APP_NAME || 'Tideye',
      // Analytics (client-side tracking)
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
      /** MastCam / other embedded live views (CSP frame-src) */
      cspFrameSrc: process.env.CSP_FRAME_SRC || 'https://mastcam.tideye.com https://mfd.tideye.com',
    },
  },

  site: {
    url: process.env.SITE_URL || 'https://tideye.nard.uk',
    name: 'Tideye',
    description: 'Tideye — powered by Nuxt 4 and Cloudflare Workers.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Tideye',
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
