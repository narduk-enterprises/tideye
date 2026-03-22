<script setup lang="ts">
/**
 * TideEye Application Shell
 * Overrides the layer's default app.vue to provide TideEye-specific navigation.
 */
const route = useRoute()

const navigation = [
  { label: 'Home', icon: 'i-lucide-home', to: '/' },
  { label: 'Dashboard', icon: 'i-lucide-gauge', to: '/dashboard' },
  { label: 'Map', icon: 'i-lucide-map', to: '/map' },
  { label: 'Switching', icon: 'i-lucide-toggle-right', to: '/switching' },
  { label: 'Cams', icon: 'i-lucide-video', to: '/cams' },
  { label: 'Passages', icon: 'i-lucide-route', to: '/passages', disabled: true },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings', disabled: true },
]

const activeNavigation = computed(() =>
  navigation.map((item) => ({
    ...item,
    active: route.path === item.to,
  })),
)
</script>

<template>
  <LayerAppShell>
    <template #header>
      <div
        role="banner"
        class="border-b border-default bg-elevated/80 backdrop-blur-lg sticky top-0 z-50"
      >
        <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <!-- Logo -->
            <NuxtLink to="/" class="flex items-center gap-2.5 text-default no-underline">
              <UIcon name="i-lucide-waves" class="text-2xl text-primary" />
              <span class="font-display text-lg font-bold tracking-tight">TideEye</span>
            </NuxtLink>

            <!-- Desktop Navigation -->
            <!-- eslint-disable-next-line narduk/no-native-layout -- app shell: semantic nav landmark -->
            <nav class="hidden md:flex items-center gap-1">
              <NuxtLink
                v-for="item in activeNavigation"
                :key="item.label"
                :to="item.disabled ? undefined : item.to"
                :class="[
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-base',
                  item.active
                    ? 'bg-primary/10 text-primary'
                    : item.disabled
                      ? 'text-dimmed cursor-not-allowed opacity-50'
                      : 'text-muted hover:text-default hover:bg-muted',
                ]"
              >
                <UIcon :name="item.icon" class="text-base" />
                <span>{{ item.label }}</span>
                <UBadge
                  v-if="item.disabled"
                  label="Soon"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                />
              </NuxtLink>
            </nav>
          </div>
        </div>
      </div>
    </template>

    <!-- Main Content — no max-w wrapper so dashboard can go full-width -->
    <NuxtLayout>
      <NuxtPage :keepalive="true" />
    </NuxtLayout>

    <template #footer>
      <!-- Mobile Bottom Navigation -->
      <!-- eslint-disable-next-line narduk/no-native-layout -- app shell: semantic nav landmark -->
      <nav
        class="md:hidden fixed bottom-0 inset-x-0 border-t border-default bg-elevated/95 backdrop-blur-lg z-50 safe-area-pb"
      >
        <div class="flex items-center justify-around h-16 px-2">
          <NuxtLink
            v-for="item in activeNavigation.filter((n) => !n.disabled)"
            :key="item.label"
            :to="item.to"
            :class="[
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-base min-w-0',
              item.active ? 'text-primary' : 'text-dimmed hover:text-default',
            ]"
          >
            <UIcon :name="item.icon" class="text-xl" />
            <span class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </template>
  </LayerAppShell>
</template>

<style scoped>
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
