import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { emailIdentities } from '../db/schema'
import type { SendEmailParams } from '../lib/providers'
import { ProviderService } from './ProviderService'

export interface SendEmailOptions extends SendEmailParams {
  providerId?: string
  tenantName?: string
}

const providerService = new ProviderService()

export class EmailService {
  async send(options: SendEmailOptions): Promise<{ providerMessageId: string }> {
    const provider = await this.getProviderForSending(options.providerId, options.from)

    const result = await provider.send({
      to: options.to,
      from: options.from,
      fromDomain: options.fromDomain,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      unsubscribeUrl: options.unsubscribeUrl,
    })

    return { providerMessageId: result.providerMessageId }
  }

  /**
   * Get the provider instance for sending an email.
   * Priority:
   * 1. Use explicitly provided providerId
   * 2. Look up provider from the identity (via domain)
   * 3. Fall back to default active provider
   */
  private async getProviderForSending(providerId?: string, from?: string) {
    // 1. Explicit provider ID
    if (providerId) {
      try {
        return await providerService.getInstanceById(providerId)
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
            return await providerService.getInstanceById(identity.providerId)
          }
          catch {
            // continue to default fallback
          }
        }
      }
    }

    // 3. Fall back to default active provider
    return providerService.getInstanceById(null)
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
