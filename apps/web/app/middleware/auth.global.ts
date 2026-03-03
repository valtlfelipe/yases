export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const base = config.public.apiUrl;

  const [sessionData, setupData] = await Promise.all([
    $fetch<{ user?: { id: string } } | null>("/api/auth/get-session", {
      baseURL: base,
      credentials: "include",
    }).catch(() => null),
    $fetch<{ setupRequired: boolean }>("/setup-status", {
      baseURL: base,
    }).catch(() => ({ setupRequired: true })),
  ]);

  const isAuthenticated = !!sessionData?.user;
  const setupRequired = setupData.setupRequired;

  // Authenticated users always go to dashboard
  if (isAuthenticated) {
    if (to.path === "/login" || to.path === "/signup") return navigateTo("/");
    return;
  }

  // No user in DB yet — only /signup is accessible
  if (setupRequired) {
    if (to.path !== "/signup") return navigateTo("/signup");
    return;
  }

  // User exists but not authenticated — only /login is accessible
  if (to.path !== "/login") return navigateTo("/login");
});
