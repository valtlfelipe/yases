// import { createAuthClient } from "better-auth/vue";

// let authClient: ReturnType<typeof createAuthClient> | null = null;

// export function getAuthClient() {
//   if (!authClient) {
//     authClient = createAuthClient({
//       baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
//     });
//   }
//   return authClient;
// }

// export default defineNuxtPlugin(() => {
//   const client = getAuthClient();
//   return { provide: { authClient: client } };
// });
import { createAuthClient } from 'better-auth/vue'
// make sure to import from better-auth/vue
export const authClient = createAuthClient({
  // you can pass client configuration here
})
