<script setup lang="ts">
/**
 * Embedded MastCam WebRTC player (hosted player page — avoids duplicating WHEP/WebRTC wiring).
 */
definePageMeta({ keepalive: true })

const config = useRuntimeConfig()
const appName = config.public.appName || 'TideEye'

const mastcamStreamUrl = 'https://mastcam.tideye.com/stream.html?src=MastCam&mode=webrtc'

useSeo({
  title: `${appName} — Cameras`,
  description: 'Live mast camera stream (WebRTC).',
})
useWebPageSchema({
  name: `${appName} — Cameras`,
  description: 'Live mast camera stream (WebRTC).',
})
</script>

<template>
  <div class="cams-page">
    <div class="page-header">
      <h1 class="page-title flex items-center gap-2 font-display text-2xl font-bold text-default">
        <UIcon name="i-lucide-video" class="text-primary" />
        Cameras
      </h1>
      <p class="page-subtitle mt-1 text-sm text-muted">MastCam — live stream</p>
    </div>

    <div class="stream-shell card-base border border-default overflow-hidden">
      <!-- eslint-disable-next-line atx/no-native-layout -- iframe is the standard embed surface for third-party players -->
      <iframe
        :src="mastcamStreamUrl"
        title="MastCam live stream"
        class="stream-iframe bg-muted"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </div>
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
  margin: 0 auto;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.stream-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
