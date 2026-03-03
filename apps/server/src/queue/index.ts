import { Queue } from "bullmq";
import { bullMQConnection } from "./connection.js";
import type { EmailJobData } from "./types.js";

export const QUEUE_NAME = "email-send";

export const emailQueue = new Queue<EmailJobData, void, string>(QUEUE_NAME, {
  connection: bullMQConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
