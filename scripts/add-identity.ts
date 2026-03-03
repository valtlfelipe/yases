#!/usr/bin/env bun
/**
 * Add or check a sending domain identity in SES.
 * Stores DKIM tokens and verification status in the database.
 *
 * Usage:
 *   bun run add:identity example.com
 *   bun run add:identity example.com --mail-from mail
 *   bun run add:identity example.com --check
 */

import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from '@aws-sdk/client-sesv2'
import type { GetEmailIdentityCommandOutput as _GetEmailIdentityCommandOutput } from '@aws-sdk/client-sesv2'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq } from 'drizzle-orm'
import { emailIdentities } from '../src/db/schema.js'

// ── helpers ────────────────────────────────────────────────────────────────

const ok = (s: string) => console.log(`\x1b[32m✓\x1b[0m  ${s}`)
const info = (s: string) => console.log(`\x1b[36m→\x1b[0m  ${s}`)
const warn = (s: string) => console.log(`\x1b[33m⚠\x1b[0m  ${s}`)
const fail = (s: string) => {
  console.error(`\x1b[31m✗\x1b[0m  ${s}`)
  process.exit(1)
}

function getFlag(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const idx = argv.indexOf(`--${name}`)
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1]
  const prefixed = argv.find(a => a.startsWith(`--${name}=`))
  return prefixed?.split('=').slice(1).join('=')
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) fail(`Missing env var: ${name}`)
  return v!
}

function mapStatus(
  sesStatus: string | undefined,
): 'pending' | 'verified' | 'failed' | 'temporarily_failed' {
  switch (sesStatus) {
    case 'SUCCESS': return 'verified'
    case 'FAILED': return 'failed'
    case 'TEMPORARY_FAILURE': return 'temporarily_failed'
    default: return 'pending'
  }
}

function printDnsTable(rows: Array<[string, string, string]>) {
  const w0 = Math.max(...rows.map(r => r[0].length), 8)
  const w1 = Math.max(...rows.map(r => r[1].length), 4)
  const sep = `${'─'.repeat(w0 + 2)}┼${'─'.repeat(w1 + 2)}┼${'─'.repeat(44)}`

  const pad = (s: string, w: number) => s.padEnd(w)
  console.log(`  ${'NAME'.padEnd(w0)}  │  ${'TYPE'.padEnd(w1)}  │  VALUE`)
  console.log(`  ${sep}`)
  for (const [name, type, value] of rows) {
    console.log(`  ${pad(name, w0)}  │  ${pad(type, w1)}  │  ${value}`)
  }
}

// ── config ─────────────────────────────────────────────────────────────────

const domain = process.argv[2]
if (!domain || domain.startsWith('--')) {
  fail(
    'Missing domain argument\n\n'
    + '  Usage: bun run add:identity example.com [--mail-from mail] [--check]',
  )
}

const mailFromSubdomain = getFlag('mail-from') ?? 'mail'
const checkOnly = hasFlag('check')

const region = requireEnv('AWS_REGION')
const accessKeyId = requireEnv('AWS_ACCESS_KEY_ID')
const secretAccessKey = requireEnv('AWS_SECRET_ACCESS_KEY')
const databaseUrl = requireEnv('DATABASE_URL')

const ses = new SESv2Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
})

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle(pool)

// ── check mode ─────────────────────────────────────────────────────────────

