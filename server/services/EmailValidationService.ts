import { redis } from '../cache/redis.ts'
import { env } from '../lib/env.ts'

const BLOCKLIST_KEY = 'email_validation:blocklist'
const BLOCKLIST_SENTINEL_KEY = 'email_validation:blocklist:loaded_at'
const DOMAIN_CACHE_PREFIX = 'email_validation:domain:'
const CACHE_TTL_SECONDS = 86400 // 24h

interface ValidationResult {
  valid: boolean
  reason?: string
  detail?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class EmailValidationService {
  async validate(email: string): Promise<ValidationResult> {
    const lower = email.toLowerCase()

    const formatResult = this.checkFormat(lower)
    if (!formatResult.valid) return formatResult

    const domain = lower.split('@')[1]

    const cached = await redis.get(`${DOMAIN_CACHE_PREFIX}${domain}`)
    if (cached) {
      return JSON.parse(cached) as ValidationResult
    }

    const disposableResult = await this.checkDisposable(domain)
    if (!disposableResult.valid) {
      await redis.setex(
        `${DOMAIN_CACHE_PREFIX}${domain}`,
        CACHE_TTL_SECONDS,
        JSON.stringify(disposableResult),
      )
      return disposableResult
    }

    const mxResult = await this.checkMx(domain)
    await redis.setex(
      `${DOMAIN_CACHE_PREFIX}${domain}`,
      CACHE_TTL_SECONDS,
      JSON.stringify(mxResult),
    )
    return mxResult
  }

  private checkFormat(email: string): ValidationResult {
    const atCount = (email.match(/@/g) || []).length
    if (atCount !== 1 || !EMAIL_REGEX.test(email)) {
      return { valid: false, reason: 'INVALID_FORMAT', detail: 'Malformed email address' }
    }
    return { valid: true }
  }

  private async checkDisposable(domain: string): Promise<ValidationResult> {
    await this.ensureBlocklistLoaded()
    const isMember = await redis.sismember(BLOCKLIST_KEY, domain)
    if (isMember) {
      return { valid: false, reason: 'DISPOSABLE_DOMAIN', detail: 'Disposable email domain' }
    }
    return { valid: true }
  }

  private async ensureBlocklistLoaded(): Promise<void> {
    const sentinel = await redis.get(BLOCKLIST_SENTINEL_KEY)
    if (sentinel) return

    try {
      const response = await fetch(env.DISPOSABLE_BLOCKLIST_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      const domains = text
        .split('\n')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean)

      const pipeline = redis.pipeline()
      pipeline.del(BLOCKLIST_KEY)
      for (let i = 0; i < domains.length; i += 500) {
        const chunk = domains.slice(i, i + 500)
        pipeline.sadd(BLOCKLIST_KEY, ...chunk)
      }
      pipeline.setex(BLOCKLIST_SENTINEL_KEY, CACHE_TTL_SECONDS, '1')
      await pipeline.exec()
    }
    catch (err) {
      console.error('[EmailValidation] Failed to load blocklist:', err)
    }
  }

  private async checkMx(domain: string): Promise<ValidationResult> {
    try {
      const { resolveMx } = await import('dns/promises')
      const records = await resolveMx(domain)
      if (!records || records.length === 0) {
        return { valid: false, reason: 'NO_MX_RECORDS', detail: 'Domain has no MX records' }
      }
      return { valid: true }
    }
    catch {
      return { valid: false, reason: 'NO_MX_RECORDS', detail: 'Could not resolve MX records' }
    }
  }
}
