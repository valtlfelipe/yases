# Email Provider Abstraction Layer - Implementation Plan

## Overview

Add a pluggable provider architecture that supports multiple email providers (AWS SES, SendGrid, Mailgun) with a unified interface for sending email, handling webhooks, and managing provider credentials.

---

## 1. Database Schema Changes

### Schema Changes

```sql
-- Providers (AWS, SendGrid, Mailgun, etc.)
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'aws', 'sendgrid', 'mailgun'
  display_name VARCHAR(100) NOT NULL,
  credentials_encrypted JSONB NOT NULL, -- encrypted at rest
  settings JSONB DEFAULT '{}', -- provider-specific settings
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link existing identities to providers
ALTER TABLE email_identities ADD COLUMN provider_id UUID REFERENCES providers(id);
```

### Schema Changes Summary

| Table | Change |
|-------|--------|
| `providers` | NEW - store provider configs |
| `email_identities` | ADD `provider_id` FK (optional, defaults to system default provider) |

---

## 2. Core Abstraction Architecture

### Directory Structure

```
server/
├── lib/
│   ├── providers/
│   │   ├── index.ts           # Provider registry & factory
│   │   ├── types.ts           # Interface definitions
│   │   ├── crypto.ts          # Credential encryption/decryption
│   │   └── aws/
│   │       ├── index.ts       # AWS provider implementation
│   │       ├── credentials.ts # Credential validation
│   │       ├── setup.ts       # Account setup (SNS, config sets)
│   │       └── webhook.ts     # AWS-specific webhook handling
│   │   ├── sendgrid/                     # (future)
│   │   │   └── index.ts
│   │   └── mailgun/                      # (future)
│   │       └── index.ts
│   └── env.ts                 # Updated: add CREDENTIALS_ENCRYPTION_KEY
├── services/
│   ├── ProviderService.ts     # CRUD for providers
│   └── EmailService.ts        # Updated: routes to correct provider
```

### Interface Definition (`lib/providers/types.ts`)

```typescript
export type ProviderType = 'aws' | 'sendgrid' | 'mailgun'

export interface ProviderCredentials {
  // AWS
  accessKeyId?: string
  secretAccessKey?: string
  region?: string

  // SendGrid
  apiKey?: string

  // Mailgun
  apiKey?: string
  domain?: string
  region?: string // 'us' or 'eu'
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
  testConnection(credentials: ProviderCredentials): Promise<{ success: boolean; message?: string }>

  // Account setup (config sets, webhooks, etc.)
  setupAccount(params: {
    webhookUrl: string
    credentials: ProviderCredentials
    domain?: string
  }): Promise<ProviderSetupResult>

  // Sending
  send(params: SendEmailParams): Promise<SendEmailResult>

  // Domain management (via emailIdentities)
  verifyDomain(domain: string): Promise<{ status: string; details?: Record<string, unknown> }>
  getDomainStatus(domain: string): Promise<{ status: string; rawAttributes?: Record<string, unknown> }>

  // Webhook handling
  parseWebhook(body: unknown): WebhookPayload

  // Cleanup
  destroy(): Promise<void>
}
```

---

## 3. Provider Registry (`lib/providers/index.ts`)

```typescript
import type { IProvider, ProviderType } from './types'
import { AWSProvider } from './aws'
// import { SendGridProvider } from './sendgrid'
// import { MailgunProvider } from './mailgun'

const providers: Record<ProviderType, new () => IProvider> = {
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

export function getProviderTypes(): ProviderType[] {
  return Object.keys(providers) as ProviderType[]
}
```

---

## 4. AWS Provider Implementation

### `lib/providers/aws/index.ts`

```typescript
import type {
  IProvider,
  ProviderCredentials,
  SendEmailParams,
  SendEmailResult,
  ProviderSetupResult,
  WebhookPayload,
  ProviderEvent,
} from '../types'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { validateAwsCredentials, getAccountId } from './credentials'
import { setupAwsAccount } from './setup'
import { parseAwsWebhook } from './webhook'

export class AWSProvider implements IProvider {
  readonly type = 'aws' as const
  readonly displayName = 'Amazon SES'

  private client: SESv2Client | null = null
  private credentials: ProviderCredentials | null = null

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    return validateAwsCredentials(credentials)
  }

  async testConnection(credentials: ProviderCredentials): Promise<{ success: boolean; message?: string }> {
    try {
      const valid = await this.validateCredentials(credentials)
      if (!valid) {
        return { success: false, message: 'Invalid AWS credentials' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  }

  async setupAccount(params: {
    webhookUrl: string
    credentials: ProviderCredentials
    domain?: string
  }): Promise<ProviderSetupResult> {
    return setupAwsAccount(params)
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const client = this.getClient()
    // ... SES send implementation
  }

  async verifyDomain(domain: string): Promise<{ status: string; details?: Record<string, unknown> }> {
    // Use SES v2 API to create identity
  }

  async getDomainStatus(domain: string): Promise<{ status: string; rawAttributes?: Record<string, unknown> }> {
    // Get identity verification status
  }

  parseWebhook(body: unknown): WebhookPayload {
    return parseAwsWebhook(body)
  }

  async destroy(): Promise<void> {
    this.client = null
    this.credentials = null
  }

  private getClient(): SESv2Client {
    // Return client with credentials from provider or env
  }
}
```

### Credential Validation (`lib/providers/aws/credentials.ts`)