async function checkIdentity() {
  console.log(`\n\x1b[1mStatus for ${domain}\x1b[0m\n`)

  const [awsData, dbRows] = await Promise.all([
    ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain })).catch(() => null),
    db.select().from(emailIdentities).where(eq(emailIdentities.domain, domain)).limit(1),
  ])

  if (!awsData) {
    warn('Not found in SES')
  }
  else {
    const verificationStatus = awsData.VerifiedForSendingStatus ? 'verified' : 'pending'
    const dkimStatus = awsData.DkimAttributes?.Status ?? 'UNKNOWN'
    console.log(`  SES sending status:  \x1b[1m${verificationStatus}\x1b[0m`)
    console.log(`  DKIM status:         \x1b[1m${dkimStatus}\x1b[0m`)
  }

  const row = dbRows[0]
  if (!row) {
    warn('Not found in database')
  }
  else {
    console.log(`  DB status:           \x1b[1m${row.status}\x1b[0m`)
    console.log(`  MAIL FROM:           ${row.mailFromDomain ?? '(not set)'}`)
    if (row.dkimTokens?.length) {
      console.log(`  DKIM tokens:         ${row.dkimTokens.join(', ')}`)
    }
  }

  // Sync DB if AWS has newer data
  if (awsData && row) {
    const newStatus = mapStatus(awsData.DkimAttributes?.Status)
    if (newStatus !== row.status) {
      await db
        .update(emailIdentities)
        .set({ status: newStatus, dkimStatus: awsData.DkimAttributes?.Status, updatedAt: new Date() })
        .where(eq(emailIdentities.domain, domain))
      info(`DB status synced: ${row.status} → ${newStatus}`)
    }
  }

  console.log()
  await pool.end()
}

if (checkOnly) {
  await checkIdentity()
  process.exit(0)
}

// ── create mode ────────────────────────────────────────────────────────────

console.log(`\n\x1b[1mAdding identity: ${domain}\x1b[0m\n`)

// Create or retrieve SES identity
try {
  await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }))
  ok('SES identity created')
}
catch (err) {
  const name = (err as { name?: string }).name
  if (name === 'AlreadyExistsException') {
    warn('Identity already exists in SES')
  }
  else {
    throw err
  }
}

// Fetch current attributes (DKIM tokens are returned here)
const identity = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }))

const dkimTokens = identity.DkimAttributes?.Tokens ?? []
const dkimStatus = identity.DkimAttributes?.Status ?? 'PENDING'
const mailFromDomain = `${mailFromSubdomain}.${domain}`

// Configure custom MAIL FROM domain
await ses.send(
  new PutEmailIdentityMailFromAttributesCommand({
    EmailIdentity: domain,
    MailFromDomain: mailFromDomain,
    BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
  }),
)
ok(`MAIL FROM configured: ${mailFromDomain}`)

// Upsert in DB
const now = new Date()
await db
  .insert(emailIdentities)
  .values({
    domain,
    status: mapStatus(dkimStatus),
    dkimTokens: dkimTokens.length ? dkimTokens : null,
    dkimStatus,
    mailFromDomain,
    rawAttributes: identity as Record<string, unknown>,
    updatedAt: now,
  })
  .onConflictDoUpdate({
    target: emailIdentities.domain,
    set: {
      status: mapStatus(dkimStatus),
      dkimTokens: dkimTokens.length ? dkimTokens : null,
      dkimStatus,
      mailFromDomain,
      rawAttributes: identity as Record<string, unknown>,
      updatedAt: now,
    },
  })
ok('Stored in database')

// ── DNS records ────────────────────────────────────────────────────────────

console.log('\n\x1b[1mDNS records to add\x1b[0m')
console.log('─────────────────────────────────────────\n')

if (dkimTokens.length) {
  console.log('\x1b[1mDKIM\x1b[0m  (3 CNAME records — all required)')
  printDnsTable(
    dkimTokens.map(t => [
      `${t}._domainkey.${domain}`,
      'CNAME',
      `${t}.dkim.amazonses.com`,
    ]),
  )
  console.log()
}
else {
  warn('No DKIM tokens returned — run with --check once SES processes the identity.')
  console.log()
}

console.log('\x1b[1mMAIL FROM\x1b[0m')
printDnsTable([
  [mailFromDomain, 'MX', `10 feedback-smtp.${region}.amazonses.com`],
  [mailFromDomain, 'TXT', `"v=spf1 include:amazonses.com ~all"`],
])
console.log()

console.log('\x1b[1mDMARC\x1b[0m  (recommended — adjust rua address)')
printDnsTable([
  [`_dmarc.${domain}`, 'TXT', `"v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`],
])
console.log()

console.log(
  '\x1b[2mDKIM verification typically completes within 72 hours after DNS propagates.\x1b[0m',
)
console.log(
  `\x1b[2mCheck status with: bun run add:identity ${domain} --check\x1b[0m\n`,
)

await pool.end()
