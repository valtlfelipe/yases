import { SuppressionService } from '../../services/SuppressionService'
import { verifyUnsubscribeToken } from '../../lib/unsubscribeToken'
import { env } from '../../lib/env'
import { db } from '../../db/index'
import { emailEvents, emailSends } from '../../db/schema'
import { eq } from 'drizzle-orm'

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

  if (result.emailSendId) {
    const [send] = await db.select({ sesMessageId: emailSends.sesMessageId }).from(emailSends).where(eq(emailSends.id, result.emailSendId)).limit(1)
    await db.insert(emailEvents).values({
      emailSendId: result.emailSendId,
      sesMessageId: send?.sesMessageId ?? null,
      eventType: 'unsubscribe',
      rawPayload: {},
      occurredAt: new Date(),
    })
  }

  return { success: true, email: result.email }
})
