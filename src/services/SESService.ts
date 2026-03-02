import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { env } from "../config/env.js";

const sesClient = new SESClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export class SESService {
  async send(params: SendEmailParams): Promise<{ sesMessageId: string }> {
    const input: SendEmailCommandInput = {
      Source: params.from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          ...(params.html && { Html: { Data: params.html, Charset: "UTF-8" } }),
          ...(params.text && { Text: { Data: params.text, Charset: "UTF-8" } }),
        },
      },
      ...(params.replyTo && { ReplyToAddresses: [params.replyTo] }),
      ...(env.SES_CONFIGURATION_SET && { ConfigurationSetName: env.SES_CONFIGURATION_SET }),
    };

    const command = new SendEmailCommand(input);
    const result = await sesClient.send(command);

    if (!result.MessageId) {
      throw new Error("SES returned no MessageId");
    }

    return { sesMessageId: result.MessageId };
  }
}
