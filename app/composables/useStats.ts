interface StatsResponse {
  sends: {
    total: number
    queued: number
    sending: number
    sent: number
    failed: number
    suppressed: number
    bounced: number
    delivered: number
    opened: number
    complained: number
  }
  events: {
    delivered: number
    bounced: number
    complained: number
    opened: number
    clicked: number
  }
  rates: {
    delivery: number
    bounce: number
    complaint: number
    open: number
    click: number
  }
  deliveredCount: number
  suppressions: number
  trend: Array<{
    date: string
    total: number
    sent: number
    delivered: number
    bounced: number
    opened: number
    failed: number
  }>
}

export function useStats() {
  const { data, pending, error, refresh } = useFetch<StatsResponse>('/api/stats', {
    credentials: 'include',
  })

  return { stats: data, pending, error, refresh }
}
