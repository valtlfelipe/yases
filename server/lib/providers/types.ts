export type ProviderType = 'aws' | 'sendgrid' | 'mailgun'

export interface ProviderCredentials {
  // AWS
  accessKeyId?: string
  secretAccessKey?: string
  region?: string

  // SendGrid
  apiKey?: string

  // Mailgun
  mailgunApiKey?: string
  domain?: string
  mailgunRegion?: string // 'us' or 'eu'
}

export interface SendEmailParams {
  to: string
  from: string
  fromDomain?: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  unsubscribeUrl?: string
}

export interface SendEmailResult {
  providerMessageId: string
  providerStatus?: string
}

export interface ProviderSetupResult {
  success: boolean
  details?: Record<string, unknown>
}

export interface DomainDnsRecord {
  name: string
  type: string
  value: string
}

export interface DomainDnsRecords {
  dkim: DomainDnsRecord[]
  mailFrom: DomainDnsRecord[]
  dmarc: DomainDnsRecord[]
}

export interface DomainSetupResult {
  status: 'pending' | 'verified' | 'failed' | 'temporarily_failed'
  dkimTokens: string[]
  mailFromDomain: string
  tenantName: string
  rawAttributes: Record<string, unknown>
  dnsRecords: DomainDnsRecords
}

export interface DomainHealthResult {
  available: boolean
  sendingStatus?: string | null
  reputationImpact?: string | null
  providerManagedStatus?: string | null
  accountManagedStatus?: string | null
}

export interface WebhookPayload {
  provider: ProviderType
  rawBody: unknown
  events: ProviderEvent[]
}

export interface ProviderEvent {
  eventType: string
  messageId?: string
  recipient?: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface IProvider {
  readonly type: ProviderType
  readonly displayName: string

  // Credential management
  validateCredentials(credentials: ProviderCredentials): Promise<boolean>
  testConnection(credentials: ProviderCredentials): Promise<{ success: boolean, message?: string }>

  // Account setup (config sets, webhooks, etc.)
  setupAccount(params: {
    providerId: string
    webhookUrl: string
    credentials: ProviderCredentials
    domain?: string
  }): Promise<ProviderSetupResult>
  teardownAccount(): Promise<void>

  // Sending
  send(params: SendEmailParams): Promise<SendEmailResult>

  // Domain management (via emailIdentities)
  setupDomain(params: { domain: string, mailFromSubdomain: string }): Promise<DomainSetupResult>
  deleteDomain(params: { domain: string, tenantName?: string | null }): Promise<void>
  getDomainDns(params: { domain: string, dkimTokens?: string[] | null, mailFromDomain?: string | null }): Promise<DomainDnsRecords>
  getDomainHealth(tenantName: string): Promise<DomainHealthResult>
  verifyDomain(domain: string): Promise<{ status: string, details?: Record<string, unknown> }>
  getDomainStatus(domain: string): Promise<{ status: string, rawAttributes?: Record<string, unknown> }>

  // Webhook handling
  parseWebhook(body: unknown): WebhookPayload

  // Cleanup
  destroy(): Promise<void>
}
