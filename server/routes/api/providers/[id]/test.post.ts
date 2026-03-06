import { ProviderService } from '../../../../services/ProviderService'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID is required',
    })
  }

  const result = await providerService.testConnection(id)

  return result
})
