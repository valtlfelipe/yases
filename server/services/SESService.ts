import {
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-sesv2'
import { sesv2 } from '../lib/sesv2'
import { env } from '../lib/env'

interface SendEmailParams {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  tenantName?: string
  unsubscribeUrl?: string
}

export class SESService {
  async send(params: SendEmailParams): Promise<{ sesMessageId: string }> {
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
      ...(env.SES_CONFIGURATION_SET && { ConfigurationSetName: env.SES_CONFIGURATION_SET }),
      ...(params.tenantName && { TenantName: params.tenantName }),
    }

    const result = await sesv2.send(new SendEmailCommand(input))

    if (!result.MessageId) {
      throw new Error('SES returned no MessageId')
    }

    return { sesMessageId: result.MessageId }
  }
}
