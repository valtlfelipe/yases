import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { emailEvents, emailSends } from "../db/schema.js";
import { SuppressionService } from "../services/SuppressionService.js";
import { WEBHOOK_QUEUE_NAME } from "../queue/webhookQueue.js";
import { bullMQConnection } from "../queue/connection.js";
import type { WebhookJobData } from "../queue/types.js";

const suppressionService = new SuppressionService();

async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { notificationType, notification, rawPayload } = job.data;
  const sesMessageId = extractMessageId(notification);
  console.log(`[WebhookWorker] Processing ${notificationType} | sesMessageId: ${sesMessageId} | attempt: ${job.attemptsMade + 1}`);

  switch (notificationType) {
    case "Send":      return handleSend(notification, rawPayload);
    case "Bounce":    return handleBounce(notification, rawPayload);
    case "Complaint": return handleComplaint(notification, rawPayload);
    case "Delivery":  return handleDelivery(notification, rawPayload);
    case "Open":      return handleOpen(notification, rawPayload);
    case "Click":     return handleClick(notification, rawPayload);
    default:
      console.warn(`[WebhookWorker] Unhandled notification type: ${notificationType}`);
  }
}

// ── handlers ───────────────────────────────────────────────────────────────

async function handleSend(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const sesMessageId = extractMessageId(notification);
  const sendRow = await requireSendByMessageId(sesMessageId);
  await insertEvent(sendRow.id, sesMessageId, "send", rawPayload, {});
}

async function handleBounce(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const bounce = notification["bounce"] as Record<string, unknown> | undefined;
  if (!bounce) return;

  const bounceType = (bounce["bounceType"] as string | undefined)?.toLowerCase();
  const reason = bounceType === "permanent" ? "permanent_bounce" : "transient_bounce";
  const sesMessageId = extractMessageId(notification);
  const sendRow = await requireSendByMessageId(sesMessageId);

  const recipients = (bounce["bouncedRecipients"] as Array<{ emailAddress?: string; diagnosticCode?: string }>) ?? [];

  await Promise.all(
    recipients.map(async (r) => {
      if (!r.emailAddress) return;
      await suppressionService.add(r.emailAddress, reason, bounce["bounceSubType"] as string | undefined);
      await insertEvent(sendRow.id, sesMessageId, "bounce", rawPayload, {
        bounceType:     bounce["bounceType"],
        bounceSubType:  bounce["bounceSubType"],
        diagnosticCode: r.diagnosticCode,
      });
    })
  );
}

async function handleComplaint(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const complaint = notification["complaint"] as Record<string, unknown> | undefined;
  if (!complaint) return;

  const sesMessageId = extractMessageId(notification);
  const sendRow = await requireSendByMessageId(sesMessageId);

  const recipients = (complaint["complainedRecipients"] as Array<{ emailAddress?: string }>) ?? [];

  await Promise.all(
    recipients.map(async (r) => {
      if (!r.emailAddress) return;
      await suppressionService.add(r.emailAddress, "complaint");
      await insertEvent(sendRow.id, sesMessageId, "complaint", rawPayload, {
        feedbackType: complaint["complaintFeedbackType"],
      });
    })
  );
}

async function handleDelivery(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const sesMessageId = extractMessageId(notification);
  const delivery = notification["delivery"] as Record<string, unknown> | undefined;
  const sendRow = await requireSendByMessageId(sesMessageId);

  await insertEvent(sendRow.id, sesMessageId, "delivery", rawPayload, {
    smtpResponse: delivery?.["smtpResponse"],
    remoteMtaIp:  delivery?.["remoteMtaIp"],
    processingMs: delivery?.["processingTimeMillis"],
  });
}

async function handleOpen(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const sesMessageId = extractMessageId(notification);
  const open = notification["open"] as Record<string, unknown> | undefined;
  const sendRow = await requireSendByMessageId(sesMessageId);

  await insertEvent(sendRow.id, sesMessageId, "open", rawPayload, {
    ipAddress: open?.["ipAddress"],
    userAgent: open?.["userAgent"],
  });
}

async function handleClick(
  notification: Record<string, unknown>,
  rawPayload: Record<string, unknown>
): Promise<void> {
  const sesMessageId = extractMessageId(notification);
  const click = notification["click"] as Record<string, unknown> | undefined;
  const sendRow = await requireSendByMessageId(sesMessageId);

  await insertEvent(sendRow.id, sesMessageId, "click", rawPayload, {
    link:      click?.["link"],
    ipAddress: click?.["ipAddress"],
    userAgent: click?.["userAgent"],
  });
}

// ── helpers ────────────────────────────────────────────────────────────────

function extractMessageId(notification: Record<string, unknown>): string {
  return (
    ((notification["mail"] as Record<string, unknown> | undefined)?.["messageId"] as string | undefined) ?? ""
  );
}

async function requireSendByMessageId(sesMessageId: string) {
  if (!sesMessageId) throw new Error("Empty sesMessageId in notification");

  const rows = await db
    .select()
    .from(emailSends)
    .where(eq(emailSends.sesMessageId, sesMessageId))
    .limit(1);

  if (!rows[0]) {
    console.warn(`[WebhookWorker] No send record found for sesMessageId: ${sesMessageId} — will retry`);
    throw new Error(`Send record not found for sesMessageId: ${sesMessageId}`);
  }

  console.log(`[WebhookWorker] Matched send record ${rows[0].id} (status: ${rows[0].status})`);
  return rows[0];
}

async function insertEvent(
  emailSendId: string,
  sesMessageId: string,
  eventType: typeof emailEvents.$inferInsert["eventType"],
  rawPayload: Record<string, unknown>,
  metadata: Record<string, unknown>
): Promise<void> {
  const cleanMeta = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined)
  );
  await db.insert(emailEvents).values({
    emailSendId,
    sesMessageId,
    eventType,
    rawPayload,
    metadata: Object.keys(cleanMeta).length ? cleanMeta : null,
    occurredAt: new Date(),
  });
  console.log(`[WebhookWorker] Inserted ${eventType} event for send ${emailSendId}`);
}

// ── factory ────────────────────────────────────────────────────────────────

export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(WEBHOOK_QUEUE_NAME, processWebhookJob, {
    connection: bullMQConnection(),
    concurrency: 20,
  });

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[WebhookWorker] Worker error:", err.message);
  });

  return worker;
}
