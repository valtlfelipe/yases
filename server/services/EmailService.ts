import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { emailIdentities } from '../db/schema'
import type { ProviderType, SendEmailParams } from '../lib/providers'
import { ProviderService } from './ProviderService'

export interface SendEmailOptions extends SendEmailParams {
  providerId?: string
  tenantName?: string
}

export class ProviderSendError extends Error {
  readonly causeError: unknown
  readonly providerId: string
  readonly providerType: ProviderType
  readonly permanent: boolean

  constructor(params: {
    message: string
    causeError: unknown
    providerId: string
    providerType: ProviderType
    permanent: boolean
  }) {
    super(params.message)
    this.name = 'ProviderSendError'
    this.causeError = params.causeError
    this.providerId = params.providerId
    this.providerType = params.providerType
    this.permanent = params.permanent
  }
}

const providerService = new ProviderService()

export class EmailService {
  async send(options: SendEmailOptions): Promise<{ providerMessageId: string, providerId: string, providerType: ProviderType }> {
    const providerSelection = await this.getProviderForSending(options.providerId, options.from)

    let result: Awaited<ReturnType<typeof providerSelection.instance.send>>
    try {
      result = await providerSelection.instance.send({
        to: options.to,
        from: options.from,
        fromDomain: options.fromDomain,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        unsubscribeUrl: options.unsubscribeUrl,
      })
    }
    catch (error) {
      throw new ProviderSendError({
        message: (error as { message?: string })?.message ?? 'Provider send failed',
        causeError: error,
        providerId: providerSelection.providerId,
        providerType: providerSelection.providerType,
        permanent: providerSelection.instance.isPermanentError?.(error) ?? false,
      })
    }

    return {
      providerMessageId: result.providerMessageId,
      providerId: providerSelection.providerId,
      providerType: providerSelection.providerType,
    }
  }

  /**
   * Get the provider instance for sending an email.
   * Priority:
   * 1. Use explicitly provided providerId
   * 2. Look up provider from the identity (via domain)
   * 3. Fall back to default active provider
   */
  private async getProviderForSending(providerId?: string, from?: string): Promise<{
    instance: Awaited<ReturnType<ProviderService['getInstanceById']>>
    providerId: string
    providerType: ProviderType
  }> {
    // 1. Explicit provider ID
    if (providerId) {
      try {
        const provider = await providerService.getById(providerId)
        if (provider) {
          return {
            instance: await providerService.getInstanceById(providerId),
            providerId: provider.id,
            providerType: provider.name,
          }
        }
      }
      catch {
        // continue to identity/default fallback
      }
    }

    // 2. Look up from identity (via domain)
    if (from) {
      const domain = from.split('@')[1]
      if (domain) {
        const identity = await this.getIdentityByDomain(domain)
        if (identity?.providerId) {
          try {
            const provider = await providerService.getById(identity.providerId)
            if (provider) {
              return {
                instance: await providerService.getInstanceById(identity.providerId),
                providerId: provider.id,
                providerType: provider.name,
              }
            }
          }
          catch {
            // continue to default fallback
          }
        }
      }
    }

    // 3. Fall back to default active provider
    const defaultProvider = await providerService.getDefaultActiveProvider()
    if (!defaultProvider) {
      throw new Error('No active provider configured')
    }

    return {
      instance: await providerService.getInstanceById(defaultProvider.id),
      providerId: defaultProvider.id,
      providerType: defaultProvider.name,
    }
  }

  private async getIdentityByDomain(domain: string) {
    const [row] = await db
      .select({ providerId: emailIdentities.providerId })
      .from(emailIdentities)
      .where(eq(emailIdentities.domain, domain))
      .limit(1)

    return row ?? null
  }
}
