import { auth } from '../lib/auth'

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

export async function requireApiAuth(event: { headers: Headers }): Promise<Session> {
  const headers = event.headers

  let session: Session | null = await auth.api.getSession({ headers }).catch(() => null)

  if (!session) {
    const apiKey = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (apiKey) {
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
      if (!result.valid) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid API key',
        })
      }
      session = { user: result.key, session: null } as unknown as Session
    }
  }

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return session
}
