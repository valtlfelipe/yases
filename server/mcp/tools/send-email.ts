import { z } from 'zod'
import { defineMcpTool, errorResult } from '@nuxtjs/mcp-toolkit/server'
import { sendEmail, SendEmailError, sendEmailSchema } from '../../services/SendEmailService'

export default defineMcpTool({
  name: 'send_email',
  title: 'Send Email',
  description: 'Send an email to a recipient. Use transactional for notifications, receipts, password resets. Use marketing for newsletters (requires {{unsubscribeUrl}} placeholder).',
  inputSchema: sendEmailSchema.shape,
  outputSchema: {
    id: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    scheduledAt: z.string().optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async ({ to, from, subject, html, text, replyTo, type, scheduledAt }) => {
    const event = useEvent()
    const userId = event.context.user?.id

    if (!userId) {
      return errorResult('Authentication required. Please provide a valid API key.')
    }

    try {
      const result = await sendEmail({ to, from, subject, html, text, replyTo, type, scheduledAt })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result),
        }],
        structuredContent: result as unknown as { [key: string]: unknown },
      }
    }
    catch (err) {
      if (err instanceof SendEmailError) {
        return errorResult(err.message)
      }
      return errorResult(err instanceof Error ? err.message : 'Unknown error')
    }
  },
})
