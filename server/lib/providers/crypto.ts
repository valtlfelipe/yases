import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(salt: string): Buffer {
  // Use a fixed salt derived from the secret or generate one
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY or BETTER_AUTH_SECRET must be set')
  }
  return scryptSync(secret, salt, 32)
}

export interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
  salt: string
}

export function encrypt(data: string): EncryptedData {
  const salt = randomBytes(16).toString('hex')
  const key = getKey(salt)
  const iv = randomBytes(12)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    salt,
  }
}

export function decrypt(data: EncryptedData): string {
  const key = getKey(data.salt)

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, 'hex'),
  )

  decipher.setAuthTag(Buffer.from(data.tag, 'hex'))

  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
