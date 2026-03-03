export function useEmails(page: Ref<number> = ref(1), limit = 20) {
  const { data, pending, error, refresh } = useFetch('/api/emails', {
    credentials: 'include',
    query: { page, limit },
    key: () => `emails-${page.value}`,
    watch: [page],
  })

  return { emails: data, pending, error, refresh }
}

export function useEmail(id: string) {
  const { data, pending, error } = useFetch(`/api/emails/${id}`, {
    credentials: 'include',
    key: () => `email-${id}`,
  })

  return { email: data, pending, error }
}
