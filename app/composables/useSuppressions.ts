export function useSuppressions(page: Ref<number> = ref(1), limit = 20) {
  const { data, pending, error, refresh } = useFetch('/api/suppressions', {
    credentials: 'include',
    query: { page, limit },
    key: () => `suppressions-${page.value}`,
    watch: [page],
  })

  return { suppressions: data, pending, error, refresh }
}
