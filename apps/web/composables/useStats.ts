export function useStats() {
  const api = useApi()

  const { data, pending, error, refresh } = useAsyncData('stats', () =>
    api<{
      sends: { total: number; queued: number; sending: number; sent: number; failed: number; suppressed: number }
      events: { delivered: number; bounced: number; complained: number; opened: number; clicked: number }
      rates: { delivery: number; bounce: number; open: number; click: number }
      suppressions: number
      trend: Array<{ date: string; total: number; sent: number; failed: number }>
    }>('/stats')
  )

  return { stats: data, pending, error, refresh }
}
