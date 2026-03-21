export function useMobileFeatures() {
  const isMobile = ref(false)
  const isIOS = ref(false)
  const isPWA = ref(false)
  const orientation = ref<'portrait' | 'landscape'>('portrait')
  const viewportHeight = ref(0)

  const checkMobile = () => {
    isMobile.value =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768
  }

  const checkIOS = () => {
    isIOS.value = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  const checkPWA = () => {
    isPWA.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
  }

  const checkOrientation = () => {
    orientation.value = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  }

  const updateViewportHeight = () => {
    viewportHeight.value = window.innerHeight
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
  }

  const handleResize = () => {
    checkMobile()
    checkOrientation()
    updateViewportHeight()
  }

  const handleOrientationChange = () => {
    setTimeout(() => {
      checkOrientation()
      updateViewportHeight()
    }, 100)
  }

  const preventZoom = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  }

  const preventDoubleTapZoom = (e: TouchEvent) => {
    const now = Date.now()

    const lastTouch = (preventDoubleTapZoom as any).lastTouch || 0
    const timeDiff = now - lastTouch

    if (timeDiff < 300 && timeDiff > 0) {
      e.preventDefault()
    }

    ;(preventDoubleTapZoom as any).lastTouch = now
  }

  onMounted(() => {
    checkMobile()
    checkIOS()
    checkPWA()
    checkOrientation()
    updateViewportHeight()

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)

    document.addEventListener('touchstart', preventDoubleTapZoom, { passive: false })
    document.addEventListener('touchmove', preventZoom, { passive: false })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleOrientationChange)
    document.removeEventListener('touchstart', preventDoubleTapZoom)
    document.removeEventListener('touchmove', preventZoom)
  })

  return {
    isMobile: computed(() => isMobile.value),
    isIOS: computed(() => isIOS.value),
    isPWA: computed(() => isPWA.value),
    orientation: computed(() => orientation.value),
    viewportHeight: computed(() => viewportHeight.value),
  }
}
