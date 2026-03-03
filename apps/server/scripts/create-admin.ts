import { auth } from "../src/lib/auth.js";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] ?? "Admin";

if (!email || !password) {
  console.error("Usage: bun scripts/create-admin.ts <email> <password> [name]");
  process.exit(1);
}

const { data, error } = await auth.api.signUpEmail({
  body: { email, password, name },
});

if (error) {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`Admin created: ${data?.user?.email}`);
