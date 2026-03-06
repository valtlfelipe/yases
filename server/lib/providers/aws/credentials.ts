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
  } catch (e) {
    console.error('AWS credentials validation failed:', e)
    return false
  }
}

export async function getAccountId(credentials: ProviderCredentials): Promise<string> {
  const { accessKeyId, secretAccessKey, region } = credentials

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('Missing AWS credentials')
  }

  const client = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const { Account } = await client.send(new GetCallerIdentityCommand({}))
  return Account!
}

export function createSesClient(credentials: ProviderCredentials): SESv2Client {
  const { accessKeyId, secretAccessKey, region } = credentials

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('Missing AWS credentials')
  }

  return new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
}
