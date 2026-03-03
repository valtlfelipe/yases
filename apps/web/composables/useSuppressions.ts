export function useSuppressions(page: Ref<number> = ref(1), limit = 20) {
  const api = useApi()

  const { data, pending, error, refresh } = useAsyncData(
    () => `suppressions-${page.value}`,
    () =>
      api<{
        items: Array<{
          id: string
          email: string
          reason: string
          detail: string | null
          createdAt: string
        }>
        total: number
        page: number
        limit: number
      }>('/suppressions', { query: { page: page.value, limit } }),
    { watch: [page] }
  )

  return { suppressions: data, pending, error, refresh }
}
