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

export class AWSProvider implements IProvider {
  readonly type = 'aws' as const
  readonly displayName = 'Amazon SES'

  private credentials: ProviderCredentials | null = null
  private settings: AwsProviderSettings = {}
  private providerId: string | null = null

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

  parseWebhook(body: unknown): WebhookPayload {
    return parseAwsWebhook(body)
  }

  async destroy(): Promise<void> {
    this.credentials = null
    this.settings = {}
    this.providerId = null
  }

  setCredentials(credentials: ProviderCredentials): void {
    this.credentials = credentials
  }

  setSettings(settings: AwsProviderSettings): void {
    this.settings = settings
  }

  getSettings(): AwsProviderSettings {
    return this.settings
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
