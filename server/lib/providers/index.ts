import type { IProvider, ProviderType, ProviderCredentials } from './types'
import { AWSProvider } from './aws'

const providers: Partial<Record<ProviderType, new () => IProvider>> = {
  aws: AWSProvider,
  // sendgrid: SendGridProvider,
  // mailgun: MailgunProvider,
}

export function getProvider(type: ProviderType): IProvider {
  const ProviderClass = providers[type]
  if (!ProviderClass) {
    throw new Error(`Unknown provider type: ${type}`)
  }

  return new ProviderClass()
}

export function getProviderWithCredentials(type: ProviderType, credentials: ProviderCredentials): IProvider {
  const provider = getProvider(type)

  if (type === 'aws' && 'setCredentials' in provider) {
    (provider as AWSProvider).setCredentials(credentials)
  }

  return provider
}

export function getProviderTypes(): ProviderType[] {
  return Object.keys(providers) as ProviderType[]
}

export function getProviderDisplayName(type: ProviderType): string {
  return getProvider(type).displayName
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
} from './types'
