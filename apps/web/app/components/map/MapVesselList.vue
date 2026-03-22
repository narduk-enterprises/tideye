<script setup lang="ts">
/**
 * MapVesselList — Slide-out panel listing all visible AIS vessels sorted by distance.
 * Tap a row to pan + highlight that vessel on the map. Search by name.
 */
import {
  CATEGORIES,
  getShipCategoryKey,
  type ShipCategoryKey,
} from '~/composables/useAISOverlay'
import type { AISVessel } from '~/types/map'

const props = defineProps<{
  vessels: AISVessel[]
  selfLat: number | null
  selfLng: number | null
}>()

const emit = defineEmits<{
  close: []
  'select-vessel': [id: string]
}>()

const searchQuery = ref('')

function haversineNM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1852
}

function vesselDisplayName(v: AISVessel): string {
  if (v.name) return v.name
  if (v.mmsi) return `MMSI ${v.mmsi}`
  const mmsiMatch = v.id.match(/mmsi[-:]?(\d+)/)
  if (mmsiMatch) return `MMSI ${mmsiMatch[1]}`
  return v.id.substring(0, 16)
}

interface ListVessel {
  v: AISVessel
  name: string
  dist: number | null
  catKey: ShipCategoryKey
  catLabel: string
  catColor: string
}

const sortedVessels = computed<ListVessel[]>(() => {
  const list: ListVessel[] = props.vessels
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => {
      const catKey = getShipCategoryKey(v.shipType, v.sog)
      const cat = CATEGORIES[catKey]
      const name = vesselDisplayName(v)
      let dist: number | null = null
      if (props.selfLat != null && props.selfLng != null && v.lat != null && v.lng != null) {
        dist = haversineNM(props.selfLat, props.selfLng, v.lat, v.lng)
      }
      return { v, name, dist, catKey, catLabel: cat.label, catColor: cat.color }
    })

  // Filter by search
  const q = searchQuery.value.toLowerCase().trim()
  const filtered = q
    ? list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.catLabel.toLowerCase().includes(q) ||
          (item.v.mmsi && item.v.mmsi.includes(q)),
      )
    : list

  // Sort by distance (closest first), nulls last
  return filtered.sort((a, b) => {
    if (a.dist == null && b.dist == null) return 0
    if (a.dist == null) return 1
    if (b.dist == null) return -1
    return a.dist - b.dist
  })
})

function formatDist(d: number | null): string {
  if (d == null) return '—'
  return d < 1 ? `${(d * 2025.372).toFixed(0)} yd` : `${d.toFixed(1)} NM`
}
</script>

<template>
  <div class="vessel-list-sidebar">
    <div class="vessel-list-header">
      <span class="vessel-list-title">
        AIS Vessels ({{ sortedVessels.length }})
      </span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="emit('close')"
      />
    </div>

    <div class="vessel-list-search">
      <UInput
        v-model="searchQuery"
        placeholder="Search by name, type, or MMSI…"
        icon="i-lucide-search"
        size="sm"
        class="w-full"
      />
    </div>

    <div class="vessel-list-items">
      <div
        v-for="item in sortedVessels"
        :key="item.v.id"
        class="vessel-list-item"
        @click="emit('select-vessel', item.v.id)"
      >
        <span
          class="vessel-list-item-dot"
          :style="{ background: item.catColor }"
        />
        <span class="vessel-list-item-name">{{ item.name }}</span>
        <span
          class="vessel-list-item-type"
          :style="{ color: item.catColor, background: item.catColor + '15' }"
        >{{ item.catLabel }}</span>
        <span class="vessel-list-item-dist">{{ formatDist(item.dist) }}</span>
      </div>

      <div v-if="sortedVessels.length === 0" class="p-4 text-center text-muted text-sm">
        {{ searchQuery ? 'No vessels match your search.' : 'No AIS vessels in view.' }}
      </div>
    </div>
  </div>
</template>
