// @ts-nocheck -- Ported from tideye-dashboard, to be migrated incrementally
export function useWidgetTouch() {
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const touchStartTime = ref(0)
  let touchTimeout: number | null = null

  const handleTouchStart = (event: TouchEvent) => {
    if (touchTimeout) {
      window.clearTimeout(touchTimeout)
      touchTimeout = null
    }

    touchStartX.value = event.touches[0].clientX
    touchStartY.value = event.touches[0].clientY
    touchStartTime.value = Date.now()
  }

  const handleTouchEnd = (callback: () => void) => (event: TouchEvent) => {
    const touchEndX = event.changedTouches[0].clientX
    const touchEndY = event.changedTouches[0].clientY
    const touchDuration = Date.now() - touchStartTime.value

    if (touchTimeout) {
      window.clearTimeout(touchTimeout)
    }

    touchTimeout = window.setTimeout(() => {
      const deltaX = Math.abs(touchEndX - touchStartX.value)
      const deltaY = Math.abs(touchEndY - touchStartY.value)

      if (touchDuration < 300 && deltaX < 10 && deltaY < 10 && event.changedTouches.length === 1) {
        callback()
      }
    }, 50)
  }

  const cleanup = () => {
    if (touchTimeout) {
      window.clearTimeout(touchTimeout)
      touchTimeout = null
    }
  }

  return {
    handleTouchStart,
    handleTouchEnd,
    cleanup,
  }
}
