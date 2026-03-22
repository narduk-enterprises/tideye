import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  passageCoordSubtext,
  passageDisplayTitle,
  passageRouteHeadline,
  formatCoordCompact,
} from '~/utils/passageDisplayTitle'

dayjs.extend(utc)

export function usePassageFormat() {
  function formatRange(startIso: string, endIso: string) {
    const a = dayjs.utc(startIso)
    const b = dayjs.utc(endIso)
    if (a.isSame(b, 'day')) return a.format('MMM D, YYYY')
    return `${a.format('MMM D, YYYY')} — ${b.format('MMM D, YYYY')}`
  }

  function durationDays(startIso: string, endIso: string) {
    const a = dayjs.utc(startIso).startOf('day')
    const b = dayjs.utc(endIso).startOf('day')
    return Math.max(1, b.diff(a, 'day') + 1)
  }

  function formatCoord(lat: number, lon: number) {
    const ns = lat >= 0 ? 'N' : 'S'
    const ew = lon >= 0 ? 'E' : 'W'
    return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`
  }

  function appleMapsUrl(lat: number, lon: number, label?: string) {
    const q = label ? `q=${encodeURIComponent(label)}&` : ''
    return `https://maps.apple.com/?${q}ll=${lat},${lon}`
  }

  return {
    formatRange,
    durationDays,
    formatCoord,
    appleMapsUrl,
    passageDisplayTitle,
    passageRouteHeadline,
    passageCoordSubtext,
    formatCoordCompact,
  }
}
