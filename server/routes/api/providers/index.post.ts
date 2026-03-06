import { z } from 'zod'
import { ProviderService } from '../../../services/ProviderService'
import type { ProviderType, ProviderCredentials } from '../../../lib/providers'
import { requireApiAuth } from '../../../utils/requireApiAuth'

const createProviderSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  credentials: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    region: z.string().optional(),
    apiKey: z.string().optional(),
    mailgunApiKey: z.string().optional(),
    domain: z.string().optional(),
  }),
  settings: z.record(z.string(), z.unknown()).optional(),
})

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const body = await readBody(event)
  const parsed = createProviderSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: parsed.error.flatten(),
    })
  }

  const { name, displayName, credentials, settings } = parsed.data

  // Validate credentials before saving
  const { getProvider, getProviderTypes } = await import('../../../lib/providers')
  const supportedProviders = getProviderTypes()

  if (!supportedProviders.includes(name as ProviderType)) {
    throw createError({
      statusCode: 400,
      message: `Unsupported provider type: ${name}`,
      data: { supportedProviders },
    })
  }

  const providerInstance = getProvider(name as ProviderType)
  const testResult = await providerInstance.testConnection(credentials as ProviderCredentials)

  if (!testResult.success) {
    throw createError({
      statusCode: 400,
      message: `Invalid credentials: ${testResult.message}`,
    })
  }

  const provider = await providerService.create({
    name: name as ProviderType,
    displayName,
    credentials: credentials as ProviderCredentials,
    settings,
  })

  return {
    id: provider.id,
    name: provider.name,
    displayName: provider.displayName,
    isActive: provider.isActive,
    settings: provider.settings,
    createdAt: provider.createdAt,
  }
})
