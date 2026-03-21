import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

/**
 * Format seconds into "Xh Ym" format
 */
export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '0h 0m'
  }
  return (
    dayjs
      .duration(seconds, 'seconds')
      .format('H[h] m[m]')
      .replaceAll(/\b0[hms]\s*/g, '')
      .trim() || '0m'
  )
}

/**
 * Format seconds into "M:SS" format for media playback
 */
export function formatMediaTime(seconds: number | undefined | null): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '0:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format hours and minutes into "Xh Ym" format
 */
export function formatHoursMinutes(hours: number, minutes: number): string {
  return (
    dayjs
      .duration({ hours, minutes })
      .format('H[h] m[m]')
      .replaceAll(/\b0[hms]\s*/g, '')
      .trim() || '0m'
  )
}
