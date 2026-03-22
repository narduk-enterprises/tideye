/**
 * Convenience wrapper around `useSeo()` + `useWebPageSchema()`.
 *
 * Every page repeats the same boilerplate:
 *   const config = useRuntimeConfig()
 *   const appName = config.public.appName || 'TideEye'
 *   useSeo({ title: `${appName} — ${pageName}`, description })
 *   useWebPageSchema({ name: `${appName} — ${pageName}`, description })
 *
 * This composable consolidates that into a single call.
 */
export function usePageSeo(
  pageName: string,
  description: string,
  ogImage?: { title?: string; description?: string; icon?: string },
) {
  const config = useRuntimeConfig()
  const appName = config.public.appName || 'TideEye'
  const title = `${appName} — ${pageName}`

  useSeo({ title, description, ...(ogImage ? { ogImage } : {}) })
  useWebPageSchema({ name: title, description })

  return { appName }
}
