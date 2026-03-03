import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { emailSends, emailIdentities } from "../db/schema.js";
import { EmailValidationService } from "../services/EmailValidationService.js";
import { SuppressionService } from "../services/SuppressionService.js";
import { emailQueue } from "../queue/index.js";
import { extractEmail, isValidEmailField } from "../utils/email.js";

const emailField = z.string().refine(isValidEmailField, "Invalid email address");

const sendSchema = z
  .object({
    to: emailField,
    from: emailField,
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
    replyTo: emailField.optional(),
  })
  .refine((d) => d.html || d.text, { message: "html or text is required" });

async function isVerifiedIdentity(fromAddress: string): Promise<boolean> {
  const domain = extractEmail(fromAddress).split("@")[1];
  const rows = await db
    .select({ status: emailIdentities.status })
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1);
  return rows[0]?.status === "verified";
}

const validationService = new EmailValidationService();
const suppressionService = new SuppressionService();

export const emailRoutes = new Hono();

emailRoutes.post("/emails/send", zValidator("json", sendSchema), async (c) => {
  const body = c.req.valid("json");
  const to   = body.to;
  const from = body.from;
  const toEmail   = extractEmail(to);
  const fromEmail = extractEmail(from);

  if (!await isVerifiedIdentity(fromEmail)) {
    return c.json({ error: "UNVERIFIED_IDENTITY", detail: `Domain of '${fromEmail}' is not a verified sending identity` }, 400);
  }

  const validation = await validationService.validate(toEmail);
  if (!validation.valid) {
    return c.json({ error: "INVALID_EMAIL", reason: validation.reason, detail: validation.detail }, 400);
  }

  const suppression = await suppressionService.isSuppressed(toEmail);
  if (suppression) {
    return c.json({ error: "SUPPRESSED", reason: suppression.reason }, 400);
  }

  const [send] = await db
    .insert(emailSends)
    .values({
      to,
      from,
      subject: body.subject,
      htmlBody: body.html ?? null,
      textBody: body.text ?? null,
      replyTo: body.replyTo ?? null,
      status: "queued",
    })
    .returning();

  const job = await emailQueue.add(
    "send",
    {
      emailSendId: send.id,
      to,
      from,
      subject: body.subject,
      html: body.html,
      text: body.text,
      replyTo: body.replyTo,
      enqueuedAt: new Date().toISOString(),
    },
    { jobId: send.id }
  );

  await db
    .update(emailSends)
    .set({ jobId: job.id ?? null })
    .where(eq(emailSends.id, send.id));

  return c.json({ id: send.id, status: "queued" }, 202);
});

