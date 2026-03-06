import { ProviderService } from '../../../services/ProviderService'
import { requireApiAuth } from '../../../utils/requireApiAuth'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const providers = await providerService.list()

  // Don't return credentials in list
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    isActive: p.isActive,
    settings: p.settings,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
})
