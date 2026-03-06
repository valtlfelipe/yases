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
    credentials: provider.credentials, // Return credentials for client-side use
    settings: provider.settings,
    isActive: provider.isActive,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }
})
