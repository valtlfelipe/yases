import { createAuthClient } from "better-auth/vue";
import { apiKeyClient } from "@better-auth/api-key/client";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const authClient = createAuthClient({
    baseURL: config.public.apiUrl,
    plugins: [apiKeyClient()],
  });
  return { provide: { authClient } };
});
