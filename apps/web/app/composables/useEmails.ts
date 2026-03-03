export function useEmails(page: Ref<number> = ref(1), limit = 20) {
  const api = useApi()

  const { data, pending, error, refresh } = useAsyncData(
    () => `emails-${page.value}`,
    () =>
      api<{
        items: Array<{
          id: string
          to: string
          from: string
          subject: string
          status: string
          createdAt: string
          sentAt: string | null
        }>
        total: number
        page: number
        limit: number
      }>('/emails', { query: { page: page.value, limit } }),
    { watch: [page] }
  )

  return { emails: data, pending, error, refresh }
}

export function useEmail(id: string) {
  const api = useApi()

  const { data, pending, error } = useAsyncData(`email-${id}`, () =>
    api<{
      id: string
      to: string
      from: string
      subject: string
      status: string
      createdAt: string
      sentAt: string | null
      timeline: Array<{ event: string; occurredAt: string; metadata: Record<string, unknown> | null }>
    }>(`/emails/${id}`)
  )

  return { email: data, pending, error }
}
