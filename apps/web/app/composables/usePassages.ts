import type { PassageDto, PassagePlacesResponse } from '~/types/passage'

export function usePassagesList() {
  const appFetch = useAppFetch()
  return useAsyncData('passages-list', () => appFetch<PassageDto[]>('/api/passages'))
}

export function usePassageById(id: Ref<string> | ComputedRef<string>) {
  const appFetch = useAppFetch()
  return useAsyncData(
    () => {
      const raw = toValue(id)
      return `passage-${raw || 'none'}`
    },
    () => {
      const raw = toValue(id)
      if (!raw) return Promise.resolve(null)
      return appFetch<PassageDto>(`/api/passages/${encodeURIComponent(raw)}`)
    },
    { watch: [id] },
  )
}

export function usePassagePlaces(passageId: Ref<string | null>) {
  const appFetch = useAppFetch()
  const places = ref<PassagePlacesResponse | null>(null)
  const placesPending = ref(false)
  const placesError = ref<string | null>(null)

  watch(
    passageId,
    async (id) => {
      places.value = null
      placesError.value = null
      if (!id) return
      placesPending.value = true
      try {
        places.value = await appFetch<PassagePlacesResponse>(
          `/api/passages/${encodeURIComponent(id)}/places`,
        )
      } catch (e) {
        placesError.value = e instanceof Error ? e.message : 'Failed to load places'
      } finally {
        placesPending.value = false
      }
    },
    { immediate: true },
  )

  return { places, placesPending, placesError }
}
