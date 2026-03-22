<script setup lang="ts">
const { appName } = usePageSeo(
  'Marine Telemetry Platform',
  'Real-time vessel monitoring, marine telemetry, and passage planning for your boat.',
)

const features = [
  {
    icon: 'i-lucide-gauge',
    title: 'Live Dashboard',
    description: 'Real-time widgets for battery, wind, depth, navigation, and 16+ more systems.',
  },
  {
    icon: 'i-lucide-waves',
    title: 'SignalK Integration',
    description:
      'Direct connection to your vessel via SignalK protocol with automatic local/remote failover.',
  },
  {
    icon: 'i-lucide-route',
    title: 'Voyages',
    description: 'Review voyages from your track history with maps, distance, and route polylines.',
  },
  {
    icon: 'i-lucide-map',
    title: 'Marine Charts',
    description: 'Track your vessel position and visualize routes on interactive marine maps.',
  },
  {
    icon: 'i-lucide-battery-charging',
    title: 'Electrical Monitoring',
    description: 'Monitor battery banks, solar panels, inverters, and shore chargers in real-time.',
  },
  {
    icon: 'i-lucide-smartphone',
    title: 'Mobile First',
    description:
      'Touch-optimized interface with PWA support — works offline on your phone or tablet.',
  },
]
</script>

<template>
  <UPage>
    <UPageHero
      :title="appName"
      description="Real-time vessel monitoring and marine telemetry platform."
      :ui="{ title: 'text-5xl sm:text-6xl', description: 'text-xl text-muted' }"
    >
      <template #links>
        <UButton
          to="/dashboard"
          label="Open Dashboard"
          icon="i-lucide-gauge"
          size="lg"
          color="primary"
        />
      </template>
    </UPageHero>

    <UPageGrid>
      <UPageCard
        v-for="feature in features"
        :key="feature.title"
        :icon="feature.icon"
        :title="feature.title"
        :description="feature.description"
      />
    </UPageGrid>

    <UPageSection :ui="{ wrapper: 'py-16 sm:py-24 text-center' }">
      <p class="text-lg text-muted mb-2">Your vessel, always in sight.</p>
      <p class="text-sm text-dimmed">Powered by Nuxt 4, SignalK &amp; Cloudflare Workers</p>
    </UPageSection>
  </UPage>
</template>
