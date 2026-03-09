import type { IProvider, ProviderType, ProviderCredentials } from './types'
import { AWSProvider } from './aws'

export interface ProviderDefinition {
  type: ProviderType
  displayName: string
  aliases?: string[]
  create: () => IProvider
}

const providerRegistry = new Map<ProviderType, ProviderDefinition>()
const providerAliasRegistry = new Map<string, ProviderType>()

export function registerProvider(definition: ProviderDefinition): void {
  providerRegistry.set(definition.type, definition)

  providerAliasRegistry.set(definition.type, definition.type)
  for (const alias of definition.aliases ?? []) {
    providerAliasRegistry.set(alias, definition.type)
  }
}

registerProvider({
  type: 'aws',
  displayName: 'Amazon SES',
  aliases: ['ses'],
  create: () => new AWSProvider(),
})

export function resolveProviderType(value: string | null | undefined): ProviderType | null {
  if (!value) {
    return null
  }
  return providerAliasRegistry.get(value) ?? null
}

export function getProvider(type: ProviderType): IProvider {
  const definition = providerRegistry.get(type)
  if (!definition) {
    throw new Error(`Unknown provider type: ${type}`)
  }

  return definition.create()
}

export async function getProviderWithCredentials(type: ProviderType, credentials: ProviderCredentials): Promise<IProvider> {
  const provider = getProvider(type)
  if (provider.init) {
    await provider.init({ credentials })
  }
  return provider
}

export function getProviderTypes(): ProviderType[] {
  return Array.from(providerRegistry.keys())
}

export function getProviderDefinition(type: ProviderType): ProviderDefinition {
  const definition = providerRegistry.get(type)
  if (!definition) {
    throw new Error(`Unknown provider type: ${type}`)
  }
  return definition
}

export function getProviderDisplayName(type: ProviderType): string {
  return getProviderDefinition(type).displayName
}

export type { IProvider, ProviderType, ProviderCredentials }
export type {
  SendEmailParams,
  SendEmailResult,
  ProviderSetupResult,
  WebhookPayload,
  ProviderEvent,
  DomainSetupResult,
  DomainDnsRecords,
  DomainDnsRecord,
  DomainHealthResult,
  ProviderConfigSchema,
  ProviderCredentialField,
  ProviderInitParams,
} from './types'
