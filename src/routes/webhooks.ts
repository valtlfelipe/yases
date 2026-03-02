import { Hono } from "hono";
import { webhookQueue } from "../queue/webhookQueue.js";

export const webhookRoutes = new Hono();

webhookRoutes.post("/webhooks/ses", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: true });
  }

  const messageType = body["Type"] as string | undefined;

  if (messageType === "SubscriptionConfirmation") {
    const subscribeUrl = body["SubscribeURL"] as string | undefined;
    if (subscribeUrl) {
      try {
        const res = await fetch(subscribeUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log("[Webhook] SNS subscription confirmed");
      } catch (err) {
        console.error("[Webhook] Failed to confirm SNS subscription:", (err as Error).message);
      }
    }
    return c.json({ ok: true });
  }

  if (messageType !== "Notification") {
    return c.json({ ok: true });
  }

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(body["Message"] as string);
  } catch {
    return c.json({ ok: true });
  }

  const notificationType = (notification["notificationType"] ?? notification["eventType"]) as string | undefined;
  if (notificationType) {
    const sesMessageId = (notification["mail"] as Record<string, unknown> | undefined)?.["messageId"];
    console.log(`[Webhook] Enqueuing ${notificationType} | sesMessageId: ${sesMessageId ?? "(none)"}`);
    await webhookQueue.add(notificationType, { notificationType, notification, rawPayload: body });
  } else {
    console.warn("[Webhook] Notification missing notificationType, raw message:", body["Message"]);
  }

  return c.json({ ok: true });
});
