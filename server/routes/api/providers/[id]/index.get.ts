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

  const provider = await providerService.getById(id)

  if (!provider) {
    throw createError({
      statusCode: 404,
      message: 'Provider not found',
    })
  }

  return {
    id: provider.id,
    name: provider.name,
    displayName: provider.displayName,
    settings: provider.settings,
    isActive: provider.isActive,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }
})
