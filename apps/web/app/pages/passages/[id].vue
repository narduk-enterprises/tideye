<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const appName = config.public.appName || 'Tideye'
const id = route.params.id as string

useSeo({
  title: `${appName} — Voyage`,
  description: 'Opening voyage on the map.',
  ogImage: { title: 'Voyage', description: 'Opening voyage on the map.', icon: '⛵' },
})
useWebPageSchema({
  name: `${appName} — Voyage`,
  description: 'Opening voyage on the map.',
})

await navigateTo({ path: '/passages', query: { p: id } }, { replace: true })
</script>

<template>
  <div class="sr-only" aria-live="polite">Opening voyage…</div>
</template>
