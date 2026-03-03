import { auth } from '../../../lib/auth'
// import { db } from "../../../db/index";
// import { user } from "../../../db/schema";
// import { count } from "drizzle-orm";

// export default defineEventHandler(async (event) => {
//   const path = event.path;

//   const signUpBlockedPaths = ["/api/auth/sign-up"];
//   const isSignUpPath = signUpBlockedPaths.some((p) => path.startsWith(p));

//   if (isSignUpPath) {
//     const [result] = await db.select({ count: count() }).from(user);
//     if (result.count > 0) {
//       setResponseStatus(event, 403);
//       return {
//         error: "Registration is disabled. This instance already has an account.",
//       };
//     }
//   }

//   const request = event.node.req;
//   const authResponse = await auth.handler(request);

//   setResponseStatus(event, authResponse.status);

//   authResponse.headers.forEach((value, key) => {
//     event.headers.set(key, value);
//   });

//   return authResponse.text();
// });

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event))
})
