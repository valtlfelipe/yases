import { z } from 'zod'
import { ProviderLockedActiveError, ProviderService } from '../../../../services/ProviderService'
import { requireApiAuth } from '../../../../utils/requireApiAuth'

const setupSchema = z.object({
  webhookUrl: z.string().url(),
})

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID is required',
    })
  }

  const body = await readBody(event)
  const parsed = setupSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: parsed.error.flatten(),
    })
  }

  const { webhookUrl } = parsed.data

  let result
  try {
    result = await providerService.setupAccount(id, webhookUrl)
  }
  catch (error) {
    if (error instanceof ProviderLockedActiveError) {
      throw createError({
        statusCode: 409,
        message: 'Active providers cannot run setup again',
        data: {
          code: error.code,
        },
      })
    }
    throw error
  }

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Failed to setup provider account',
      data: result.details,
    })
  }

  return result
})
