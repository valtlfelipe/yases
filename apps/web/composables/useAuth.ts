export function useAuth() {
  const { $authClient } = useNuxtApp();

  // useSession() returns DeepReadonly<Ref<{ data, isPending, error, ... }>>
  const session = $authClient.useSession();
  const isAuthenticated = computed(() => !!session.value?.data?.user);
  const user = computed(() => session.value?.data?.user ?? null);

  async function signup(name: string, email: string, password: string) {
    const { error } = await $authClient.signUp.email({ name, email, password });
    if (error) throw new Error(error.message ?? "Failed to create account.");
    await navigateTo("/");
  }

  async function login(email: string, password: string) {
    const { error } = await $authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? "Invalid email or password.");
    await navigateTo("/");
  }

  async function logout() {
    await $authClient.signOut();
    await navigateTo("/login");
  }

  return { session, isAuthenticated, user, signup, login, logout };
}
