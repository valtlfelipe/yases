export function useStats() {
  const { data, pending, error, refresh } = useFetch('/api/stats', {
    credentials: 'include',
  })

  return { stats: data, pending, error, refresh }
}
