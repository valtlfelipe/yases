import { createAuthClient } from 'better-auth/vue'
import { apiKeyClient } from '@better-auth/api-key/client'

export const authClient = createAuthClient({
  plugins: [apiKeyClient()],
})
