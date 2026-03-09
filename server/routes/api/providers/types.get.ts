import { getProvider, getProviderTypes } from '../../../lib/providers'
import { requireApiAuth } from '../../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  return getProviderTypes().map((type) => {
    const provider = getProvider(type)
    const schema = provider.getConfigSchema?.()
    return {
      type,
      displayName: schema?.displayName ?? provider.displayName,
      credentialFields: schema?.credentialFields ?? [],
    }
  })
})
