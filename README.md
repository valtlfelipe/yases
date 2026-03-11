<div align="center">

<h1 align="center">YASES — Yet Another SES Wrapper</h1>

A self-hosted email service built on AWS SES with a beautiful dashboard for managing identities, tracking deliveries, and handling bounces.

<img width="1210" height="784" alt="Image" src="https://github.com/user-attachments/assets/34a6973f-0d60-44b8-9eed-fa4af46b257d" />

<p align="center">
    <a href="https://github.com/valtlfelipe/yases/releases"><img src="https://img.shields.io/github/release/valtlfelipe/yases.svg" alt="GitHub Release" /></a>
    <a href="https://github.com/valtlfelipe/yases/blob/main/LICENSE"><img src="https://img.shields.io/github/license/valtlfelipe/yases.svg" alt="MIT License" /></a>
    <a href="https://github.com/valtlfelipe/yases/pkgs/container/yases"><img src="https://img.shields.io/badge/docker-available-blue?logo=docker" alt="Docker"/></a>
    <a href="https://github.com/sponsors/valtlfelipe"><img src="https://img.shields.io/badge/sponsor-❤-ff69b4" alt="Sponsor"/></a>
</p>


</div>

## Features

- **Send Emails** — Programmatic email sending via REST API or MCP
- **Domain Management** — Add and verify sending domains with automatic DKIM setup
- **Suppression List** — Automatic bounce and complaint handling
- **Real-time Analytics** — Track delivery, bounce, open, and click rates
- **Email Timeline** — View detailed status and events for each sent email

## Self-Hosted Deployment Guide

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/deployyases-yet-another-ses-wrapper?referralCode=ca9X8b&utm_medium=integration&utm_source=template&utm_campaign=generic)

### Prerequisites

- A server with a public HTTPS URL (required for AWS SNS webhooks)
- PostgreSQL database
- Redis/Valkey
- AWS account with production SES enabled

### Docker

Pull the image from GitHub Container Registry:

```bash
# Run the app
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e BETTER_AUTH_SECRET=xxx \
  -e BETTER_AUTH_URL=https://your-domain.com \
  -e TOKEN_SECRET=xxx \
  -e CREDENTIALS_ENCRYPTION_KEY=xxx \
  ghcr.io/valtlfelipe/yases:latest

# Run the worker (separate container)
docker run -d \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e BETTER_AUTH_SECRET=xxx \
  -e BETTER_AUTH_URL=https://your-domain.com \
  -e TOKEN_SECRET=xxx \
  -e CREDENTIALS_ENCRYPTION_KEY=xxx \
  ghcr.io/valtlfelipe/yases:latest bun server/workers/index.ts
```

### AWS IAM

Create this policy and attach them to your IAM user that will be used by YASES.

This is needed to setup SES sending and webhooks, as managing domains and sending email.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SESSetup",
            "Effect": "Allow",
            "Action": [
                "ses:CreateConfigurationSet",
                "ses:GetConfigurationSet",
                "ses:DeleteConfigurationSet",
                "ses:CreateConfigurationSetEventDestination",
                "ses:GetConfigurationSetEventDestinations",
                "ses:UpdateConfigurationSetEventDestination",
                "ses:CreateEmailIdentity",
                "ses:GetEmailIdentity",
                "ses:DeleteEmailIdentity",
                "ses:PutEmailIdentityDkimAttributes",
                "ses:PutEmailIdentityDkimSigningAttributes",
                "ses:PutEmailIdentityMailFromAttributes"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SNSSetup",
            "Effect": "Allow",
            "Action": [
                "sns:CreateTopic",
                "sns:GetTopicAttributes",
                "sns:SetTopicAttributes",
                "sns:Subscribe",
                "sns:ListSubscriptionsByTopic"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SESTenants",
            "Effect": "Allow",
            "Action": [
                "ses:CreateTenant",
                "ses:GetTenant",
                "ses:DeleteTenant",
                "ses:CreateTenantResourceAssociation",
                "ses:DeleteTenantResourceAssociation",
                "ses:GetReputationEntity"
            ],
            "Resource": "*"
        },
        {
            "Sid": "STSGetAccountId",
            "Effect": "Allow",
            "Action": [
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SESSendEmail",
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        }
    ]
}
```

### 3. Create Your Admin Account

Open your browser and navigate to `/signup` to create the first user. This user will have admin privileges and can access all features.

### 4. Configure AWS SES

Configure SES from the dashboard:

1. Open **Settings → Providers** and click **Add Provider**
2. Select **AWS SES**, add your AWS Access Key ID, Secret Access Key, and region
3. Test the connection, then click the setup action (**Configure webhooks**) for that provider
4. Enter your public host (for example `https://api.yourdomain.com`) and run **Setup Webhooks**
5. Go to **Settings → Domains** and add your sending domain
6. Copy the DNS records shown (DKIM, MAIL FROM, DMARC) to your DNS provider
7. After DNS propagation (can take up to 72 hours), click sync on the domain row to refresh verification status

