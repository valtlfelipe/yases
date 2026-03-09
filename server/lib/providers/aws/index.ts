import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteEmailIdentityCommand,
  DeleteTenantCommand,
  DeleteTenantResourceAssociationCommand,
  GetTenantCommand,
  GetReputationEntityCommand,
} from '@aws-sdk/client-sesv2'
import type {
  IProvider,
  ProviderInitParams,
  ProviderConfigSchema,
  ProviderCredentials,
  SendEmailParams,
  SendEmailResult,
  ProviderSetupResult,
  WebhookPayload,
  DomainSetupResult,
  DomainDnsRecords,
  DomainHealthResult,
} from '../types'
import { createSesClient, getAccountId, validateAwsCredentials } from './credentials'
import { setupAwsAccount, teardownAwsAccount } from './setup'
import { parseAwsWebhook } from './webhook'

export interface AwsProviderSettings {
  configSetName?: string
  topicArn?: string
}

type AwsCredentials = ProviderCredentials & {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

const PERMANENT_AWS_ERRORS = new Set([
  'MessageRejected',
  'InvalidParameterValue',
  'InvalidParameterCombination',
  'MailFromDomainNotVerified',
  'EmailAddressNotVerifiedException',
])

export class AWSProvider implements IProvider {
  readonly type = 'aws' as const
  readonly displayName = 'Amazon SES'

  private credentials: ProviderCredentials | null = null
  private settings: AwsProviderSettings = {}
  private providerId: string | null = null

  getConfigSchema(): ProviderConfigSchema {
    return {
      displayName: this.displayName,
      credentialFields: [
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true, placeholder: 'AKIAIOSFODNN7EXAMPLE' },
        { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, placeholder: '••••••••••••••••' },
        {
          key: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: [
            { label: 'US East (N. Virginia)', value: 'us-east-1' },
            { label: 'US East (Ohio)', value: 'us-east-2' },
            { label: 'US West (Oregon)', value: 'us-west-2' },
            { label: 'Europe (Ireland)', value: 'eu-west-1' },
            { label: 'Europe (Frankfurt)', value: 'eu-central-1' },
            { label: 'South America (Sao Paulo)', value: 'sa-east-1' },
          ],
        },
      ],
    }
  }

  init(params: ProviderInitParams): void {
    this.credentials = params.credentials
    this.providerId = params.providerId ?? null
    this.settings = (params.settings ?? {}) as AwsProviderSettings
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    return validateAwsCredentials(credentials)
  }

  async testConnection(credentials: ProviderCredentials): Promise<{ success: boolean, message?: string }> {
    try {
      const valid = await this.validateCredentials(credentials)
      if (!valid) {
        return { success: false, message: 'Invalid AWS credentials' }
      }
      return { success: true }
    }
    catch (err) {
      return { success: false, message: (err as Error).message }
    }
  }

  async setupAccount(params: {
    providerId: string
    webhookUrl: string
    credentials: ProviderCredentials
    domain?: string
  }): Promise<ProviderSetupResult> {
    const result = await setupAwsAccount({
      providerId: params.providerId,
      webhookUrl: params.webhookUrl,
      credentials: params.credentials,
    })

    // Store the settings for later use
    if (result.success && result.details) {
      this.providerId = params.providerId
      this.settings = {
        configSetName: result.details.configSetName as string,
        topicArn: result.details.topicArn as string,
      }
    }

    return result
  }

  async teardownAccount(): Promise<void> {
    if (!this.credentials) {
      return
    }

    await teardownAwsAccount({
      credentials: this.credentials,
      configSetName: this.settings.configSetName,
      topicArn: this.settings.topicArn,
    })
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const client = this.getClient()

    const configSetName = this.settings.configSetName

    const input: SendEmailCommandInput = {
      FromEmailAddress: params.from,
      Destination: { ToAddresses: [params.to] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: {
            ...(params.html && { Html: { Data: params.html, Charset: 'UTF-8' } }),
            ...(params.text && { Text: { Data: params.text, Charset: 'UTF-8' } }),
          },
          ...(params.unsubscribeUrl && {
            Headers: [
              { Name: 'List-Unsubscribe', Value: `<${params.unsubscribeUrl}>` },
              { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
            ],
          }),
        },
      },
      ...(params.replyTo && { ReplyToAddresses: [params.replyTo] }),
      ...(configSetName && { ConfigurationSetName: configSetName }),
    }

    const result = await client.send(new SendEmailCommand(input))

    if (!result.MessageId) {
      throw new Error('SES returned no MessageId')
    }

    return {
      providerMessageId: result.MessageId,
      providerStatus: 'sent',
    }
  }

  isPermanentError(error: unknown): boolean {
    const errorName = (error as { name?: string }).name
    return !!errorName && PERMANENT_AWS_ERRORS.has(errorName)
  }

  async setupDomain(params: { domain: string, mailFromSubdomain: string }): Promise<DomainSetupResult> {
    const client = this.getClient()
    const credentials = this.requireCredentials()
    const region = credentials.region
    const accountId = await getAccountId(credentials)
    const domain = params.domain
    const mailFromDomain = `${params.mailFromSubdomain}.${domain}`

    try {
      await client.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }))
    }
    catch (err) {
      if ((err as { name?: string }).name !== 'AlreadyExistsException') throw err
    }

    const identity = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }))
    const dkimTokens = identity.DkimAttributes?.Tokens ?? []
    const dkimStatus = identity.DkimAttributes?.Status ?? 'PENDING'

    await client.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: domain,
        MailFromDomain: mailFromDomain,
        BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
      }),
    )

    const tenantName = this.domainToTenantName(domain)
    try {
      await client.send(new CreateTenantCommand({ TenantName: tenantName }))
    }
    catch (err) {
      if ((err as { name?: string }).name !== 'AlreadyExistsException') throw err
    }

    await client.send(
      new CreateTenantResourceAssociationCommand({
        TenantName: tenantName,
        ResourceArn: this.identityArn(domain, region, accountId),
      }),
    ).catch((err: { name?: string }) => {
      if (err.name !== 'AlreadyExistsException') throw err
    })

    const configSetName = this.settings.configSetName
    if (configSetName) {
      await client.send(
        new CreateTenantResourceAssociationCommand({
          TenantName: tenantName,
          ResourceArn: this.configSetArn(configSetName, region, accountId),
        }),
      ).catch((err: { name?: string }) => {
        if (err.name !== 'AlreadyExistsException') throw err
      })
    }

    return {
      status: this.mapStatus(dkimStatus),
      dkimTokens,
      mailFromDomain,
      tenantName,
      rawAttributes: identity as unknown as Record<string, unknown>,
      dnsRecords: {
        dkim: dkimTokens.map(t => ({
          name: `${t}._domainkey.${domain}`,
          type: 'CNAME',
          value: `${t}.dkim.amazonses.com`,
        })),
        mailFrom: [
          { name: mailFromDomain, type: 'MX', value: `10 feedback-smtp.${region}.amazonses.com` },
          { name: mailFromDomain, type: 'TXT', value: 'v=spf1 include:amazonses.com ~all' },
        ],
        dmarc: [
          { name: `_dmarc.${domain}`, type: 'TXT', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
        ],
      },
    }
  }

  async getDomainDns(params: {
    domain: string
    dkimTokens?: string[] | null
    mailFromDomain?: string | null
  }): Promise<DomainDnsRecords> {
    const credentials = this.requireCredentials()
    const region = credentials.region
    const { domain, dkimTokens, mailFromDomain } = params

    return {
      dkim: (dkimTokens ?? []).map(t => ({
        name: `${t}._domainkey.${domain}`,
        type: 'CNAME',
        value: `${t}.dkim.amazonses.com`,
      })),
      mailFrom: mailFromDomain
        ? [
            { name: mailFromDomain, type: 'MX', value: `10 feedback-smtp.${region}.amazonses.com` },
            { name: mailFromDomain, type: 'TXT', value: 'v=spf1 include:amazonses.com ~all' },
          ]
        : [],
      dmarc: [
        { name: `_dmarc.${domain}`, type: 'TXT', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
      ],
    }
  }

  async deleteDomain(params: { domain: string, tenantName?: string | null }): Promise<void> {
    const client = this.getClient()
    const credentials = this.requireCredentials()
    const region = credentials.region
    const accountId = await getAccountId(credentials)

    const ignoreNotFound = (err: unknown) => {
      if ((err as { name?: string }).name !== 'NotFoundException') throw err
    }

    if (params.tenantName) {
      const configSetName = this.settings.configSetName
      if (configSetName) {
        await client.send(new DeleteTenantResourceAssociationCommand({
          TenantName: params.tenantName,
          ResourceArn: this.configSetArn(configSetName, region, accountId),
        })).catch(ignoreNotFound)
      }

      await client.send(new DeleteTenantResourceAssociationCommand({
        TenantName: params.tenantName,
        ResourceArn: this.identityArn(params.domain, region, accountId),
      })).catch(ignoreNotFound)

      await client.send(new DeleteTenantCommand({ TenantName: params.tenantName })).catch(ignoreNotFound)
    }

    await client.send(new DeleteEmailIdentityCommand({ EmailIdentity: params.domain })).catch(ignoreNotFound)
  }

  async getDomainHealth(tenantName: string): Promise<DomainHealthResult> {
    const client = this.getClient()
    const tenantRes = await client.send(new GetTenantCommand({ TenantName: tenantName }))
    const tenantArn = tenantRes.Tenant?.TenantArn

    if (!tenantArn) {
      return { available: false }
    }

    const repRes = await client.send(new GetReputationEntityCommand({
      ReputationEntityReference: tenantArn,
      ReputationEntityType: 'RESOURCE',
    }))

    const entity = repRes.ReputationEntity

    return {
      available: true,
      sendingStatus: entity?.SendingStatusAggregate ?? tenantRes.Tenant?.SendingStatus ?? 'ENABLED',
      reputationImpact: entity?.ReputationImpact ?? null,
      providerManagedStatus: entity?.AwsSesManagedStatus?.Status ?? null,
      accountManagedStatus: entity?.CustomerManagedStatus?.Status ?? null,
    }
  }

  async verifyDomain(domain: string): Promise<{ status: string, details?: Record<string, unknown> }> {
    const client = this.getClient()

    try {
      await client.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
        }),
      )
      return { status: 'pending', details: { domain } }
    }
    catch (err) {
      const error = err as { name?: string, message?: string }
      if (error.name === 'AlreadyExistsException') {
        return { status: 'verified', details: { domain } }
      }
      throw err
    }
  }

  async getDomainStatus(domain: string): Promise<{ status: string, rawAttributes?: Record<string, unknown> }> {
    const client = this.getClient()

    try {
      const result = await client.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain }),
      )

      const verificationStatus = result.VerificationStatus
      let status: string

      switch (verificationStatus) {
        case 'SUCCESS':
          status = 'verified'
          break
        case 'PENDING':
          status = 'pending'
          break
        case 'FAILED':
        case 'TEMPORARY_FAILURE':
          status = 'failed'
          break
        default:
          status = verificationStatus?.toLowerCase() || 'pending'
      }

      return {
        status,
        rawAttributes: {
          identityType: result.IdentityType,
          verificationStatus: result.VerificationStatus,
          dkimEnabled: result.DkimAttributes?.SigningEnabled ?? false,
          dkimTokens: result.DkimAttributes?.Tokens ?? [],
          mailFromDomain: result.MailFromAttributes?.MailFromDomain,
          mailFromDomainStatus: result.MailFromAttributes?.MailFromDomainStatus,
        },
      }
    }
    catch (err) {
      const error = err as { name?: string }
      if (error.name === 'NotFoundException') {
        return { status: 'pending' }
      }
      throw err
    }
  }

  async handleWebhookRequest(body: unknown): Promise<{ handled: boolean }> {
    const payload = body as Record<string, unknown>
    const messageType = payload['Type'] as string | undefined
    if (messageType !== 'SubscriptionConfirmation') {
      return { handled: false }
    }

    const subscribeUrl = payload['SubscribeURL'] as string | undefined
    if (!subscribeUrl) {
      return { handled: true }
    }

    let parsed: URL
    try {
      parsed = new URL(subscribeUrl)
    }
    catch {
      console.warn('[Webhook] SNS SubscriptionConfirmation has invalid SubscribeURL')
      return { handled: true }
    }

    const SNS_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com$/
    if (parsed.protocol !== 'https:' || !SNS_HOST_RE.test(parsed.hostname)) {
      console.warn(`[Webhook] SNS SubscriptionConfirmation rejected - disallowed host: ${parsed.hostname}`)
      return { handled: true }
    }

    try {
      const res = await fetch(subscribeUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      console.log('[Webhook] SNS subscription confirmed')
    }
    catch (err) {
      console.error('[Webhook] Failed to confirm SNS subscription:', (err as Error).message)
    }

    return { handled: true }
  }

  parseWebhook(body: unknown): WebhookPayload {
    return parseAwsWebhook(body)
  }

  async destroy(): Promise<void> {
    this.credentials = null
    this.settings = {}
    this.providerId = null
  }

  private getClient(): SESv2Client {
    return createSesClient(this.requireCredentials())
  }

  private domainToTenantName(domain: string): string {
    return domain.replace(/\./g, '-')
  }

  private mapStatus(
    sesStatus: string | undefined,
  ): 'pending' | 'verified' | 'failed' | 'temporarily_failed' {
    switch (sesStatus) {
      case 'SUCCESS': return 'verified'
      case 'FAILED': return 'failed'
      case 'TEMPORARY_FAILURE': return 'temporarily_failed'
      default: return 'pending'
    }
  }

  private identityArn(domain: string, region: string, accountId: string): string {
    return `arn:aws:ses:${region}:${accountId}:identity/${domain}`
  }

  private configSetArn(name: string, region: string, accountId: string): string {
    return `arn:aws:ses:${region}:${accountId}:configuration-set/${name}`
  }

  private requireCredentials(): AwsCredentials {
    const credentials = this.credentials
    if (!credentials) {
      throw new Error('Provider credentials are required')
    }

    if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.region) {
      throw new Error('Missing AWS credentials')
    }

    return credentials as AwsCredentials
  }
}
