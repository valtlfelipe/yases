import { requireApiAuth } from '../../../utils/requireApiAuth'
import { sendEmail, SendEmailError, sendEmailSchema } from '../../../services/SendEmailService'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const body = await readBody(event)
  const parsed = sendEmailSchema.safeParse(body)

  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Validation failed', details: parsed.error.flatten() }
  }

  try {
    const result = await sendEmail(parsed.data)
    setResponseStatus(event, 202)
    return result
  }
  catch (error) {
    if (error instanceof SendEmailError) {
      setResponseStatus(event, error.statusCode)
      return { error: error.code, detail: error.message }
    }
    throw error
  }
})
