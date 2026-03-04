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

export interface SuppressionFilters {
  email?: string
  reason?: string
}

export function useSuppressions(
  page: Ref<number> = ref(1),
  limit = 20,
  filters: Ref<SuppressionFilters> = ref({}),
) {
  const { data, pending, error, refresh } = useFetch<SuppressionListResponse>('/api/suppressions', {
    credentials: 'include',
    query: computed(() => ({
      page: page.value,
      limit,
      ...(filters.value.email ? { email: filters.value.email } : {}),
      ...(filters.value.reason ? { reason: filters.value.reason } : {}),
    })),
    key: () => `suppressions-${page.value}-${filters.value.email ?? ''}-${filters.value.reason ?? ''}`,
    watch: [page, filters],
  })

  return { suppressions: data, pending, error, refresh }
}
