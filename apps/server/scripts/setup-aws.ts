#!/usr/bin/env bun
/**
 * AWS SES + SNS setup script.
 *
 * Creates:
 *   • SNS topic for bounce/complaint/delivery notifications
 *   • SES configuration set
 *   • SNS event destination on the config set
 *   • SNS HTTPS subscription for your webhook endpoint
 *
 * Usage:
 *   bun run setup:aws --webhook-url https://api.example.com/webhooks/ses
 *
 * Options:
 *   --webhook-url   HTTPS endpoint SNS will call  (required)
 *   --config-set    SES configuration set name    (default: email-service)
 *   --topic-name    SNS topic name                (default: email-service-notifications)
 */

import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  UpdateConfigurationSetEventDestinationCommand,
  GetConfigurationSetEventDestinationsCommand,
} from "@aws-sdk/client-sesv2";
import {
  SNSClient,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
} from "@aws-sdk/client-sns";

// ── helpers ────────────────────────────────────────────────────────────────

const ok   = (s: string) => console.log(`\x1b[32m✓\x1b[0m  ${s}`);
const info = (s: string) => console.log(`\x1b[36m→\x1b[0m  ${s}`);
const warn = (s: string) => console.log(`\x1b[33m⚠\x1b[0m  ${s}`);
const fail = (s: string) => { console.error(`\x1b[31m✗\x1b[0m  ${s}`); process.exit(1); };
const step = (n: number, s: string) => console.log(`\n\x1b[1mStep ${n}: ${s}\x1b[0m`);
const kv   = (k: string, v: string) => console.log(`  \x1b[2m${k}:\x1b[0m  ${v}`);

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const idx  = argv.indexOf(`--${name}`);
  if (idx !== -1) return argv[idx + 1];
  const prefixed = argv.find((a) => a.startsWith(`--${name}=`));
  return prefixed?.split("=").slice(1).join("=");
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) fail(`Missing env var: ${name}`);
  return v!;
}

function isAlreadyExists(err: unknown): boolean {
  return (err as { name?: string })?.name === "AlreadyExistsException";
}

// ── config ─────────────────────────────────────────────────────────────────

const webhookUrl   = getArg("webhook-url");
const configSetName = getArg("config-set")  ?? "email-service";
const topicName    = getArg("topic-name")   ?? "email-service-notifications";

if (!webhookUrl) {
  fail(
    "Missing --webhook-url\n\n" +
    "  Usage: bun run setup:aws -- --webhook-url https://api.example.com/webhooks/ses"
  );
}

const region          = requireEnv("AWS_REGION");
const accessKeyId     = requireEnv("AWS_ACCESS_KEY_ID");
const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");

const credentials = { accessKeyId, secretAccessKey };
const sesClient   = new SESv2Client({ region, credentials });
const snsClient   = new SNSClient({ region, credentials });

// ── main ───────────────────────────────────────────────────────────────────

console.log("\n\x1b[1mAWS SES Setup\x1b[0m");
console.log("─────────────────────────────────────────");
kv("Region",         region);
kv("Config set",     configSetName);
kv("SNS topic",      topicName);
kv("Webhook URL",    webhookUrl!);

// Step 1 — SNS topic
step(1, "Create SNS topic");

const { TopicArn: topicArn } = await snsClient.send(
  new CreateTopicCommand({ Name: topicName })
);

if (!topicArn) fail("CreateTopic returned no ARN");
ok(`Topic ARN: ${topicArn}`);

// Set topic policy so SES can publish to it
const accountId = topicArn!.split(":")[4];
const topicPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "AllowSESPublish",
      Effect: "Allow",
      Principal: { Service: "ses.amazonaws.com" },
      Action: "SNS:Publish",
      Resource: topicArn,
      Condition: { StringEquals: { "AWS:SourceAccount": accountId } },
    },
  ],
});

await snsClient.send(
  new SetTopicAttributesCommand({
    TopicArn:       topicArn,
    AttributeName:  "Policy",
    AttributeValue: topicPolicy,
  })
);
ok("Topic policy set (SES may publish)");

// Step 2 — SES configuration set
step(2, "Create SES configuration set");

try {
  await sesClient.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: configSetName })
  );
  ok(`Configuration set created: ${configSetName}`);
} catch (err) {
  if (isAlreadyExists(err)) {
    warn(`Configuration set already exists: ${configSetName}`);
  } else {
    throw err;
  }
}

// Step 3 — SNS event destination
step(3, "Create SNS event destination");

const eventDestinationName = "sns-notifications";

// Check if destination already exists
const { EventDestinations: existing = [] } = await sesClient.send(
  new GetConfigurationSetEventDestinationsCommand({
    ConfigurationSetName: configSetName,
  })
);

const alreadyHasDestination = existing.some(
  (d) => d.Name === eventDestinationName
);

const allEventTypes = ["SEND", "REJECT", "BOUNCE", "COMPLAINT", "DELIVERY", "OPEN", "CLICK"] as const;

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
    })
  );
  ok(`Event destination updated (${allEventTypes.join(", ")} → SNS)`);
} else {
  await sesClient.send(
    new CreateConfigurationSetEventDestinationCommand({
      ConfigurationSetName: configSetName,
      EventDestinationName: eventDestinationName,
      EventDestination: {
        Enabled: true,
        MatchingEventTypes: [...allEventTypes],
        SnsDestination: { TopicArn: topicArn },
      },
    })
  );
  ok(`Event destination created (${allEventTypes.join(", ")} → SNS)`);
}

// Step 4 — SNS subscription
step(4, "Subscribe webhook to SNS topic");

// Check if already subscribed
const { Subscriptions = [] } = await snsClient.send(
  new ListSubscriptionsByTopicCommand({ TopicArn: topicArn })
);

const existingSub = Subscriptions.find((s) => s.Endpoint === webhookUrl);
if (existingSub) {
  const status =
    existingSub.SubscriptionArn === "PendingConfirmation"
      ? "pending confirmation"
      : `confirmed (${existingSub.SubscriptionArn})`;
  warn(`Already subscribed — ${status}`);
} else {
  const protocol = webhookUrl!.startsWith("https") ? "https" : "http";
  const { SubscriptionArn } = await snsClient.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: protocol,
      Endpoint: webhookUrl,
    })
  );

  if (SubscriptionArn === "pending confirmation") {
    info("Subscription created — waiting for confirmation from your server.");
    info("The server auto-confirms on first SNS SubscriptionConfirmation request.");
  } else {
    ok(`Subscribed: ${SubscriptionArn}`);
  }
}

// ── summary ────────────────────────────────────────────────────────────────

console.log("\n\x1b[1mSetup complete. Add to your .env:\x1b[0m\n");
console.log(`  SES_CONFIGURATION_SET=${configSetName}`);
console.log();