```typescript
import { SESv2Client, GetAccountCommand } from '@aws-sdk/client-sesv2'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import type { ProviderCredentials } from '../types'

export async function validateAwsCredentials(credentials: ProviderCredentials): Promise<boolean> {
  const { accessKeyId, secretAccessKey, region } = credentials

  if (!accessKeyId || !secretAccessKey || !region) {
    return false
  }

  const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  try {
    await client.send(new GetAccountCommand({}))
    return true
  } catch {
    return false
  }
}

export async function getAccountId(credentials: ProviderCredentials): Promise<string> {
  const { accessKeyId, secretAccessKey, region } = credentials

  const client = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const { Account } = await client.send(new GetCallerIdentityCommand({}))
  return Account!
}
```

### Account Setup (`lib/providers/aws/setup.ts`)

Based on your existing `scripts/setup-aws.ts`:

```typescript
import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  UpdateConfigurationSetEventDestinationCommand,
  GetConfigurationSetEventDestinationsCommand,
} from '@aws-sdk/client-sesv2'
import {
  SNSClient,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
} from '@aws-sdk/client-sns'
import type { ProviderCredentials, ProviderSetupResult } from '../types'

export async function setupAwsAccount(params: {
  webhookUrl: string
  credentials: ProviderCredentials
  domain?: string
}): Promise<ProviderSetupResult> {
  const { webhookUrl, credentials } = params
  const { accessKeyId, secretAccessKey, region } = credentials

  const sesClient = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const snsClient = new SNSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  // 1. Create SNS topic
  // 2. Set topic policy
  // 3. Create SES config set
  // 4. Create/update event destination
  // 5. Subscribe webhook

  return { success: true, details: { topicArn, configSetName } }
}
```

---

## 5. Credential Storage & Security

### Encryption

- Use AES-256-GCM encryption for stored credentials
- Key derived from `BETTER_AUTH_SECRET` or dedicated `CREDENTIALS_ENCRYPTION_KEY` env var
- Only store encrypted blob in `providers.credentials_encrypted`

```typescript
// lib/providers/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(data: string, key: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key.slice(0, 32), 'utf8'), iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  }
}

export function decrypt(encrypted: string, key: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(key.slice(0, 32), 'utf8'),
    Buffer.from(iv, 'hex')
  )

  decipher.setAuthTag(Buffer.from(tag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

---

## 6. Updated Email Service

```typescript
// services/EmailService.ts
import { getProvider } from '../lib/providers'
import type { IProvider } from '../lib/providers/types'

export class EmailService {
  async send(params: SendEmailParams & { providerId?: string }): Promise<{ messageId: string }> {
    const provider = await this.getProvider(params.providerId)
    const result = await provider.send(params)
    return { messageId: result.providerMessageId }
  }

  private async getProvider(providerId?: string): Promise<IProvider> {
    if (providerId) {
      const providerConfig = await db.query.providers.findFirst({
        where: eq(providers.id, providerId),
      })
      if (providerConfig) {
        return getProvider(providerConfig.name)
      }
    }
    // Fallback to default AWS provider
    return getProvider('aws')
  }
}
```

---

## 7. Webhook Router

```typescript
// routes/api/webhook/index.ts
import type { ProviderType } from '../../../lib/providers/types'

const providerWebhookHandlers: Record<ProviderType, (body: unknown) => Promise<void>> = {
  aws: handleAwsWebhook,
  sendgrid: handleSendGridWebhook,
  mailgun: handleMailgunWebhook,
}

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider') as ProviderType

  const handler = providerWebhookHandlers[provider]
  if (!handler) {
    throw createError({ statusCode: 400, message: `Unknown provider: ${provider}` })
  }

  const body = await readBody(event)
  await handler(body)
})
```

---

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List all providers |
| POST | `/api/providers` | Create a new provider |
| GET | `/api/providers/:id` | Get provider details |
| PATCH | `/api/providers/:id` | Update provider credentials |
| DELETE | `/api/providers/:id` | Delete a provider |
| POST | `/api/providers/:id/test` | Test provider connection |
| POST | `/api/providers/:id/setup` | Run provider account setup |
| POST | `/webhook/:provider` | Webhook endpoint per provider |

Note: Domains are managed via existing `/api/identities` endpoints - just add `provider_id` to the request.

---

## 9. Implementation Order

1. **Schema & Encryption** - Add `providers` table, encryption utilities, add `provider_id` to `emailIdentities`
2. **Provider Types** - Define interfaces in `lib/providers/types.ts`
3. **Provider Registry** - Create `lib/providers/index.ts`
4. **AWS Provider** - Implement AWS SES with full feature parity
5. **ProviderService** - CRUD operations for providers
6. **Webhook Router** - Route webhooks to correct provider
7. **EmailService Update** - Route emails through providers
8. **API Endpoints** - Full REST API for provider management

---

## 10. Environment Variables

```bash
# Existing (used as default/fallback)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# New (optional, for credential encryption)
CREDENTIALS_ENCRYPTION_KEY=
```

---

## Future: Adding SendGrid

```typescript
// lib/providers/sendgrid/index.ts
import type { IProvider } from '../types'
import sgMail from '@sendgrid/mail'

export class SendGridProvider implements IProvider {
  readonly type = 'sendgrid' as const
  readonly displayName = 'SendGrid'

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    const { apiKey } = credentials
    if (!apiKey) return false

    sgMail.setApiKey(apiKey)
    // Try to get client info to validate
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    // Use @sendgrid/mail to send
  }

  parseWebhook(body: unknown): WebhookPayload {
    // Parse SendGrid event webhook
  }
}
```
