import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function signUnsubscribeToken(email: string, secret: string, emailSendId?: string): string {
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), exp: Date.now() + TOKEN_EXPIRY_MS, ...(emailSendId && { emailSendId }) })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyUnsubscribeToken(token: string, secret: string): { email: string, emailSendId?: string } | null {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url')

  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  }
  catch {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email: string, exp: number, emailSendId?: string }
    if (Date.now() > data.exp) return null
    return { email: data.email, emailSendId: data.emailSendId }
  }
  catch {
    return null
  }
}
