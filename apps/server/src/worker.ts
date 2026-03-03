import "./config/env.js";
import { createEmailWorker } from "./workers/emailWorker.js";
import { createWebhookWorker } from "./workers/webhookWorker.js";

const emailWorker   = createEmailWorker();
const webhookWorker = createWebhookWorker();

console.log("[Worker] Email worker started");
console.log("[Worker] Webhook worker started");

async function shutdown() {
  await Promise.all([emailWorker.close(), webhookWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
