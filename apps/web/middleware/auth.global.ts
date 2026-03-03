export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();

  let isAuthenticated = false;
  try {
    const data = await $fetch<{ user?: { id: string } } | null>(
      "/api/auth/get-session",
      { baseURL: config.public.apiUrl, credentials: "include" }
    );
    isAuthenticated = !!data?.user;
  } catch {
    isAuthenticated = false;
  }

  if (to.path === "/login") {
    if (isAuthenticated) return navigateTo("/");
    return;
  }

  if (!isAuthenticated) return navigateTo("/login");
});
