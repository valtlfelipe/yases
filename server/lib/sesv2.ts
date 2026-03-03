import { SESv2Client } from '@aws-sdk/client-sesv2'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { env } from './env'

const credentials = {
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
}

export const sesv2 = new SESv2Client({ region: env.AWS_REGION, credentials })

const stsClient = new STSClient({ region: env.AWS_REGION, credentials })

let cachedAccountId: string | null = null

async function getAccountId(): Promise<string> {
  if (!cachedAccountId) {
    const { Account } = await stsClient.send(new GetCallerIdentityCommand({}))
    if (!Account) throw new Error('STS returned no Account ID')
    cachedAccountId = Account as string
  }
  return cachedAccountId
}

export async function identityArn(domain: string): Promise<string> {
  const accountId = await getAccountId()
  return `arn:aws:ses:${env.AWS_REGION}:${accountId}:identity/${domain}`
}

export async function configSetArn(name: string): Promise<string> {
  const accountId = await getAccountId()
  return `arn:aws:ses:${env.AWS_REGION}:${accountId}:configuration-set/${name}`
}
