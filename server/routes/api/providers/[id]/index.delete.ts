import { ProviderHasDomainsError, ProviderService } from '../../../../services/ProviderService'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID is required',
    })
  }

  let deleted = false
  try {
    deleted = await providerService.delete(id)
  }
  catch (error) {
    if (error instanceof ProviderHasDomainsError) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Provider has linked domains',
        data: {
          code: error.code,
          domainCount: error.domainCount,
        },
      })
    }

    throw error
  }

  if (!deleted) {
    throw createError({
      statusCode: 404,
      message: 'Provider not found',
    })
  }

  return { success: true }
})
