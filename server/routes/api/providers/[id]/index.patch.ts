import { z } from 'zod'
import { ProviderLockedActiveError, ProviderService } from '../../../../services/ProviderService'
import type { ProviderCredentials } from '../../../../lib/providers'

const updateProviderSchema = z.object({
  credentials: z
    .object({
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      region: z.string().optional(),
      apiKey: z.string().optional(),
      mailgunApiKey: z.string().optional(),
      domain: z.string().optional(),
    })
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Provider ID is required',
    })
  }

  const body = await readBody(event)
  const parsed = updateProviderSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: parsed.error.flatten(),
    })
  }

  const existing = await providerService.getById(id)
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Provider not found',
    })
  }

  // If credentials are being updated, validate them first
  if (parsed.data.credentials) {
    const { getProvider } = await import('../../../../lib/providers')
    const providerInstance = getProvider(existing.name)
    const testResult = await providerInstance.testConnection(parsed.data.credentials as ProviderCredentials)

    if (!testResult.success) {
      throw createError({
        statusCode: 400,
        message: `Invalid credentials: ${testResult.message}`,
      })
    }
  }

  let updated = null
  try {
    updated = await providerService.update(id, {
      credentials: parsed.data.credentials as ProviderCredentials | undefined,
      settings: parsed.data.settings,
      isActive: parsed.data.isActive,
    })
  }
  catch (error) {
    if (error instanceof ProviderLockedActiveError) {
      throw createError({
        statusCode: 409,
        message: 'Active providers cannot be edited',
        data: {
          code: error.code,
        },
      })
    }
    throw error
  }

  if (!updated) {
    throw createError({
      statusCode: 404,
      message: 'Provider not found',
    })
  }

  return {
    id: updated.id,
    name: updated.name,
    displayName: updated.displayName,
    settings: updated.settings,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt,
  }
})