Finally, request production access in AWS Console → SES → Account dashboard (if you're still in sandbox).

### 5. Generate an API Key

After creating your account:

1. Navigate to **Settings** in the dashboard
2. Click "Create API Key"
3. Copy the generated key — it will only be shown once

Use this key in the `x-api-key` header to authenticate API requests.

---

## API Reference

### Send Email

Send an email via the REST API.

**Endpoint:** `POST /api/emails/send`

**Authentication:** Pass your API key via the `x-api-key` header (recommended) or `Authorization: Bearer <key>` header.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient email address (e.g., `"User <user@example.com>"` or just `"user@example.com"`) |
| `from` | string | Yes | Sender email address (must be a verified identity, e.g., `"Sender <noreply@yourdomain.com>"`) |
| `subject` | string | Yes | Email subject line |
| `html` | string | Yes* | HTML email body (*required if `text` is not provided) |
| `text` | string | Yes* | Plain text email body (*required if `html` is not provided) |
| `replyTo` | string | No | Reply-to address |
| `type` | string | No | Email type: `"transactional"` (default) or `"marketing"` |

**Transactional vs Marketing emails:**

- `transactional` — password resets, receipts, notifications. Bypasses unsubscribe suppression; other suppression reasons (bounces, complaints) still block sending.
- `marketing` — newsletters, promotions. Respects all suppressions including unsubscribes. **Requires a `{{unsubscribeUrl}}` placeholder** in the `html` or `text` body — the server replaces it with a signed, one-click unsubscribe link before sending.

**Example — transactional:**

```bash
curl -X POST https://your-domain.com/api/emails/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "to": "recipient@example.com",
    "from": "Sender <noreply@yourdomain.com>",
    "subject": "Your receipt",
    "html": "<p>Thanks for your purchase!</p>",
    "text": "Thanks for your purchase!"
  }'
```

**Example — marketing:**

```bash
curl -X POST https://your-domain.com/api/emails/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "to": "recipient@example.com",
    "from": "Sender <noreply@yourdomain.com>",
    "subject": "This month'\''s newsletter",
    "type": "marketing",
    "html": "<p>Hello!</p><p><a href=\"{{unsubscribeUrl}}\">Unsubscribe</a></p>",
    "text": "Hello!\n\nUnsubscribe: {{unsubscribeUrl}}"
  }'
```

**Success Response (202 Accepted):**

```json
{
  "id": "cmq123abc456",
  "status": "queued"
}
```

When the recipient is suppressed, the email is recorded but not sent:

```json
{
  "id": "cmq123abc456",
  "status": "suppressed",
  "reason": "unsubscribed"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Validation failed` | Invalid request body |
| 400 | `UNVERIFIED_IDENTITY` | Sender domain is not verified in SES |
| 400 | `INVALID_EMAIL` | Recipient email is invalid or disposable |
| 400 | `MISSING_UNSUBSCRIBE_URL` | Marketing email is missing the `{{unsubscribeUrl}}` placeholder |
| 401 | `Invalid API key` | Missing or invalid API key |

---

## MCP Server

You can also send emails via the Model Context Protocol (MCP), allowing AI agents to send emails on your behalf.

### Configuration

Add the MCP server to your AI client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "yases-email": {
      "url": "https://your-domain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Replace `YOUR_API_KEY` with an API key from **Settings → API Keys**.

### Available Tools

#### `send_email`

Send an email to a recipient.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient email address |
| `from` | string | Yes | Sender email address (must be a verified identity) |
| `subject` | string | Yes | Email subject line |
| `html` | string | Yes* | HTML email body (*required if `text` is not provided) |
| `text` | string | Yes* | Plain text email body (*required if `html` is not provided) |
| `replyTo` | string | No | Reply-to address |
| `type` | string | No | `"transactional"` (default) or `"marketing"` |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
