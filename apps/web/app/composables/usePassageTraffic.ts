import type { PassageAisTrafficRow } from '~/types/passageTraffic'

export function usePassageTrafficList(passageId: Ref<string | null | undefined>) {
  const appFetch = useAppFetch()

  return useAsyncData(
    'passage-ais-traffic',
    async () => {
      const id = toValue(passageId)
      if (!id) return [] as PassageAisTrafficRow[]
      return await appFetch<PassageAisTrafficRow[]>(`/api/passages/${id}/traffic`)
    },
    { watch: [passageId] },
  )
}
