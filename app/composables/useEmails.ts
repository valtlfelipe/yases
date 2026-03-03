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
  sesMessageId: string | null
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

export function useEmails(page: Ref<number> = ref(1), limit = 20) {
  const { data, pending, error, refresh } = useFetch<EmailListResponse>('/api/emails', {
    credentials: 'include',
    query: { page, limit },
    key: () => `emails-${page.value}`,
    watch: [page],
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
