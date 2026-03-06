interface EmailSend {
  id: string
  to: string
  from: string
  subject: string
  htmlBody: string | null
  textBody: string | null
  replyTo: string | null
  status: string
  jobId: string | null
  providerMessageId: string | null
  attempts: number
  lastError: string | null
  createdAt: string
  updatedAt: string
  sentAt: string | null
  deliveredAt?: string
  timeline?: Array<{
    event: string
    occurredAt: string
    metadata: Record<string, unknown> | null
  }>
}

interface EmailListResponse {
  items: EmailSend[]
  total: number
  page: number
  limit: number
}

export interface EmailFilters {
  fromDomain?: string
  to?: string
  dateFrom?: string
  dateTo?: string
  status?: string
}

export function useEmails(page: Ref<number> = ref(1), limit = 20, filters: Ref<EmailFilters> = ref({})) {
  const query = computed(() => ({
    page: page.value,
    limit,
    ...(filters.value.fromDomain ? { fromDomain: filters.value.fromDomain } : {}),
    ...(filters.value.to ? { to: filters.value.to } : {}),
    ...(filters.value.dateFrom ? { dateFrom: filters.value.dateFrom } : {}),
    ...(filters.value.dateTo ? { dateTo: filters.value.dateTo } : {}),
    ...(filters.value.status ? { status: filters.value.status } : {}),
  }))

  const { data, pending, error, refresh } = useFetch<EmailListResponse>('/api/emails', {
    credentials: 'include',
    query,
    key: () => `emails-${JSON.stringify(query.value)}`,
    watch: [query],
  })

  return { emails: data, pending, error, refresh }
}

export function useEmail(id: string) {
  const { data, pending, error } = useFetch<EmailSend>(`/api/emails/${id}`, {
    credentials: 'include',
    key: () => `email-${id}`,
  })

  return { email: data, pending, error }
}
