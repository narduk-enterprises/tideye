/**
 * Convenience wrapper around `useSeo()` + `useWebPageSchema()`.
 *
 * Every page repeats the same boilerplate:
 *   const config = useRuntimeConfig()
 *   const appName = config.public.appName || DEFAULT_APP_NAME
 *   useSeo({ title: `${appName} — ${pageName}`, description })
 *   useWebPageSchema({ name: `${appName} — ${pageName}`, description })
 *
 * This composable consolidates that into a single call.
 */

const DEFAULT_APP_NAME = 'TideEye'

export function usePageSeo(
  pageName: string,
  description: string,
  ogImage?: { title?: string; description?: string; icon?: string },
) {
  const config = useRuntimeConfig()
  const appName = (config.public.appName as string) || DEFAULT_APP_NAME
  const title = `${appName} — ${pageName}`

  useSeo({ title, description, ...(ogImage ? { ogImage } : {}) })
  useWebPageSchema({ name: title, description })

  return { appName }
}
