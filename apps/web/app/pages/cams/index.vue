<script setup lang="ts">
/**
 * Embedded camera WebRTC players (hosted go2rtc pages — avoids duplicating WHEP/WebRTC wiring).
 * Uses UTabs with localStorage persistence so the selected tab survives navigation.
 */
definePageMeta({ keepalive: true })

type CamTabItem = {
  label: string
  icon: string
  value: string
  slot: string
}

const config = useRuntimeConfig()
const appName = config.public.appName || 'Tideye'

const STORAGE_KEY = 'tideye:cams-tab'

const items: CamTabItem[] = [
  { label: 'MastCam', icon: 'i-lucide-video', value: 'mastcam', slot: 'mastcam' },
  { label: 'MFD', icon: 'i-lucide-monitor', value: 'mfd', slot: 'mfd' },
]

const streamUrls: Record<string, string> = {
  mastcam: 'https://mastcam.tideye.com/stream.html?src=MastCam&mode=webrtc',
  mfd: 'https://mfd.tideye.com/stream.html?src=MFD&mode=webrtc',
}

const activeTab = ref('mastcam')

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && streamUrls[saved]) {
    activeTab.value = saved
  }
})

watch(activeTab, (val) => {
  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, val)
  }
})

useSeo({
  title: `${appName} — Cameras`,
  description: 'Live camera streams (WebRTC).',
})
useWebPageSchema({
  name: `${appName} — Cameras`,
  description: 'Live camera streams (WebRTC).',
})
</script>

<template>
  <div class="cams-page">
    <div class="page-header">
      <h1 class="page-title flex items-center gap-2 font-display text-2xl font-bold text-default">
        <UIcon name="i-lucide-video" class="text-primary" />
        Cameras
      </h1>
      <p class="page-subtitle mt-1 text-sm text-muted">{{ items.length }} live streams</p>
    </div>

    <UTabs v-model="activeTab" :items="items" :unmount-on-hide="false" class="w-full">
      <template #mastcam>
        <div class="stream-shell card-base border border-default overflow-hidden mt-4">
          <!-- eslint-disable-next-line atx/no-native-layout -- iframe is the standard embed surface for third-party players -->
          <iframe
            :src="streamUrls.mastcam"
            title="MastCam live stream"
            class="stream-iframe bg-muted"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
      </template>

      <template #mfd>
        <div class="stream-shell card-base border border-default overflow-hidden mt-4">
          <!-- eslint-disable-next-line atx/no-native-layout -- iframe is the standard embed surface for third-party players -->
          <iframe
            :src="streamUrls.mfd"
            title="MFD live stream"
            class="stream-iframe bg-muted"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
      </template>
    </UTabs>
  </div>
</template>

<style scoped>
.cams-page {
  min-height: calc(100vh - 4rem);
  padding: 1.5rem;
  padding-bottom: calc(env(safe-area-inset-bottom) + 120px);
  max-width: 72rem;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.25rem;
}

.stream-shell {
  aspect-ratio: 16 / 9;
  max-height: min(70vh, 900px);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.stream-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
}
</style>
