import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  UpdateConfigurationSetEventDestinationCommand,
  GetConfigurationSetEventDestinationsCommand,
  DeleteConfigurationSetCommand,
} from '@aws-sdk/client-sesv2'
import {
  SNSClient,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
  DeleteTopicCommand,
} from '@aws-sdk/client-sns'
import type { ProviderCredentials, ProviderSetupResult } from '../types'

function generateResourceNames(providerId: string) {
  // Use first 8 chars of provider ID for uniqueness
  const shortId = providerId.substring(0, 8).replace(/-/g, '')
  return {
    configSetName: `yases-${shortId}`,
    topicName: `yases-${shortId}-notifications`,
    eventDestinationName: 'sns-notifications',
  }
}

export async function setupAwsAccount(params: {
  providerId: string
  webhookUrl: string
  credentials: ProviderCredentials
}): Promise<ProviderSetupResult> {
  const { providerId, webhookUrl, credentials } = params
  const { accessKeyId, secretAccessKey, region } = credentials

  if (!accessKeyId || !secretAccessKey || !region) {
    return { success: false, details: { error: 'Missing AWS credentials' } }
  }

  const { configSetName, topicName, eventDestinationName } = generateResourceNames(providerId)

  const sesClient = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const snsClient = new SNSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  // Step 1: Create SNS topic
  let topicArn: string
  try {
    const topicResult = await snsClient.send(
      new CreateTopicCommand({ Name: topicName }),
    )
    if (!topicResult.TopicArn) {
      return { success: false, details: { error: 'CreateTopic returned no ARN' } }
    }
    topicArn = topicResult.TopicArn
  }
  catch (err) {
    const error = err as { name?: string }
    if (error.name !== 'AlreadyExists') {
      throw err
    }
    // Topic already exists, reconstruct ARN
    const accountId = accessKeyId.substring(0, 12)
    topicArn = `arn:aws:sns:${region}:${accountId}:${topicName}`
  }

  // Step 2: Set topic policy so SES can publish to it
  const accountId = topicArn.split(':')[4]
  const topicPolicy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowSESPublish',
        Effect: 'Allow',
        Principal: { Service: 'ses.amazonaws.com' },
        Action: 'SNS:Publish',
        Resource: topicArn,
        Condition: { StringEquals: { 'AWS:SourceAccount': accountId } },
      },
    ],
  })

  try {
    await snsClient.send(
      new SetTopicAttributesCommand({
        TopicArn: topicArn,
        AttributeName: 'Policy',
        AttributeValue: topicPolicy,
      }),
    )
  }
  catch {
    // Policy might already exist, continue
  }

  // Step 3: Create SES configuration set
  try {
    await sesClient.send(
      new CreateConfigurationSetCommand({ ConfigurationSetName: configSetName }),
    )
  }
  catch (err) {
    const error = err as { name?: string }
    if (error.name !== 'AlreadyExistsException') {
      // Continue anyway
    }
  }

  // Step 4: Create/update SNS event destination
  const { EventDestinations: existing = [] } = await sesClient.send(
    new GetConfigurationSetEventDestinationsCommand({
      ConfigurationSetName: configSetName,
    }),
  )

  const alreadyHasDestination = existing.some(
    d => d.Name === eventDestinationName,
  )

  const allEventTypes = ['SEND', 'REJECT', 'BOUNCE', 'COMPLAINT', 'DELIVERY', 'OPEN', 'CLICK'] as const

  if (alreadyHasDestination) {
    await sesClient.send(
      new UpdateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: eventDestinationName,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: [...allEventTypes],
          SnsDestination: { TopicArn: topicArn },
        },
      }),
    )
  }
  else {
    await sesClient.send(
      new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: eventDestinationName,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: [...allEventTypes],
          SnsDestination: { TopicArn: topicArn },
        },
      }),
    )
  }

  // Step 5: Subscribe webhook to SNS topic
  try {
    const { Subscriptions = [] } = await snsClient.send(
      new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
    )

    const existingSub = Subscriptions.find(s => s.Endpoint === webhookUrl)
    if (!existingSub) {
      const protocol = webhookUrl.startsWith('https') ? 'https' : 'http'
      await snsClient.send(
        new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: protocol,
          Endpoint: webhookUrl,
        }),
      )
    }
  }
  catch {
    // Subscription might fail if endpoint is not reachable
  }

  return {
    success: true,
    details: {
      topicArn,
      configSetName,
      eventDestination: eventDestinationName,
    },
  }
}

export async function teardownAwsAccount(params: {
  credentials: ProviderCredentials
  configSetName?: string
  topicArn?: string
}): Promise<void> {
  const { credentials, configSetName, topicArn } = params
  const { accessKeyId, secretAccessKey, region } = credentials

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('Missing AWS credentials')
  }

  const sesClient = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const snsClient = new SNSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const ignoreNotFound = (err: unknown) => {
    if ((err as { name?: string }).name !== 'NotFoundException') throw err
  }

  if (configSetName) {
    await sesClient.send(
      new DeleteConfigurationSetCommand({
        ConfigurationSetName: configSetName,
      }),
    ).catch(ignoreNotFound)
  }

  if (topicArn) {
    await snsClient.send(
      new DeleteTopicCommand({
        TopicArn: topicArn,
      }),
    ).catch(ignoreNotFound)
  }
}
