import { asc, eq, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { emailIdentities, providers } from '../db/schema'
import { encrypt, decrypt, type EncryptedData } from '../lib/providers/crypto'
import { getProviderWithCredentials, type IProvider, type ProviderCredentials, type ProviderType, type ProviderSetupResult, type DomainSetupResult } from '../lib/providers'
import type { AwsProviderSettings } from '../lib/providers/aws'

export interface CreateProviderInput {
  name: ProviderType
  displayName: string
  credentials: ProviderCredentials
  settings?: Record<string, unknown>
}

export interface UpdateProviderInput {
  credentials?: ProviderCredentials
  settings?: Record<string, unknown>
  isActive?: boolean
}

export interface ProviderWithCredentials {
  id: string
  name: ProviderType
  displayName: string
  credentials: ProviderCredentials
  settings: Record<string, unknown>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class ProviderHasDomainsError extends Error {
  readonly code = 'PROVIDER_HAS_DOMAINS'

  constructor(readonly providerId: string, readonly domainCount: number) {
    super(`Cannot delete provider with ${domainCount} linked domain(s)`)
    this.name = 'ProviderHasDomainsError'
  }
}

export class ProviderLockedActiveError extends Error {
  readonly code = 'PROVIDER_LOCKED_ACTIVE'

  constructor(readonly providerId: string, readonly action: 'edit' | 'setup') {
    super(`Cannot ${action} an active provider`)
    this.name = 'ProviderLockedActiveError'
  }
}

export class ProviderService {
  async list(): Promise<ProviderWithCredentials[]> {
    const rows = await db.select().from(providers)

    return rows.map(row => ({
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: this.decryptCredentials(row.credentialsEncrypted as EncryptedData),
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  }

  async getById(id: string): Promise<ProviderWithCredentials | null> {
    const [row] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: this.decryptCredentials(row.credentialsEncrypted as EncryptedData),
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async getByName(name: ProviderType): Promise<ProviderWithCredentials | null> {
    const [row] = await db
      .select()
      .from(providers)
      .where(eq(providers.name, name))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: this.decryptCredentials(row.credentialsEncrypted as EncryptedData),
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async create(input: CreateProviderInput): Promise<ProviderWithCredentials> {
    const encrypted = encrypt(JSON.stringify(input.credentials))

    const rows = await db
      .insert(providers)
      .values({
        name: input.name,
        displayName: input.displayName,
        credentialsEncrypted: encrypted,
        settings: input.settings || {},
        isActive: false, // Not active until setup is complete
      })
      .returning()

    const row = rows[0]
    if (!row) {
      throw new Error('Failed to create provider')
    }

    return {
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: input.credentials,
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async update(id: string, input: UpdateProviderInput): Promise<ProviderWithCredentials | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    if (existing.isActive) {
      throw new ProviderLockedActiveError(id, 'edit')
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (input.credentials !== undefined) {
      updates.credentialsEncrypted = encrypt(JSON.stringify(input.credentials))
    }

    if (input.settings !== undefined) {
      updates.settings = input.settings
    }

    if (input.isActive !== undefined) {
      updates.isActive = input.isActive
    }

    const rows = await db
      .update(providers)
      .set(updates)
      .where(eq(providers.id, id))
      .returning()

    const row = rows[0]
    if (!row) return null

    return {
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: input.credentials ?? existing.credentials,
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? existing.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async delete(id: string): Promise<boolean> {
    const provider = await this.getById(id)
    if (!provider) {
      return false
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailIdentities)
      .where(eq(emailIdentities.providerId, id))

    const domainCount = Number(row?.count ?? 0)
    if (domainCount > 0) {
      throw new ProviderHasDomainsError(id, domainCount)
    }

    const providerInstance = this.getInstanceWithConfig(provider)
    try {
      await providerInstance.teardownAccount()
    }
    finally {
      await providerInstance.destroy()
    }

    const result = await db
      .delete(providers)
      .where(eq(providers.id, id))
      .returning()

    return result.length > 0
  }

  async testConnection(id: string): Promise<{ success: boolean, message?: string }> {
    const provider = await this.getById(id)
    if (!provider) {
      return { success: false, message: 'Provider not found' }
    }

    const providerInstance = getProviderWithCredentials(provider.name, provider.credentials)
    return providerInstance.testConnection(provider.credentials)
  }

  async setupAccount(
    id: string,
    webhookUrl: string,
  ): Promise<ProviderSetupResult> {
    const provider = await this.getById(id)
    if (!provider) {
      return { success: false, details: { error: 'Provider not found' } }
    }

    if (provider.isActive) {
      throw new ProviderLockedActiveError(id, 'setup')
    }

    const providerInstance = getProviderWithCredentials(provider.name, provider.credentials)

    const result = await providerInstance.setupAccount({
      providerId: id,
      webhookUrl,
      credentials: provider.credentials,
    })

    // Save provider setup data, including the full webhook URL, and activate provider.
    if (result.success) {
      const newSettings = {
        ...provider.settings,
        ...(result.details || {}),
        webhookUrl,
      }
      await this.update(id, { settings: newSettings, isActive: true })
    }

    return result
  }

  async setupDomain(
    id: string,
    params: { domain: string, mailFromSubdomain: string },
  ): Promise<DomainSetupResult> {
    const providerInstance = await this.getInstanceById(id)

    return providerInstance.setupDomain({
      domain: params.domain,
      mailFromSubdomain: params.mailFromSubdomain,
    })
  }

  async deleteDomain(
    id: string | null | undefined,
    params: { domain: string, tenantName?: string | null },
  ): Promise<void> {
    const providerInstance = await this.getInstanceById(id)
    await providerInstance.deleteDomain(params)
  }

  async getInstanceById(id?: string | null): Promise<IProvider> {
    if (!id) {
      const defaultProvider = await this.getDefaultActiveProvider()
      if (!defaultProvider) {
        throw new Error('No active provider configured')
      }

      return this.getInstanceWithConfig(defaultProvider)
    }

    const provider = await this.getById(id)
    if (!provider) {
      throw new Error('Provider not found')
    }

    return this.getInstanceWithConfig(provider)
  }

  private async getDefaultActiveProvider(): Promise<ProviderWithCredentials | null> {
    const [row] = await db
      .select()
      .from(providers)
      .where(eq(providers.isActive, true))
      .orderBy(asc(providers.createdAt))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      name: row.name as ProviderType,
      displayName: row.displayName,
      credentials: this.decryptCredentials(row.credentialsEncrypted as EncryptedData),
      settings: row.settings as Record<string, unknown>,
      isActive: row.isActive ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private getInstanceWithConfig(provider: ProviderWithCredentials): IProvider {
    const providerInstance = getProviderWithCredentials(provider.name, provider.credentials)
    if (provider.name === 'aws' && 'setSettings' in providerInstance) {
      (providerInstance as unknown as { setSettings: (s: AwsProviderSettings) => void }).setSettings(provider.settings as AwsProviderSettings)
    }

    return providerInstance
  }

  private decryptCredentials(encrypted: EncryptedData): ProviderCredentials {
    const decrypted = decrypt(encrypted)
    return JSON.parse(decrypted) as ProviderCredentials
  }
}
