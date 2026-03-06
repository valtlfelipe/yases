import { ProviderService } from '../../../../services/ProviderService'
import { requireApiAuth } from '../../../../utils/requireApiAuth'

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

  const result = await providerService.testConnection(id)

  return result
})
