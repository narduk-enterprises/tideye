/**
 * Keeps the selected passage id in sync with `?p=` on `/passages` for deep links and refresh.
 */
export function usePassageQuerySelection() {
  const route = useRoute()
  const router = useRouter()

  const selectedPassageId = ref<string | null>(
    typeof route.query.p === 'string' ? route.query.p : null,
  )

  watch(
    () => route.query.p,
    (p) => {
      const id = typeof p === 'string' ? p : null
      if (selectedPassageId.value !== id) selectedPassageId.value = id
    },
  )

  watch(selectedPassageId, (id) => {
    const cur = typeof route.query.p === 'string' ? route.query.p : null
    if (cur === id) return
    router.replace({ path: '/passages', query: id ? { p: id } : {} })
  })

  return { selectedPassageId }
}
