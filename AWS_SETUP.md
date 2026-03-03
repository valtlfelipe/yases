# AWS SES Setup Guide

## Prerequisites

- An AWS account
- An IAM user with programmatic access (access key + secret)
- A domain you control (for sending)
- Your service running at a publicly reachable HTTPS URL (for SNS webhook)

---

## IAM Policies

Create these policies and attach them to your IAM user.

### Policy

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

> `sts:GetCallerIdentity` is used to resolve the AWS account ID automatically when building identity ARNs for tenant resource associations. The result is cached in memory so it's only called once per server process.

---

## Setup steps

### 1. Configure your `.env`

```bash
cp .env.example apps/server/.env
```

Fill in at minimum:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxx
DATABASE_URL=postgres://email:email@postgres:5432/email_service
```

### 2. Run the AWS infrastructure setup

Your server must be deployed and reachable before this step so that SNS can confirm the subscription automatically.

```bash
bun run setup:aws --webhook-url https://api.yourdomain.com/webhooks/ses
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--webhook-url` | *(required)* | Public HTTPS URL of your `/webhooks/ses` endpoint |
| `--config-set` | `email-service` | SES configuration set name |
| `--topic-name` | `email-service-notifications` | SNS topic name |

The script is idempotent — safe to run multiple times.

At the end it prints the env var to add:

```
SES_CONFIGURATION_SET=email-service
```

Add it to your `.env` and restart the server.

### 3. Add your sending domain

```bash
bun run add:identity yourdomain.com
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--mail-from` | `mail` | Subdomain for MAIL FROM (e.g. `mail` → `mail.yourdomain.com`) |
| `--check` | — | Check current verification status without making changes |

The script outputs all DNS records you need to add.

### 4. Add DNS records

The script outputs three groups of records:

**DKIM** (3 CNAME records — all required for email authentication):

```
abc123._domainkey.yourdomain.com  CNAME  abc123.dkim.amazonses.com
def456._domainkey.yourdomain.com  CNAME  def456.dkim.amazonses.com
ghi789._domainkey.yourdomain.com  CNAME  ghi789.dkim.amazonses.com
```

**MAIL FROM** (custom bounce domain):

```
mail.yourdomain.com  MX   10 feedback-smtp.us-east-1.amazonses.com
mail.yourdomain.com  TXT  "v=spf1 include:amazonses.com ~all"
```

**DMARC** (recommended — adjust the `rua` address):

```
_dmarc.yourdomain.com  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

### 5. Check verification status

DKIM verification typically completes within 72 hours of DNS propagation.

```bash
bun run add:identity yourdomain.com --check
```

The command also syncs the status from SES back into the database.

---

## How bounce/complaint handling works

```
SES sends email
  └─▶ Bounce or complaint occurs
        └─▶ SES publishes event to SNS topic
              └─▶ SNS calls POST /webhooks/ses
                    └─▶ Server adds address to suppression_list
                          └─▶ Future sends to that address return 400 SUPPRESSED
```

The `/webhooks/ses` endpoint handles four SNS message types:

| Type | Action |
|------|--------|
| `SubscriptionConfirmation` | Auto-confirms the SNS subscription |
| `Bounce` (permanent) | Adds to suppression list as `permanent_bounce` |
| `Bounce` (transient) | Adds to suppression list as `transient_bounce` |
| `Complaint` | Adds to suppression list as `complaint` |
| `Delivery` | Records event in `email_events` only |

---

## SES sandbox vs production

New AWS accounts start in the **SES sandbox**. In sandbox mode:

- You can only send to verified email addresses
- Sending limits are very low

To request production access, go to **AWS Console → SES → Account dashboard → Request production access**.
