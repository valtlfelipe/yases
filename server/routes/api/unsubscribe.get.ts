import { SuppressionService } from '../../services/SuppressionService'
import { verifyUnsubscribeToken } from '../../lib/unsubscribeToken'
import { env } from '../../lib/env'

const suppressionService = new SuppressionService()

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing token' })
  }

  const result = verifyUnsubscribeToken(token, env.TOKEN_SECRET)

  if (!result) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired unsubscribe token' })
  }

  await suppressionService.add(result.email, 'unsubscribed', 'Unsubscribed via email link')

  return { success: true, email: result.email }
})
