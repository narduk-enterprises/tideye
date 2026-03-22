/**
 * Main application navigation items and active-state logic.
 * Extracted from app.vue to keep the shell thin.
 */
export function useMainNavigation() {
  const route = useRoute()

  const navigation = [
    { label: 'Home', icon: 'i-lucide-home', to: '/' },
    { label: 'Dashboard', icon: 'i-lucide-gauge', to: '/dashboard' },
    { label: 'Map', icon: 'i-lucide-map', to: '/map' },
    { label: 'Switching', icon: 'i-lucide-toggle-right', to: '/switching' },
    { label: 'Cams', icon: 'i-lucide-video', to: '/cams' },
    { label: 'Voyages', icon: 'i-lucide-route', to: '/passages' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings', disabled: true },
  ] as const

  function isNavActive(to: string, path: string) {
    if (to === '/') return path === '/'
    return path === to || path.startsWith(`${to}/`)
  }

  const activeNavigation = computed(() =>
    navigation.map((item) => ({
      ...item,
      active: isNavActive(item.to, route.path),
    })),
  )

  return { navigation, activeNavigation }
}
