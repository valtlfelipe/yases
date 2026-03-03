interface Suppression {
  id: string
  email: string
  reason: 'invalid' | 'complaint' | 'permanent_bounce' | 'transient_bounce' | 'manual'
  detail: string | null
  createdAt: string
  updatedAt: string
}

interface SuppressionListResponse {
  items: Suppression[]
  total: number
  page: number
  limit: number
}

export function useSuppressions(page: Ref<number> = ref(1), limit = 20) {
  const { data, pending, error, refresh } = useFetch<SuppressionListResponse>('/api/suppressions', {
    credentials: 'include',
    query: { page, limit },
    key: () => `suppressions-${page.value}`,
    watch: [page],
  })

  return { suppressions: data, pending, error, refresh }
}
