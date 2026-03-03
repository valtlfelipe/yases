# YASES — Yet Another SES Wrapper

<div align="center">

A self-hosted email service built on AWS SES with a beautiful dashboard for managing identities, tracking deliveries, and handling bounces.

</div>

## Features

- **Send Emails** — Programmatic email sending via REST API
- **Domain Management** — Add and verify sending domains with automatic DKIM setup
- **Suppression List** — Automatic bounce and complaint handling
- **Real-time Analytics** — Track delivery, bounce, open, and click rates
- **Email Timeline** — View detailed status and events for each sent email
- **Multi-user Support** — Authentication with Better Auth

## Self-Hosted Deployment Guide

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/EcUyHt?referralCode=ca9X8b&utm_medium=integration&utm_source=template&utm_campaign=generic)

### Prerequisites

- A server with a public HTTPS URL (required for AWS SNS webhooks)
- PostgreSQL database
- Redis
- AWS account with SES configured

### 1. Configure Environment

Create the environment file for the server:

```bash
mkdir -p apps/server
cp .env.example apps/server/.env
```

Required environment variables in `apps/server/.env`:

```env
# Database (will be overridden by docker-compose)
DATABASE_URL=postgres://email:email@postgres:5432/email_service

# Redis (will be overridden by docker-compose)
REDIS_URL=redis://valkey:6379

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxx

# Auth
BETTER_AUTH_SECRET=your-32-character-secret-key-here
BETTER_AUTH_URL=https://your-domain.com
```

### 2. Start the Services

Start PostgreSQL, Redis, and the application using Docker Compose:

```bash
docker compose -f docker-compose.prod.yml up -d
```

This will start:
- PostgreSQL (database)
- Valkey (Redis replacement)
- App server
- Background worker

### 3. Create Your Admin Account

Open your browser and navigate to `/signup` to create the first user. This user will have admin privileges and can access all features.

Alternatively, use the CLI:

```bash
bun run create:admin admin@yourdomain.com mypassword123 "Admin User"
```

### 4. Configure AWS SES

Run the AWS infrastructure setup script. Your server must be deployed and publicly accessible before this step:

```bash
bun run setup:aws --webhook-url https://api.yourdomain.com/webhooks/ses
```

Add the resulting `SES_CONFIGURATION_SET` to your `apps/server/.env` file and restart the containers.

Next, add your sending domain:

```bash
bun run add:identity yourdomain.com
```

The script will output DNS records you need to add (DKIM, MAIL FROM, DMARC). After adding them to your DNS provider, check verification status:

```bash
bun run add:identity yourdomain.com --check
```

Finally, request production access in AWS Console → SES → Account dashboard (if you're still in sandbox).

See [AWS_SETUP.md](AWS_SETUP.md) for detailed AWS configuration instructions.

### 5. Generate an API Key

After creating your account:

1. Navigate to `/settings/api-keys` in the dashboard
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

**Example Request:**

```bash
curl -X POST https://your-domain.com/api/emails/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "to": "recipient@example.com",
    "from": "Sender <noreply@yourdomain.com>",
    "subject": "Hello from YASES",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>",
    "text": "Hello! This is a test email.",
    "replyTo": "support@yourdomain.com"
  }'
```

**Success Response (202 Accepted):**

```json
{
  "id": "cmq123abc456",
  "status": "queued"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Validation failed` | Invalid request body |
| 400 | `UNVERIFIED_IDENTITY` | Sender domain is not verified in SES |
| 400 | `INVALID_EMAIL` | Recipient email is invalid |
| 400 | `SUPPRESSED` | Recipient is on the suppression list |
| 401 | `Invalid API key` | Missing or invalid API key |

---

## Helper Scripts

These scripts help with AWS SES setup and administration.

### `bun run setup:aws`

Sets up AWS SES infrastructure (SNS topic, configuration set, webhook subscription).

```bash
bun run setup:aws --webhook-url https://api.yourdomain.com/webhooks/ses
```

| Flag | Default | Description |
|------|---------|-------------|
| `--webhook-url` | *(required)* | Public HTTPS URL of your `/webhooks/ses` endpoint |
| `--config-set` | `email-service` | SES configuration set name |
| `--topic-name` | `email-service-notifications` | SNS topic name |

### `bun run add:identity`

Adds or checks a sending domain identity in SES.

```bash
# Add a new domain
bun run add:identity yourdomain.com

# Add with custom MAIL FROM subdomain
bun run add:identity yourdomain.com --mail-from mail

# Check verification status (without making changes)
bun run add:identity yourdomain.com --check
```

| Flag | Default | Description |
|------|---------|-------------|
| `--mail-from` | `mail` | Subdomain for MAIL FROM (e.g. `mail` → `mail.yourdomain.com`) |
| `--check` | — | Check current verification status without making changes |

### `bun run create:admin`

Creates an admin user via CLI (alternative to using `/signup`).

```bash
bun run create:admin <email> <password> [name]
```

Example:
```bash
bun run create:admin admin@example.com mypassword123 "Admin User"
```

## License

MIT License — see [LICENSE](LICENSE) for details.
